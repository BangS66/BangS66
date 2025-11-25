const { contextBridge, ipcRenderer } = require('electron');

// Mengekspos API yang aman ke proses renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // --- Fungsi yang dipanggil dari Renderer ke Main ---

  // Memulai proses pemindaian dengan opsi yang diberikan
  startScan: (options) => ipcRenderer.send('start-scan', options),

  // Menghentikan proses pemindaian yang sedang berjalan
  stopScan: () => ipcRenderer.send('stop-scan'),

  // Meminta proses utama untuk mengekspor data
  exportData: (data, format) => ipcRenderer.invoke('export-data', { data, format }),

  // --- Event listener yang dikirim dari Main ke Renderer ---

  // Menerima pembaruan status/progress pemindaian
  onScanUpdate: (callback) => ipcRenderer.on('scan-update', (_event, value) => callback(value)),

  // Menerima hasil kontak tunggal yang ditemukan
  onScanResult: (callback) => ipcRenderer.on('scan-result', (_event, value) => callback(value)),

  // Menerima notifikasi ketika pemindaian selesai
  onScanComplete: (callback) => ipcRenderer.on('scan-complete', (_event, value) => callback(value)),

  // Menerima pesan error
  onScanError: (callback) => ipcRenderer.on('scan-error', (_event, value) => callback(value)),
});
