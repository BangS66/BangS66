// File: preload.js
// Deskripsi: Skrip preload yang aman untuk menjembatani renderer dan proses utama.
// Hanya mengekspos fungsionalitas yang diperlukan melalui contextBridge.

const { contextBridge, ipcRenderer } = require('electron');

// Daftar channel IPC yang aman untuk diekspos
const validChannels = [
    'use-session', 'clear-session', 'session-cleared',
    'start-scan', 'scan-progress', 'scan-complete', 'scan-error',
    'export-csv', 'export-json', 'export-txt',
    'log-message'
];

contextBridge.exposeInMainWorld('electronAPI', {
    // Fungsi untuk mengirim data dari renderer ke main
    send: (channel, data) => {
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    // Fungsi untuk menerima data dari main ke renderer
    on: (channel, callback) => {
        if (validChannels.includes(channel)) {
            // Hapus listener sebelumnya untuk mencegah duplikasi
            ipcRenderer.removeAllListeners(channel);
            // Bungkus callback dengan aman
            const newCallback = (event, ...args) => callback(...args);
            ipcRenderer.on(channel, newCallback);
        }
    }
});
