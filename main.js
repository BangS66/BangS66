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

        // A hidden window will be used to load WhatsApp Web
        view = new BrowserWindow({
            show: false, // Hide this window
            webPreferences: {
                partition: 'persist:whatsapp',
                contextIsolation: true, // Re-enable for security
                // Preload script for the hidden window to access window.Store
                preload: path.join(__dirname, 'wa_preload.js')
            }
        });

        view.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
        view.loadURL('https://web.whatsapp.com/');

        // Optionally, show this window for debugging the QR code scan
        // view.show();
        // view.webContents.openDevTools();

        // Monitor the WhatsApp window's title to detect login state
        let isLoggedIn = false;
        view.webContents.on('page-title-updated', (event, title) => {
            if (title === 'WhatsApp' && !isLoggedIn) {
                isLoggedIn = true;
                mainWindow.webContents.send('status-update', 'Logged In');
                log('User is logged in.');
            } else if (title !== 'WhatsApp' && isLoggedIn) {
                isLoggedIn = false;
                mainWindow.webContents.send('status-update', 'Logged Out');
                log('User is logged out.');
            }
        });

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
// Helper function to execute a script in the hidden WhatsApp window
async function executeInWhatsApp(script) {
    // Note: The BrowserView is now a hidden BrowserWindow instance
    if (!view || view.isDestroyed()) {
        throw new Error('WhatsApp window is not available.');
    }
    // The preload script 'wa_preload.js' exposes the 'waAPI' object.
    return await view.webContents.executeJavaScript(`window.waAPI.execute(\`${script}\`)`);
}


// --- IPC Handlers ---

ipcMain.handle('fetch-groups', async () => {
    log('Received fetch-groups request.');
    const script = `
        return window.Store.Chat.models
            .filter(chat => chat.isGroup)
            .map(group => ({ id: group.id._serialized, name: group.name }));
    `;
    return await executeInWhatsApp(script);
});

ipcMain.handle('scrape-group-members', async (event, groupId) => {
    log(`Received scrape-group-members request for group: ${groupId}`);
    const script = `
        const group = window.Store.Chat.get('${groupId}');
        if (!group || !group.participants) {
            throw new Error('Group not found or has no participants.');
        }
        return group.participants.map(p => ({
            id: p.id._serialized,
            number: '+' + p.id.user
        }));
    `;
    // The result from scraping is just the numbers
    const members = await executeInWhatsApp(script);
    return members.map(m => m.number);
});

ipcMain.handle('scan-contacts', async (event, { startDate, endDate }) => {
    log(`Received scan-contacts request with dates: ${startDate} - ${endDate}`);

    // Timestamps are in seconds, so convert dates.
    const startTimestamp = startDate ? new Date(startDate).getTime() / 1000 : null;
    const endTimestamp = endDate ? new Date(endDate).getTime() / 1000 : null;

    const script = `
        const chats = window.Store.Chat.models;
        const unsavedContacts = new Map();
        const start = ${startTimestamp};
        const end = ${endTimestamp};

        chats.forEach(chat => {
            // Only check chats with unsaved contacts
            if (!chat.contact || chat.contact.isMyContact !== false || chat.id.server !== 'c.us') {
                return;
            }

            let chatHasActivityInRange = false;

            // If no dates are set, the chat is automatically considered active.
            if (!start && !end) {
                chatHasActivityInRange = true;
            } else {
                // Otherwise, check all messages to see if any fall within the date range.
                for (const msg of chat.msgs.models) {
                    const msgTimestamp = msg.t;
                    const isAfterStart = !start || msgTimestamp >= start;
                    const isBeforeEnd = !end || msgTimestamp <= end;

                    if (isAfterStart && isBeforeEnd) {
                        chatHasActivityInRange = true;
                        break; // Found a message in range, no need to check further.
                    }
                }
            }

            if (chatHasActivityInRange) {
                const number = '+' + chat.id.user;
                if (!unsavedContacts.has(number)) {
                    unsavedContacts.set(number, {});
                }
            }
        });

        return Array.from(unsavedContacts.keys());
    `;

    return await executeInWhatsApp(script);
});


// Helper function to convert data to VCF with a custom prefix
function convertToVCF(contacts, prefix) {
    return contacts.map((contact, index) => {
        const contactName = `${prefix} ${String(index + 1).padStart(2, '0')}`;
        return `BEGIN:VCARD
VERSION:3.0
FN:${contactName}
TEL;TYPE=CELL:${contact}
END:VCARD`;
    }).join('\n');
}

// Helper function to convert data to CSV with a custom prefix
function convertToCSV(contacts, prefix) {
    const header = 'Name,PhoneNumber';
    const rows = contacts.map((contact, index) => {
        const contactName = `${prefix} ${String(index + 1).padStart(2, '0')}`;
        return `${contactName},${contact}`;
    }).join('\n');
    return `${header}\n${rows}`;
}


ipcMain.on('export-file', (event, { contacts, prefix, format }) => {
    log(`Received export-file request for format: ${format} with prefix: ${prefix}`);
    if (!mainWindow) return;

    let fileContent, defaultPath, filters;
    switch (format) {
        case 'json':
            // JSON format just saves the numbers, no need for prefix.
            fileContent = JSON.stringify(contacts, null, 2);
            defaultPath = 'exported_contacts.json';
            filters = [{ name: 'JSON Files', extensions: ['json'] }];
            break;
        case 'csv':
            fileContent = convertToCSV(contacts, prefix);
            defaultPath = 'exported_contacts.csv';
            filters = [{ name: 'CSV Files', extensions: ['csv'] }];
            break;
        case 'vcf':
            fileContent = convertToVCF(contacts, prefix);
            defaultPath = 'exported_contacts.vcf';
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
