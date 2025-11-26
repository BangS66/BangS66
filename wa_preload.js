const { ipcRenderer, contextBridge } = require('electron');

// This script runs in the hidden WhatsApp window's context.
// Its purpose is to securely expose the WhatsApp Store to the main process.

const Exposer = {
    // This function will be called by the main process to execute code inside this renderer.
    execute: (script) => {
        return new Promise((resolve, reject) => {
            try {
                // The 'eval' is executed in the page's context, where window.Store exists.
                const result = eval(script);
                resolve(result);
            } catch (error) {
                reject(error.message);
            }
        });
    }
};

contextBridge.exposeInMainWorld('waAPI', Exposer);
