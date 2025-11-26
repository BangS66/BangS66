const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  scanContacts: () => ipcRenderer.invoke('scan-contacts'),
  exportFile: (contacts, format) => ipcRenderer.send('export-file', { contacts, format }),
});
