document.addEventListener('DOMContentLoaded', () => {
    const startScanBtn = document.getElementById('start-scan-btn');
    const statusMessage = document.getElementById('status-message');
    const scanProgress = document.getElementById('scan-progress');
    const progressCounter = document.getElementById('progress-counter');
    const resultsTableBody = document.querySelector('#results-table tbody');

    const exportCsvBtn = document.getElementById('export-csv-btn');
    const exportVcfBtn = document.getElementById('export-vcf-btn');
    const exportTxtBtn = document.getElementById('export-txt-btn');
    const exportStatus = document.getElementById('export-status');

    let foundContacts = [];
    let uniqueNumbers = new Set();

    function setScanningState(isScanning) {
        startScanBtn.disabled = isScanning;
        scanProgress.style.display = isScanning ? 'block' : 'none';
        if (isScanning) {
            scanProgress.value = 0; // Reset progress bar
        }
    }

    startScanBtn.addEventListener('click', () => {
        resultsTableBody.innerHTML = '';
        foundContacts = [];
        uniqueNumbers.clear();
        statusMessage.textContent = 'Memulai pemindaian...';
        statusMessage.style.color = '';
        progressCounter.textContent = 'Ditemukan: 0 | Diproses: 0';
        setScanningState(true);

        window.electronAPI.startScan({});
    });

    window.electronAPI.onScanUpdate((update) => {
        statusMessage.textContent = update.message;
        if (update.processedChats) {
            progressCounter.textContent = `Ditemukan: ${uniqueNumbers.size} | Diproses: ${update.processedChats}`;
            // Simple progress simulation
            scanProgress.value = 100;
        }
    });

    window.electronAPI.onScanResult((contact) => {
        if (!uniqueNumbers.has(contact.normalized_number)) {
            uniqueNumbers.add(contact.normalized_number);
            foundContacts.push(contact);

            const row = resultsTableBody.insertRow(0);
            row.innerHTML = `
                <td>${contact.original_text || ''}</td>
                <td>${contact.normalized_number || ''}</td>
                <td>${contact.chat_title || ''}</td>
                <td>${contact.chat_type || 'Direct'}</td>
                <td>${contact.last_message_preview || ''}</td>
                <td>${contact.last_activity_timestamp || ''}</td>
            `;

            progressCounter.textContent = `Ditemukan: ${uniqueNumbers.size}`;
        }
    });

    window.electronAPI.onScanComplete(() => {
        setScanningState(false);
        statusMessage.textContent = `Pemindaian selesai! Ditemukan ${uniqueNumbers.size} nomor unik.`;
        scanProgress.value = 100;
    });

    window.electronAPI.onScanError((error) => {
        setScanningState(false);
        statusMessage.textContent = `Error: ${error.message}`;
        statusMessage.style.color = 'red';
    });

    async function handleExport(format) {
        exportStatus.textContent = `Mengekspor ke ${format.toUpperCase()}...`;

        const options = {
            include_chat_name: document.getElementById('include_chat_name').checked,
            include_last_message: document.getElementById('include_last_message').checked,
            include_timestamp: document.getElementById('include_timestamp').checked,
        };

        try {
            const result = await window.electronAPI.exportData({ contacts: foundContacts, options }, format);
            exportStatus.textContent = result.success ? `Berhasil disimpan di: ${result.filePath}` : `Gagal: ${result.error}`;
        } catch (error) {
            exportStatus.textContent = `Error ekspor: ${error.message}`;
        }
    }

    exportCsvBtn.addEventListener('click', () => handleExport('csv'));
    exportVcfBtn.addEventListener('click', () => handleExport('vcf'));
    exportTxtBtn.addEventListener('click', () => handleExport('txt'));
});
