// File: main.js
// Deskripsi: Titik masuk utama untuk aplikasi Electron.
// Mengelola jendela utama dan komunikasi IPC dengan Puppeteer.

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let browserHandler;

try {
    browserHandler = require('./browser.js');
} catch (error) {
    dialog.showErrorBox(
        'Critical Error',
        'A critical file is missing: browser.js. The application cannot start.\n\n' +
        'Please try reinstalling the application.\n\n' +
        `Error details: ${error.message}`
    );
    app.quit();
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 400, // Hanya lebar sidebar
        height: 900,
        icon: path.join(__dirname, 'build', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    createMainWindow();
    // Secara default, mulai tanpa sesi. Pengguna dapat memilih untuk menggunakan sesi.
    browserHandler.launchWhatsApp({ session: false });
});

app.on('window-all-closed', () => {
    browserHandler.closeBrowser().then(() => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
});

app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    }
});

// --- Handler IPC ---

ipcMain.on('use-session', (event, use) => {
    mainWindow.webContents.send('log-message', `WhatsApp akan dimulai ulang untuk ${use ? 'menggunakan' : 'menghapus'} sesi.`);
    browserHandler.launchWhatsApp({ session: use });
});

ipcMain.on('clear-session', (event) => {
    browserHandler.clearSessionData().then(() => {
        mainWindow.webContents.send('log-message', 'Sesi dihapus. WhatsApp akan dimulai ulang.');
        browserHandler.launchWhatsApp({ session: false });
    }).catch(err => {
        mainWindow.webContents.send('log-message', `Gagal menghapus sesi: ${err.message}`);
    });
});

ipcMain.on('start-scan', async (event, options) => {
    const page = await browserHandler.getPage();
    if (!page) {
        return mainWindow.webContents.send('scan-error', 'Browser WhatsApp tidak siap.');
    }

    try {
        await page.exposeFunction('reportProgressToMain', (progressData) => {
            mainWindow.webContents.send('scan-progress', progressData);
        });

        const scannerScript = fs.readFileSync(path.join(__dirname, 'scanner.js'), 'utf8');

        const results = await page.evaluate(`
            async () => {
                // Mendefinisikan ulang fungsi di dalam konteks evaluate
                ${scannerScript}
                return await scanAllChats(${JSON.stringify(options)});
            }
        `);

        mainWindow.webContents.send('scan-complete', results);

    } catch (err) {
        console.error('Gagal menjalankan skrip pemindaian:', err.message);
        mainWindow.webContents.send('scan-error', `Gagal menjalankan skrip: ${err.message}`);
    }
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

ipcMain.on('export-csv', (event, data) => handleExport(data, 'csv'));
ipcMain.on('export-json', (event, data) => handleExport(data, 'json'));
ipcMain.on('export-txt', (event, data) => handleExport(data, 'txt'));
