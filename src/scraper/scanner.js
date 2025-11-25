const { chromium } = require('playwright-core');
const { ipcMain, BrowserWindow } = require('electron');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { logger } = require('../utils/logger');

// Variabel state
let browser = null;
let page = null;
let isScanRunning = false;
let stopRequested = false;

// --- SELEKTOR DOM BARU YANG LEBIH KUAT ---
const SELECTORS = {
    chatListContainer: 'div[aria-label="Daftar obrolan"]',
    chatListItem: 'div[role="listitem"]',
    chatTitle: 'span[title]', // Selektor yang lebih sederhana dan kuat untuk judul
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalizePhoneNumber(phoneNumber, defaultCountry = 'ID') {
    try {
        const parsed = parsePhoneNumberFromString(phoneNumber, defaultCountry);
        return (parsed && parsed.isValid()) ? parsed.format('E.164') : null;
    } catch (error) {
        logger.warn(`Gagal mem-parsing nomor: "${phoneNumber}"`);
        return null;
    }
}

function isUnsavedContact(chatTitle) {
    return /^[0-9\s+\-().]+$/.test(chatTitle.trim());
}

async function startScraping(mainWindow, options) {
    if (isScanRunning) return;
    isScanRunning = true;
    stopRequested = false;
    logger.info('Memulai pemindaian WhatsApp dengan logika baru...');
    const processedChatTitles = new Set();

    try {
        mainWindow.webContents.send('scan-update', { message: 'Menghubungkan ke browser...' });
        browser = await chromium.connectOverCDP('http://localhost:9222');
        const waContext = browser.contexts().find(c => c.pages().some(p => p.url().includes('whatsapp.com')));
        if (!waContext) throw new Error('Konteks WhatsApp Web tidak ditemukan.');

        page = waContext.pages()[0];
        await page.bringToFront();

        mainWindow.webContents.send('scan-update', { message: 'Mencari daftar obrolan...' });
        const chatListContainer = await page.waitForSelector(SELECTORS.chatListContainer, { timeout: 30000 });

        let stationaryScrolls = 0;

        while (!stopRequested) {
            const chatItems = await chatListContainer.locator(SELECTORS.chatListItem).all();
            mainWindow.webContents.send('scan-update', { message: `Memeriksa ${chatItems.length} obrolan yang terlihat...` });

            let newChatsFoundInCycle = false;

            for (const chatHandle of chatItems) {
                if (stopRequested) break;
                const titleHandle = chatHandle.locator(SELECTORS.chatTitle).first();
                const chatTitle = await titleHandle.getAttribute('title');

                if (chatTitle && !processedChatTitles.has(chatTitle)) {
                    newChatsFoundInCycle = true;
                    processedChatTitles.add(chatTitle);
                    mainWindow.webContents.send('scan-update', {
                        message: `Ditemukan: ${chatTitle}`,
                        processedChats: processedChatTitles.size,
                    });

                    if (isUnsavedContact(chatTitle)) {
                        const normalized = normalizePhoneNumber(chatTitle);
                        if (normalized) {
                            mainWindow.webContents.send('scan-result', {
                                original_text: chatTitle,
                                normalized_number: normalized,
                                chat_title: chatTitle,
                            });
                        }
                    }
                     await delay(options.delay_per_chat_ms);
                }
            }

            if (stopRequested) break;

            if (!newChatsFoundInCycle) {
                stationaryScrolls++;
                mainWindow.webContents.send('scan-update', { message: `Tidak ada obrolan baru ditemukan (${stationaryScrolls}/3)` });
                if (stationaryScrolls >= 3) {
                     mainWindow.webContents.send('scan-update', { message: 'Selesai menggulir, semua obrolan telah dipindai.' });
                    break;
                }
            } else {
                stationaryScrolls = 0;
            }

            mainWindow.webContents.send('scan-update', { message: 'Menggulir ke bawah...' });
            await page.mouse.move(50, 300); // Pindahkan mouse ke atas daftar obrolan
            await page.mouse.wheel(0, 800); // Gulir ke bawah dengan jumlah piksel yang signifikan
            await delay(2000);
        }

    } catch (error) {
        logger.error('Terjadi error saat scraping:', error);
        mainWindow.webContents.send('scan-error', { message: `Terjadi error: ${error.message}` });
    } finally {
        logger.info('Pemindaian selesai atau dihentikan.');
        isScanRunning = false;
        if (browser && browser.isConnected()) browser.close();
        mainWindow.webContents.send('scan-complete');
    }
}

ipcMain.on('start-scan', (event, options) => {
    startScraping(BrowserWindow.fromWebContents(event.sender), options);
});

ipcMain.on('stop-scan', () => {
    if (isScanRunning) {
        logger.info('Permintaan berhenti diterima.');
        stopRequested = true;
    }
});
