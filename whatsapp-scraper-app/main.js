const { app, BrowserWindow, BrowserView, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let view;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools();

  const customSession = session.fromPartition('whatsapp', { cache: false });

  view = new BrowserView({
      webPreferences: {
          session: customSession,
      }
  });

  mainWindow.setBrowserView(view);
  view.setBounds({ x: 250, y: 0, width: 950, height: 800 });
  view.setAutoResize({ width: true, height: true });
  view.webContents.loadURL('https://web.whatsapp.com', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('start-scan', async (event, args) => {
    try {
        const scraperScript = fs.readFileSync(path.join(__dirname, 'scraper.js'), 'utf8');
        // The scrapeContacts function is defined inside scraper.js
// We execute the script in the BrowserView's context
        const results = await view.webContents.executeJavaScript(`
            (${scraperScript});
            scrapeContacts();
        `);
        // Backup the results
        const backupPath = path.join(app.getPath('userData'), `whatsapp-contacts-backup-${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(results, null, 2));
        console.log(`Backup saved to ${backupPath}`);

        event.reply('scan-complete', results);
    } catch (err) {
        console.error('Scraping failed:', err);
        event.reply('scan-error', err.message);
    }
});

ipcMain.on('export-csv', async (event, contacts) => {
    const { filePath } = await dialog.showSaveDialog({
        title: 'Save Contacts as CSV',
        defaultPath: `whatsapp-contacts-${Date.now()}.csv`,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (filePath) {
        let csvContent = 'Phone,Chat Name,Saved Contact\n';
        contacts.forEach(contact => {
            csvContent += `${contact.phone},"${contact.chatName.replace(/"/g, '""')}",${contact.isSaved ? 'Yes' : 'No'}\n`;
        });
        fs.writeFileSync(filePath, csvContent);
    }
});

ipcMain.on('export-txt', async (event, contacts) => {
    const { filePath } = await dialog.showSaveDialog({
        title: 'Save Contacts as TXT',
        defaultPath: `whatsapp-contacts-${Date.now()}.txt`,
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (filePath) {
        let txtContent = '';
        contacts.forEach(contact => {
            txtContent += `${contact.phone}\n`;
        });
        fs.writeFileSync(filePath, txtContent);
    }
});

ipcMain.on('scan-selected', async (event, args) => {
    try {
        const scraperScript = fs.readFileSync(path.join(__dirname, 'scraper_active.js'), 'utf8');
        const results = await view.webContents.executeJavaScript(`
            (${scraperScript});
            scrapeActiveChat();
        `);
        event.reply('scan-complete', results);
    } catch (err) {
        console.error('Scraping failed:', err);
        event.reply('scan-error', err.message);
    }
});
