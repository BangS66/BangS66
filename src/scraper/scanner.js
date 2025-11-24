const { chromium } = require('playwright-core');
const { ipcMain, BrowserWindow } = require('electron');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const logger = require('../utils/logger'); // Akan dibuat di langkah selanjutnya

// Variabel state
let browser = null;
let page = null;
let isScanRunning = false;
let stopRequested = false;

// Selektor DOM WhatsApp Web (bisa berubah, penting untuk dokumentasi)
const SELECTORS = {
    chatList: '#pane-side > div > div > div > div', // Area scroll daftar chat
    chatListItem: 'div[role="listitem"]',      // Setiap item dalam daftar chat
    chatTitle: 'span[dir="auto"][title]',       // Judul chat (nama/nomor)
    messageContent: 'div.copyable-text',        // Kontainer pesan
    unreadBadge: 'span[data-testid="icon-unread-count-in-list"]', // Badge belum dibaca
};

const PHONE_REGEX = /(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?[\d\s.-]{7,}/g;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalizePhoneNumber(phoneNumber, defaultCountry = 'ID') {
    try {
        const parsed = parsePhoneNumberFromString(phoneNumber, defaultCountry);
        if (parsed && parsed.isValid()) {
            return parsed.format('E.164');
        }
        return null;
    } catch (error) {
        logger.warn(`Could not parse phone number "${phoneNumber}": ${error.message}`);
        return null;
    }
}

function isUnsavedContact(chatTitle) {
    return /^[0-9\s+\-().]+$/.test(chatTitle.trim());
}

async function startScraping(mainWindow, options) {
    if (isScanRunning) {
        return mainWindow.webContents.send('scan-error', { message: 'Scan sudah berjalan.' });
    }
    isScanRunning = true;
    stopRequested = false;
    logger.info('Starting WhatsApp scan with options:', options);

    try {
        mainWindow.webContents.send('scan-update', { message: 'Menghubungkan ke browser...' });
        browser = await chromium.connectOverCDP('http://localhost:9222');
        const contexts = browser.contexts();
        const waContext = contexts.find(c => c.pages().some(p => p.url().includes('whatsapp.com')));

        if (!waContext) {
            throw new Error('Konteks WhatsApp Web tidak ditemukan. Pastikan sudah login.');
        }
        page = waContext.pages()[0]; // Ambil halaman WhatsApp yang sudah ada
        await page.bringToFront();

        mainWindow.webContents.send('scan-update', { message: 'Mencari daftar chat...' });
        await page.waitForSelector(SELECTORS.chatList, { timeout: 30000 });

        const chatItems = await page.$$(SELECTORS.chatListItem);
        const totalChats = options.max_chats_to_scan > 0 ? Math.min(chatItems.length, options.max_chats_to_scan) : chatItems.length;

        logger.info(`Found ${chatItems.length} chats. Will process ${totalChats}.`);
        mainWindow.webContents.send('scan-update', { message: `Menemukan ${totalChats} chat. Memulai pemindaian...`, totalChats: totalChats, processedChats: 0 });

        for (let i = 0; i < totalChats; i++) {
            if (stopRequested) {
                logger.info('Scan stopped by user.');
                mainWindow.webContents.send('scan-update', { message: 'Pemindaian dihentikan.' });
                break;
            }

            const chatHandle = chatItems[i];
            let chatTitle = 'N/A';
            let contactData = null;

            try {
                await chatHandle.click();
                await delay(options.delay_per_chat_ms);

                const titleHandle = await chatHandle.$(SELECTORS.chatTitle);
                if (titleHandle) {
                    chatTitle = await titleHandle.getAttribute('title');
                }

                mainWindow.webContents.send('scan-update', {
                    message: `Memproses chat: ${chatTitle}`,
                    totalChats: totalChats,
                    processedChats: i + 1,
                });

                if (isUnsavedContact(chatTitle)) {
                    const normalized = normalizePhoneNumber(chatTitle);
                    if (normalized) {
                        contactData = {
                            original_text: chatTitle,
                            normalized_number: normalized,
                            chat_title: chatTitle,
                            chat_type: 'Direct',
                            is_group: false,
                        };
                        mainWindow.webContents.send('scan-result', contactData);
                    }
                }
                // TODO: Tambahkan heuristik untuk mengambil nomor dari pesan jika judul bukan nomor

            } catch (err) {
                logger.error(`Failed to process chat #${i} (${chatTitle}): ${err.message}`);
            }
        }
    } catch (error) {
        logger.error('An error occurred during scraping:', error);
        mainWindow.webContents.send('scan-error', { message: `Terjadi error: ${error.message}` });
    } finally {
        logger.info('Scan finished or was stopped.');
        isScanRunning = false;
        stopRequested = false;
        if (browser) {
            browser.close(); // Cukup close koneksi, jangan tutup browsernya
            browser = null;
        }
        mainWindow.webContents.send('scan-complete');
    }
}

ipcMain.on('start-scan', (event, options) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    startScraping(mainWindow, options);
});

ipcMain.on('stop-scan', () => {
    if (isScanRunning) {
        logger.info('Stop request received.');
        stopRequested = true;
    }
});
