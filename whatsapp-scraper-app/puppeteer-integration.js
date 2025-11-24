// File: puppeteer-integration.js
// Deskripsi: Mengelola peluncuran dan interaksi dengan browser Chromium menggunakan Puppeteer-Core.

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let browser = null;
let page = null;
const SESSION_DIR = path.join(app.getPath('userData'), 'session');

function getChromiumExecutablePath() {
    // 1. Prioritaskan Chromium yang dibundel
    const bundledPath = path.join(app.getAppPath(), 'chromium', 'chrome.exe'); // Sesuaikan untuk OS lain jika perlu
    if (fs.existsSync(bundledPath)) {
        return bundledPath;
    }

    // 2. Fallback ke lokasi instalasi Chrome yang umum (hanya Windows untuk sekarang)
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (fs.existsSync(chromePath)) {
        return chromePath;
    }

    return null; // Tidak ditemukan
}

async function launchWhatsApp(options = {}) {
    const executablePath = getChromiumExecutablePath();
    if (!executablePath) {
        console.error("Chromium tidak ditemukan. Silakan unduh dan letakkan di folder 'chromium' atau instal Google Chrome.");
        // Kirim pesan error ke UI di sini jika perlu
        return;
    }

    if (browser) await browser.close();

    const useSession = options.session || false;
    if (useSession && !fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    browser = await puppeteer.launch({
        executablePath,
        headless: false,
        userDataDir: useSession ? SESSION_DIR : undefined,
        args: ['--start-maximized'],
    });

    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
    await page.goto('https://web.whatsapp.com', {
        waitUntil: 'networkidle2',
    });

    browser.on('disconnected', () => {
        browser = null;
        page = null;
        // Mungkin ingin memberi tahu UI bahwa browser telah ditutup
    });
}

async function getPage() {
    return page;
}

async function closeBrowser() {
    if (browser) {
        await browser.close();
    }
}

module.exports = {
    launchWhatsApp,
    getPage,
    closeBrowser,
};
