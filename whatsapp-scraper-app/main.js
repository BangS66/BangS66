// File: main.js
// Deskripsi: Titik masuk utama untuk aplikasi Electron.
// Mengelola jendela utama, BrowserView untuk WhatsApp Web, dan komunikasi IPC.

const { app, BrowserWindow, BrowserView, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let whatsAppView;
const SESSIONS_DIR = path.join(app.getPath('userData'), 'sessions');

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        icon: path.join(__dirname, 'build', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Muat UI aplikasi
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // Buka DevTools untuk debugging (opsional)
    // mainWindow.webContents.openDevTools();

    mainWindow.on('ready-to-show', () => {
        setupWhatsAppView();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function setupWhatsAppView(partition = null) {
    if (whatsAppView) {
        mainWindow.removeBrowserView(whatsAppView);
        whatsAppView.webContents.destroy();
        whatsAppView = null;
    }

    const viewSession = partition ? session.fromPartition(partition) : session.defaultSession;

    whatsAppView = new BrowserView({
        webPreferences: {
            // preload: path.join(__dirname, 'preload_whatsapp.js'), // Dihapus sementara untuk pengujian
            session: viewSession,
            // Keamanan tambahan
            nodeIntegration: false,
            contextIsolation: true,
            javascript: true,
            plugins: false,
            webSecurity: true,
        }
    });

    mainWindow.setBrowserView(whatsAppView);

    const contentBounds = mainWindow.getContentBounds();
    whatsAppView.setBounds({ x: 400, y: 0, width: contentBounds.width - 400, height: contentBounds.height });
    whatsAppView.setAutoResize({ width: true, height: true, horizontal: true, vertical: true });

    whatsAppView.webContents.loadURL('https://web.whatsapp.com', {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
    });

    // Pantau crash dan kegagalan muat
    whatsAppView.webContents.on('crashed', (event, killed) => {
        console.error(`BrowserView CRASHED: ${killed ? 'killed' : 'crashed'}`);
        mainWindow.webContents.send('log-message', 'ERROR: WhatsApp view crashed. Please restart the application.');
    });

    whatsAppView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error(`BrowserView FAILED TO LOAD: ${errorCode} ${errorDescription}`);
    });

    // Pantau pembaruan judul untuk laporan progres
    whatsAppView.webContents.on('page-title-updated', (event, title) => {
        if (title.startsWith('WA_SCAN_PROGRESS::')) {
            try {
                const data = JSON.parse(title.substring('WA_SCAN_PROGRESS::'.length));
                mainWindow.webContents.send('scan-progress', data);
            } catch (e) {
                console.error('Failed to parse progress update from title:', e);
            }
        }
    });

    // Buka DevTools untuk debugging WhatsApp View (opsional)
    // whatsAppView.webContents.openDevTools({ mode: 'detach' });
}

app.on('ready', createMainWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    }
});

// Handler IPC
ipcMain.on('use-session', (event, use) => {
    const partition = use ? `persist:whatsapp_session` : null;
    setupWhatsAppView(partition);
});

ipcMain.on('clear-session', (event) => {
    const persistentSession = session.fromPartition('persist:whatsapp_session');
    persistentSession.clearStorageData().then(() => {
        setupWhatsAppView(null); // Kembali ke sesi default
        event.reply('session-cleared', 'Sesi berhasil dihapus. Silakan scan QR code lagi.');
    }).catch(err => {
        console.error('Gagal menghapus sesi:', err);
        event.reply('log-message', `Error: Gagal menghapus sesi - ${err.message}`);
    });
});

ipcMain.on('scan-progress', (event, progressData) => {
    if (mainWindow) {
        mainWindow.webContents.send('scan-progress', progressData);
    }
});

ipcMain.on('export-csv', (event, data) => {
    handleExport(data, 'csv');
});

ipcMain.on('export-json', (event, data) => {
    handleExport(data, 'json');
});

ipcMain.on('export-txt', (event, data) => {
    handleExport(data, 'txt');
});

async function handleExport(data, format) {
    if (!data || data.length === 0) {
        mainWindow.webContents.send('log-message', 'Tidak ada data untuk diekspor.');
        return;
    }

    const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: `Ekspor Sebagai ${format.toUpperCase()}`,
        defaultPath: path.join(app.getPath('downloads'), `whatsapp_contacts_${Date.now()}.${format}`),
        filters: [{ name: `${format.toUpperCase()} Files`, extensions: [format] }]
    });

    if (filePath) {
        let content;
        switch (format) {
            case 'csv':
                const header = 'Name,Phone,ChatType,LastMessage,Timestamp\n';
                const rows = data.map(d => `"${d.name}","${d.phone}","${d.chatType}","${d.lastMessage.replace(/"/g, '""')}","${d.timestamp}"`);
                content = header + rows.join('\n');
                break;
            case 'json':
                content = JSON.stringify(data, null, 2);
                break;
            case 'txt':
                content = data.map(d => d.phone).join('\n');
                break;
        }

        try {
            fs.writeFileSync(filePath, content);
            // Simpan juga salinan ke folder exports
            const exportsDir = path.join(__dirname, 'exports');
            if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir);
            fs.writeFileSync(path.join(exportsDir, path.basename(filePath)), content);

            mainWindow.webContents.send('log-message', `Data berhasil diekspor ke ${filePath}`);
        } catch (err) {
            console.error('Gagal menyimpan file ekspor:', err);
            mainWindow.webContents.send('log-message', `Error: Gagal menyimpan file - ${err.message}`);
        }
    }
}

ipcMain.on('start-scan', async (event, options) => {
    if (!whatsAppView) {
        return event.reply('scan-error', 'WhatsApp view tidak siap.');
    }

    try {
        const scannerScript = fs.readFileSync(path.join(__dirname, 'scanner.js'), 'utf8');

        // Jalankan fungsi scan utama
        const results = await whatsAppView.webContents.executeJavaScript(`
            (${scannerScript});
            scanAllChats(${JSON.stringify(options)});
        `);

        event.reply('scan-complete', results);

    } catch (err) {
        console.error('Gagal menjalankan skrip pemindaian:', err);
        event.reply('scan-error', `Gagal menjalankan skrip: ${err.message}`);
    }
});
