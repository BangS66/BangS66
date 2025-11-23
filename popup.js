// File: popup.js
// Deskripsi: Mengelola interaksi pengguna pada popup, mengirim perintah ke service worker,
// dan menampilkan progres.

document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('start-scan');
  const stopButton = document.getElementById('stop-scan');
  const logArea = document.getElementById('log-area');

  // Input configuration
  const delayPerChatInput = document.getElementById('delay-per-chat');
  const delayPerScrollInput = document.getElementById('delay-per-scroll');
  const maxRetriesInput = document.getElementById('max-retries');
  const exportFormatSelect = document.getElementById('export-format');

  // Memuat status dan konfigurasi yang tersimpan
  chrome.storage.local.get(['isScanning', 'logContent', 'config'], (result) => {
    if (result.isScanning) {
      setUIState(true);
      logArea.value = result.logContent || 'Scan is running...';
    } else {
      setUIState(false);
    }

    if (result.config) {
      delayPerChatInput.value = result.config.delayPerChat;
      delayPerScrollInput.value = result.config.delayPerScroll;
      maxRetriesInput.value = result.config.maxRetries;
      exportFormatSelect.value = result.config.exportFormat;
    }
  });

  // Mengatur status UI berdasarkan apakah pemindaian sedang berjalan
  function setUIState(isScanning) {
    startButton.disabled = isScanning;
    stopButton.disabled = !isScanning;
    delayPerChatInput.disabled = isScanning;
    delayPerScrollInput.disabled = isScanning;
    maxRetriesInput.disabled = isScanning;
    exportFormatSelect.disabled = isScanning;
  }

  // Menambahkan log ke textarea
  function log(message) {
    logArea.value += `[${new Date().toLocaleTimeString()}] ${message}\n`;
    logArea.scrollTop = logArea.scrollHeight;
    // Simpan log untuk pemulihan jika popup ditutup
    chrome.storage.local.set({ logContent: logArea.value });
  }

  // Event listener untuk tombol Start Scan
  startButton.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url.startsWith("https://web.whatsapp.com")) {
      setUIState(true);
      log('Starting scan...');
      logArea.value = ''; // Reset log

      const config = {
        delayPerChat: parseInt(delayPerChatInput.value, 10),
        delayPerScroll: parseInt(delayPerScrollInput.value, 10),
        maxRetries: parseInt(maxRetriesInput.value, 10),
        exportFormat: exportFormatSelect.value,
      };

      // Simpan konfigurasi
      chrome.storage.local.set({ config });

      // Kirim pesan ke service worker untuk memulai
      chrome.runtime.sendMessage({
        type: 'start_scan',
        tabId: tab.id,
        config: config
      });
    } else {
      log("Error: Please navigate to web.whatsapp.com and make sure you are logged in.");
    }
  });

  // Event listener untuk tombol Stop Scan
  stopButton.addEventListener('click', () => {
    setUIState(false);
    log('Stopping scan...');
    chrome.runtime.sendMessage({ type: 'stop_scan' });
  });

  // Mendengarkan pesan dari service worker (misalnya, untuk log)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'log') {
      log(message.text);
    } else if (message.type === 'scan_complete' || message.type === 'scan_stopped') {
      setUIState(false);
      log(message.type === 'scan_complete' ? 'Scan finished successfully!' : 'Scan stopped by user.');
      // Reset log setelah beberapa saat
      setTimeout(() => {
        chrome.storage.local.remove(['logContent']);
      }, 5000);
    }
  });
});