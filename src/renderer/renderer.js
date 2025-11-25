document.addEventListener('DOMContentLoaded', () => {
    const startScanBtn = document.getElementById('start-scan-btn');
    const stopScanBtn = document.getElementById('stop-scan-btn');
    const statusMessage = document.getElementById('status-message');
    const scanProgress = document.getElementById('scan-progress'); // Tetap ada untuk visual
    const progressCounter = document.getElementById('progress-counter');
    const resultsTableBody = document.querySelector('#results-table tbody');

    const exportCsvBtn = document.getElementById('export-csv-btn');
    const exportVcfBtn = document.getElementById('export-vcf-btn');
    const exportTxtBtn = document.getElementById('export-txt-btn');
    const exportStatus = document.getElementById('export-status');

    let foundContacts = [];
    let uniqueNumbers = new Set();
    let processedChatsCount = 0;

    function setScanningState(isScanning) {
        startScanBtn.disabled = isScanning;
        stopScanBtn.disabled = !isScanning;
        scanProgress.style.display = isScanning ? 'block' : 'none'; // Sembunyikan/tampilkan progress
    }

    startScanBtn.addEventListener('click', () => {
        // Reset UI
        resultsTableBody.innerHTML = '';
        foundContacts = [];
        uniqueNumbers.clear();
        processedChatsCount = 0;
        statusMessage.textContent = 'Memulai pemindaian...';
        statusMessage.style.color = ''; // Reset warna
        progressCounter.textContent = 'Ditemukan: 0 | Diproses: 0';
        setScanningState(true);

        window.electronAPI.startScan({}); // Tidak ada opsi yang diperlukan lagi
    });

    stopScanBtn.addEventListener('click', () => {
        window.electronAPI.stopScan();
        setScanningState(false);
        statusMessage.textContent = 'Pemindaian dihentikan oleh pengguna.';
    });

    window.electronAPI.onScanUpdate((update) => {
        statusMessage.textContent = update.message;
        if (update.processedChats) {
            processedChatsCount = update.processedChats;
        }
         progressCounter.textContent = `Ditemukan: ${uniqueNumbers.size} | Diproses: ${processedChatsCount}`;
    });

    window.electronAPI.onScanResult((contact) => {
        if (!uniqueNumbers.has(contact.normalized_number)) {
            uniqueNumbers.add(contact.normalized_number);
            foundContacts.push(contact);

            const row = resultsTableBody.insertRow(0); // Sisipkan di atas
            row.innerHTML = `
                <td>${contact.original_text || ''}</td>
                <td>${contact.normalized_number || ''}</td>
                <td>${contact.chat_title || ''}</td>
                <td>${contact.chat_type || 'Direct'}</td>
                <td>${contact.last_message_preview || ''}</td>
                <td>${contact.last_activity_timestamp || ''}</td>
            `;

            progressCounter.textContent = `Ditemukan: ${uniqueNumbers.size} | Diproses: ${processedChatsCount}`;
        }
    });

    window.electronAPI.onScanComplete(() => {
        setScanningState(false);
        statusMessage.textContent = `Pemindaian selesai! Ditemukan ${uniqueNumbers.size} nomor unik.`;
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
