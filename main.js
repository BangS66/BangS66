const { app, BrowserWindow, BrowserView, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let view;
let logPath; // Will be initialized when app is ready

// This function will be called only after the app is ready
const log = (message) => {
    if (!logPath) return; // Don't log if path is not set
    try {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
        console.log(message);
    } catch (err) {
        console.error("Failed to write to log file:", err);
    }
};

process.on('uncaughtException', (error) => {
    log(`!!! Uncaught Exception: ${error.message}\n${error.stack}`);
    if(app && !app.isReady()) { // If app crashes before ready
        console.error("App crashed before ready:", error);
    }
    app.quit();
});


function createWindow() {
    try {
        log('Creating main window...');
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
            }
        });

        log('Loading index.html...');
        mainWindow.loadFile(path.join(__dirname, 'index.html'));

        log('Creating BrowserView...');
        view = new BrowserView({
            webPreferences: {
                partition: 'persist:whatsapp',
                contextIsolation: false,
            }
        });

        mainWindow.setBrowserView(view);
        view.setBounds({ x: 320, y: 10, width: 860, height: 780 });
        view.setAutoResize({ width: true, height: true });

        log('Loading WhatsApp URL...');
        view.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
        view.webContents.loadURL('https://web.whatsapp.com/');

        mainWindow.on('closed', () => {
            log('Main window closed.');
            mainWindow = null;
        });
        log('Main window created successfully.');
    } catch (error) {
        log(`!!! Error in createWindow: ${error.message}\n${error.stack}`);
        throw error;
    }
}

// WARNING: This function relies on accessing WhatsApp's internal 'Store' object.
// This is an undocumented, private API that can change at any time, which would
// break this functionality. This method is inherently fragile.
async function findUnsavedContacts(view) {
  try {
    const debuggerAttached = !view.webContents.debugger.isAttached();
    if (debuggerAttached) {
        await view.webContents.debugger.attach('1.3');
    }
    const script = `
      new Promise((resolve, reject) => {
        if (window.Store && window.Store.Contact) {
          const unsavedContacts = window.Store.Contact.models
            .filter(contact => !contact.isMyContact && contact.id.server === 'c.us')
            .map(contact => '+' + contact.id.user);
          resolve(unsavedContacts);
        } else {
          reject('WhatsApp Store not found. Is the page fully loaded?');
        }
      });
    `;
    const result = await view.webContents.debugger.sendCommand('Runtime.evaluate', {
      expression: script,
      awaitPromise: true,
      returnByValue: true
    });
    if (debuggerAttached) {
        await view.webContents.debugger.detach();
    }
    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception.description);
    }
    return result.result.value;
  } catch (err) {
    log(`!!! Error in findUnsavedContacts: ${err.message}`);
    if (view.webContents.debugger.isAttached()) {
      await view.webContents.debugger.detach();
    }
    throw err;
  }
}

ipcMain.handle('scan-contacts', async () => {
  log('Received scan-contacts request.');
  if (!view) {
    log('Scan failed: WhatsApp view is not available.');
    throw new Error('WhatsApp view is not available.');
  }
  return await findUnsavedContacts(view);
});

function convertToVCF(contacts) {
    return contacts.map(contact => `BEGIN:VCARD\nVERSION:3.0\nFN:${contact}\nTEL;TYPE=CELL:${contact}\nEND:VCARD`).join('\n');
}

function convertToCSV(contacts) {
    return `PhoneNumber\n${contacts.join('\n')}`;
}

ipcMain.on('export-file', (event, { contacts, format }) => {
    log(`Received export-file request for format: ${format}`);
    if (!mainWindow) return;

    let fileContent, defaultPath, filters;
    switch (format) {
        case 'json':
            fileContent = JSON.stringify(contacts, null, 2);
            defaultPath = 'unsaved_contacts.json';
            filters = [{ name: 'JSON Files', extensions: ['json'] }];
            break;
        case 'csv':
            fileContent = convertToCSV(contacts);
            defaultPath = 'unsaved_contacts.csv';
            filters = [{ name: 'CSV Files', extensions: ['csv'] }];
            break;
        case 'vcf':
            fileContent = convertToVCF(contacts);
            defaultPath = 'unsaved_contacts.vcf';
            filters = [{ name: 'VCF Files', extensions: ['vcf'] }];
            break;
        default: return;
    }

    dialog.showSaveDialog(mainWindow, {
        title: `Save Unsaved Contacts as ${format.toUpperCase()}`,
        defaultPath,
        filters
    }).then(result => {
        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, fileContent);
            log(`File saved to ${result.filePath}`);
        }
    }).catch(err => {
        log(`!!! Failed to save file: ${err.message}`);
    });
});

app.whenReady().then(() => {
    // Correctly initialize logging here
    logPath = path.join(app.getPath('userData'), 'app.log');
    log('App is ready.');

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            log('App activated, creating new window.');
            createWindow();
        }
    });
}).catch(error => {
    console.error(`!!! Error during app startup: ${error.message}\n${error.stack}`);
});

app.on('window-all-closed', () => {
    log('All windows closed.');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
