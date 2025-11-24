// File: preload_whatsapp.js
// Deskripsi: Skrip preload yang sangat terbatas untuk BrowserView WhatsApp.
// Tujuannya hanya untuk menjembatani pesan dari skrip yang diinjeksi ke proses utama.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, data) => {
        // Hanya izinkan channel yang spesifik untuk keamanan
        if (channel === 'scan-progress') {
            ipcRenderer.send(channel, data);
        }
    }
});
