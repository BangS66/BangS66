const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // UI -> Main
  scanContacts: (filters) => ipcRenderer.invoke('scan-contacts', filters),
  fetchGroups: () => ipcRenderer.invoke('fetch-groups'),
  scrapeGroupMembers: (groupId) => ipcRenderer.invoke('scrape-group-members', groupId),
  exportFile: (contacts, prefix, format) => ipcRenderer.send('export-file', { contacts, prefix, format }),

  // Main -> UI
  onStatusUpdate: (callback) => ipcRenderer.on('status-update', (_event, value) => callback(value)),
});
