// File: service_worker.js
// Deskripsi: Service worker (background script) untuk mengelola state,
// menginjeksi content script, menerima data, dan menangani unduhan.

// Global state
let isScanning = false;
let scannedContacts = new Map(); // Gunakan Map untuk deduplikasi dan menyimpan metadata
let targetTabId = null;
let currentConfig = {};

// Mendengarkan pesan dari popup atau content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'start_scan') {
    handleStartScan(message);
  } else if (message.type === 'stop_scan') {
    handleStopScan();
  } else if (message.type === 'found_contacts') {
    handleFoundContacts(message.data);
  } else if (message.type === 'scan_progress') {
    logToPopup(message.log);
  } else if (message.type === 'scan_finished_content') {
    handleScanFinished();
  }
  return true; // Keep the message channel open for async response
});

// Memulai proses scan
function handleStartScan(message) {
  if (isScanning) return;
  isScanning = true;
  scannedContacts.clear();
  targetTabId = message.tabId;
  currentConfig = message.config;

  chrome.storage.local.set({ isScanning: true, logContent: '' });
  logToPopup("Injecting content script...");

  chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    files: ['content_inject.js']
  }, () => {
    chrome.tabs.sendMessage(targetTabId, { type: 'start_scroll_and_extract', config: currentConfig });
  });
}

// Menghentikan proses scan
function handleStopScan() {
  if (!isScanning) return;
  isScanning = false;
  chrome.storage.local.set({ isScanning: false });
  if (targetTabId) {
    chrome.tabs.sendMessage(targetTabId, { type: 'stop_extraction' });
  }
  logToPopup("Scan has been stopped by the user.");
  chrome.runtime.sendMessage({ type: 'scan_stopped' });
}

// Menangani kontak yang ditemukan oleh content script
function handleFoundContacts(contacts) {
  contacts.forEach(contact => {
    if (!scannedContacts.has(contact.phone)) {
      scannedContacts.set(contact.phone, contact);
    }
  });
  logToPopup(`Found ${scannedContacts.size} unique contacts so far.`);
  // Simpan data secara berkala
  chrome.storage.local.set({ contacts: Array.from(scannedContacts.values()) });
}

// Menyelesaikan scan dan memulai unduhan
function handleScanFinished() {
  if (!isScanning) return; // Mencegah multiple triggers
  isScanning = false;
  chrome.storage.local.set({ isScanning: false });
  logToPopup("Scan complete. Preparing download...");
  chrome.runtime.sendMessage({ type: 'scan_complete' });

  triggerDownload();
}

// Fungsi untuk mengirim log ke popup
function logToPopup(logMessage) {
  chrome.runtime.sendMessage({ type: 'log', text: logMessage });
}

// Memulai proses unduhan
function triggerDownload() {
  const contacts = Array.from(scannedContacts.values());
  if (contacts.length === 0) {
    logToPopup("No contacts found to download.");
    return;
  }

  const format = currentConfig.exportFormat || 'csv';
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
  const filename = `whatsapp_contacts_${timestamp}.${format}`;

  let content = '';
  let mimeType = '';

  if (format === 'json') {
    content = JSON.stringify(contacts, null, 2);
    mimeType = 'application/json';
  } else if (format === 'vcf') {
    content = '';
    contacts.forEach(c => {
      content += `BEGIN:VCARD\n`;
      content += `VERSION:3.0\n`;
      // Gunakan judul chat sebagai nama, jika bukan nomor. Jika itu nomor, biarkan kosong.
      const name = isNaN(c.chatTitle) ? c.chatTitle : c.phone;
      content += `FN:${name}\n`;
      content += `TEL;TYPE=CELL:${c.phone}\n`;
      content += `NOTE:Ditemukan di chat: ${c.chatTitle} | Teks: ${c.displayTextFound}\n`;
      content += `END:VCARD\n`;
    });
    mimeType = 'text/vcard';
  } else { // CSV
    content = 'phone,displayTextFound,chatTitle\n';
    contacts.forEach(c => {
      const row = `"${c.phone}","${c.displayTextFound.replace(/"/g, '""')}","${c.chatTitle.replace(/"/g, '""')}"\n`;
      content += row;
    });
    mimeType = 'text/csv';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      logToPopup(`Download failed: ${chrome.runtime.lastError.message}`);
    } else {
      logToPopup(`Download started: ${filename}`);
    }
    // Revoke object URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}