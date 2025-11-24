const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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
  // mainWindow.webContents.openDevTools(); // Uncomment untuk debug UI

  // Buat BrowserView untuk WhatsApp Web
  whatsAppView = new BrowserView({
    webPreferences: {
      partition: `persist:whatsapp`, // Ini kunci untuk session persistence
    }
  });

  mainWindow.setBrowserView(whatsAppView);
  whatsAppView.setBounds({ x: 350, y: 0, width: 850, height: 800 });
  whatsAppView.setAutoResize({ width: true, height: true });
  whatsAppView.webContents.loadURL('https://web.whatsapp.com', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
  });

  // Uncomment untuk debug WhatsApp Web view
  // whatsAppView.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
    whatsAppView = null;
  });
}

app.whenReady().then(createWindow);

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

// Mengintegrasikan logika scraper. Cukup dengan me-require file tersebut,
// karena event listener IPC sudah di-setup di dalamnya.
require('./scraper/scanner');
require('./utils/exporter'); // Menambahkan handler untuk ekspor
