// File: renderer/renderer.js
// Deskripsi: Menangani logika untuk UI (proses renderer).
// Mengelola event listener, menampilkan data, dan berkomunikasi dengan proses utama.

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const rememberSessionCheckbox = document.getElementById('remember-session');
    const clearSessionButton = document.getElementById('clear-session');
    const scanAllButton = document.getElementById('scan-all');
    const exportCsvButton = document.getElementById('export-csv');
    const exportJsonButton = document.getElementById('export-json');
    const exportTxtButton = document.getElementById('export-txt');
    const clearDataButton = document.getElementById('clear-data');
    const logBox = document.getElementById('log-box');
    const progressBar = document.getElementById('progress-bar');
    const contactCountSpan = document.getElementById('contact-count');
    const resultsTableBody = document.getElementById('results-table-body');

    let scrapedData = [];

    // --- Event Listeners ---
    rememberSessionCheckbox.addEventListener('change', () => {
        const use = rememberSessionCheckbox.checked;
        logMessage(`Sesi ${use ? 'akan' : 'tidak akan'} diingat.`);
        window.electronAPI.send('use-session', use);
    });

    clearSessionButton.addEventListener('click', () => {
        logMessage('Menghapus sesi...');
        window.electronAPI.send('clear-session');
    });

    scanAllButton.addEventListener('click', () => {
        logMessage('Memulai pemindaian semua obrolan...');
        setScanningState(true);
        window.electronAPI.send('start-scan', { type: 'all' });
    });

    clearDataButton.addEventListener('click', () => {
        scrapedData = [];
        updateTable();
        logMessage('Data hasil telah dibersihkan.');
    });

    exportCsvButton.addEventListener('click', () => {
        if (scrapedData.length === 0) return logMessage('Tidak ada data untuk diekspor.');
        window.electronAPI.send('export-csv', scrapedData);
    });

    exportJsonButton.addEventListener('click', () => {
        if (scrapedData.length === 0) return logMessage('Tidak ada data untuk diekspor.');
        window.electronAPI.send('export-json', scrapedData);
    });

    exportTxtButton.addEventListener('click', () => {
        if (scrapedData.length === 0) return logMessage('Tidak ada data untuk diekspor.');
        window.electronAPI.send('export-txt', scrapedData);
    });

    // --- IPC Handlers ---
    window.electronAPI.on('log-message', (message) => {
        logMessage(message);
    });

    window.electronAPI.on('session-cleared', (message) => {
        logMessage(message);
        rememberSessionCheckbox.checked = false;
    });

    window.electronAPI.on('scan-progress', ({ progress, message }) => {
        logMessage(message);
        progressBar.style.width = `${progress}%`;
    });

    window.electronAPI.on('scan-complete', (results) => {
        logMessage(`Pemindaian selesai. Ditemukan ${results.length} kontak unik.`);
        scrapedData = results;
        updateTable();
        setScanningState(false);
        progressBar.style.width = '100%';
    });

    window.electronAPI.on('scan-error', (error) => {
        logMessage(`ERROR: ${error}`, 'error');
        setScanningState(false);
    });

    // --- UI Functions ---
    function logMessage(message, type = 'info') {
        const p = document.createElement('p');
        p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        p.className = type;
        logBox.appendChild(p);
        logBox.scrollTop = logBox.scrollHeight;
    }

    function setScanningState(isScanning) {
        scanAllButton.disabled = isScanning;
        // Di masa depan, tombol lain juga akan di-disable di sini
    }

    function updateTable() {
        resultsTableBody.innerHTML = '';
        contactCountSpan.textContent = scrapedData.length;

        scrapedData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td title="${item.name}">${item.name}</td>
                <td title="${item.phone}">${item.phone}</td>
                <td>${item.chatType}</td>
                <td title="${item.lastMessage}">${item.lastMessage}</td>
                <td>${item.timestamp}</td>
            `;
            resultsTableBody.appendChild(row);
        });
    }

    logMessage('Aplikasi siap. Silakan login ke WhatsApp Web di panel kanan.');
});
