const { chromium } = require('playwright-core');
const { ipcMain, BrowserWindow } = require('electron');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { logger } = require('../utils/logger');

// Variabel state
let browser = null;
let page = null;
let isScanRunning = false;
let stopRequested = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fungsi ini akan disuntikkan dan dieksekusi di dalam konteks browser WhatsApp Web.
 * Tujuannya adalah untuk mengakses data model internal WhatsApp (Store) daripada mengandalkan DOM.
 */
async function extractContactsFromStore() {
    // Pastikan Store dan model Chat sudah dimuat oleh WhatsApp Web
    if (typeof window.Store === 'undefined' || typeof window.Store.Chat === 'undefined') {
        return { error: 'Store atau Store.Chat tidak ditemukan. Mungkin WhatsApp Web sedang memuat.' };
    }

    const chats = window.Store.Chat.models;
    if (!chats) {
        return { error: 'Model Chat tidak ditemukan di dalam Store.' };
    }

    const unsavedContacts = [];
    for (const chat of chats) {
        // Cara yang paling andal: periksa properti kontak secara langsung
        const contact = chat.contact;
        // Kita hanya tertarik pada obrolan individu, bukan grup, dan yang bukan kontak kita
        if (!chat.isGroup && contact && !contact.isMyContact && contact.id.server === 'c.us') {
            const phoneNumber = contact.id.user;
            unsavedContacts.push({
                id: contact.id._serialized,
                name: contact.name, // Biasanya null atau sama dengan nomor
                formattedName: contact.formattedName, // Biasanya nomor yang diformat
                number: phoneNumber,
            });
        }
    }
    return { contacts: unsavedContacts };
}


async function startScraping(mainWindow, options) {
    if (isScanRunning) return;
    isScanRunning = true;
    stopRequested = false;
    logger.info('Memulai pemindaian WhatsApp dengan metode injeksi Store...');

    try {
        mainWindow.webContents.send('scan-update', { message: 'Menghubungkan ke browser...' });
        browser = await chromium.connectOverCDP('http://localhost:9222');
        const waContext = browser.contexts().find(c => c.pages().some(p => p.url().includes('whatsapp.com')));
        if (!waContext) throw new Error('Konteks WhatsApp Web tidak ditemukan.');

        page = waContext.pages()[0];
        await page.bringToFront();

        mainWindow.webContents.send('scan-update', { message: 'Menunggu WhatsApp Web siap...' });
        // Tunggu hingga elemen UI utama muncul untuk memastikan halaman telah dimuat
        await page.waitForSelector('div[aria-label="Daftar obrolan"]', { timeout: 60000 });
        await delay(5000); // Beri waktu ekstra agar Store internal dimuat

        mainWindow.webContents.send('scan-update', { message: 'Mengekstrak data dari Store...' });
        const result = await page.evaluate(extractContactsFromStore);

        if (result.error) {
            throw new Error(result.error);
        }

        const contacts = result.contacts;
        mainWindow.webContents.send('scan-update', {
            message: `Ekstraksi selesai. Ditemukan ${contacts.length} kemungkinan kontak yang belum disimpan.`,
            processedChats: contacts.length
        });

        for (const contact of contacts) {
            if (stopRequested) break;
            const normalized = normalizePhoneNumber(`+${contact.number}`);
            if (normalized) {
                mainWindow.webContents.send('scan-result', {
                    original_text: contact.formattedName,
                    normalized_number: normalized,
                    chat_title: contact.formattedName,
                });
            }
        }

    } catch (error) {
        logger.error('Terjadi error saat scraping:', error);
        mainWindow.webContents.send('scan-error', { message: `Terjadi error: ${error.message}` });
    } finally {
        logger.info('Pemindaian selesai atau dihentikan.');
        isScanRunning = false;
        if (browser && browser.isConnected()) browser.disconnect();
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

// Helper untuk normalisasi, karena kita tidak bisa menggunakan libphonenumber-js di dalam browser
function normalizePhoneNumber(phoneNumber) {
    try {
        const parsed = parsePhoneNumberFromString(phoneNumber); // Asumsikan format internasional
        return (parsed && parsed.isValid()) ? parsed.format('E.164') : null;
    } catch (error) {
        return null;
    }
}
