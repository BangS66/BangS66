const { chromium } = require('playwright-core');
const { ipcMain, BrowserWindow } = require('electron');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { logger } = require('../utils/logger');

// Variabel state
let browser = null;
let page = null;
let isScanRunning = false;
let stopRequested = false;

// Selektor DOM WhatsApp Web
const SELECTORS = {
    chatListContainer: '#pane-side', // Kontainer utama yang bisa digulir
    chatListItem: 'div[role="listitem"]',
    chatTitle: 'span[dir="auto"][title]',
};

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

    const processedChatTitles = new Set();

    try {
        mainWindow.webContents.send('scan-update', { message: 'Menghubungkan ke browser...' });
        browser = await chromium.connectOverCDP('http://localhost:9222');
        const waContext = browser.contexts().find(c => c.pages().some(p => p.url().includes('whatsapp.com')));

        if (!waContext) {
            throw new Error('Konteks WhatsApp Web tidak ditemukan. Pastikan sudah login.');
        }
        page = waContext.pages()[0];
        await page.bringToFront();

        mainWindow.webContents.send('scan-update', { message: 'Mencari daftar chat...' });
        await page.waitForSelector(SELECTORS.chatListContainer, { timeout: 30000 });

        let lastProcessedCount = 0;
        let stationaryScrolls = 0;

        while (!stopRequested) {
            if (options.max_chats_to_scan > 0 && processedChatTitles.size >= options.max_chats_to_scan) {
                logger.info(`Batas pemindaian tercapai: ${options.max_chats_to_scan}`);
                mainWindow.webContents.send('scan-update', { message: `Batas ${options.max_chats_to_scan} chat tercapai.` });
                break;
            }

            const chatItems = await page.$$(SELECTORS.chatListItem);

            for (const chatHandle of chatItems) {
                if (stopRequested) break;

                let chatTitle = 'N/A';
                try {
                    const titleHandle = await chatHandle.$(SELECTORS.chatTitle);
                    if (titleHandle) {
                        chatTitle = await titleHandle.getAttribute('title');

                        if (!processedChatTitles.has(chatTitle)) {
                            processedChatTitles.add(chatTitle);
                             mainWindow.webContents.send('scan-update', {
                                message: `Ditemukan: ${chatTitle}`,
                                processedChats: processedChatTitles.size,
                            });
                            await delay(options.delay_per_chat_ms); // Delay kecil antar pemrosesan

                            if (isUnsavedContact(chatTitle)) {
                                const normalized = normalizePhoneNumber(chatTitle);
                                if (normalized) {
                                    const contactData = {
                                        original_text: chatTitle,
                                        normalized_number: normalized,
                                        chat_title: chatTitle,
                                        chat_type: 'Direct',
                                        is_group: false,
                                    };
                                    mainWindow.webContents.send('scan-result', contactData);
                                }
                            }
                        }
                    }
                } catch (err) {
                    logger.error(`Gagal memproses chat (${chatTitle}): ${err.message}`);
                }
            }
             if (stopRequested) break;

            mainWindow.webContents.send('scan-update', { message: 'Menggulir ke bawah...' });
            await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                if (element) element.scrollTop = element.scrollHeight;
            }, SELECTORS.chatListContainer);

            await delay(2000); // Tunggu konten baru dimuat

            if (processedChatTitles.size === lastProcessedCount) {
                stationaryScrolls++;
                if (stationaryScrolls >= 3) {
                    logger.info('Akhir dari daftar chat tercapai.');
                    mainWindow.webContents.send('scan-update', { message: 'Selesai menggulir, semua chat telah dipindai.' });
                    break;
                }
            } else {
                stationaryScrolls = 0;
            }
            lastProcessedCount = processedChatTitles.size;
        }
    } catch (error) {
        logger.error('Terjadi error saat scraping:', error);
        mainWindow.webContents.send('scan-error', { message: `Terjadi error: ${error.message}` });
    } finally {
        logger.info('Pemindaian selesai atau dihentikan.');
        isScanRunning = false;
        stopRequested = false;
        if (browser && browser.isConnected()) {
            browser.close();
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
        logger.info('Permintaan berhenti diterima.');
        stopRequested = true;
    }
});
