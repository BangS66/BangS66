const { app, BrowserWindow, BrowserView } = require('electron');
const path = require('path');
const fs = require('fs');
const { initializeLogger } = require('./utils/logger');

// Direktori untuk menyimpan sesi, agar tidak perlu login ulang
const userDataPath = path.join(app.getPath('userData'), 'session');
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

let mainWindow;
let whatsAppView;

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

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Buat BrowserView untuk WhatsApp Web
  whatsAppView = new BrowserView({
    webPreferences: {
      partition: `persist:whatsapp`,
    }
  });

  mainWindow.setBrowserView(whatsAppView);
  whatsAppView.setBounds({ x: 350, y: 0, width: 850, height: 800 });
  whatsAppView.setAutoResize({ width: true, height: true });
  whatsAppView.webContents.loadURL('https://web.whatsapp.com', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    whatsAppView = null;
  });
}

app.whenReady().then(() => {
  initializeLogger();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Mengintegrasikan logika scraper dan exporter
require('./scraper/scanner');
require('./utils/exporter');
