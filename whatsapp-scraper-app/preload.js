const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startScan: () => ipcRenderer.send('start-scan'),
  onScanComplete: (callback) => ipcRenderer.on('scan-complete', (event, ...args) => callback(...args)),
  onScanError: (callback) => ipcRenderer.on('scan-error', (event, ...args) => callback(...args)),
  exportCSV: (contacts) => ipcRenderer.send('export-csv', contacts),
  exportTXT: (contacts) => ipcRenderer.send('export-txt', contacts),
  scanSelected: () => ipcRenderer.send('scan-selected'),
});
