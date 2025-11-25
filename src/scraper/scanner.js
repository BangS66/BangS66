const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { logger } = require('../utils/logger');

let isScanRunning = false;

// Fungsi ini akan dievaluasi di dalam konteks renderer WhatsApp (BrowserView)
// Ini tidak akan memiliki akses ke scope Node.js, jadi harus mandiri.
const SCRIPT_TO_INJECT = `
    (async function() {
        if (typeof window.Store === 'undefined') {
            return { error: 'Objek window.Store tidak ditemukan. WhatsApp Web mungkin belum sepenuhnya dimuat atau strukturnya telah berubah.' };
        }
        if (typeof window.Store.Chat === 'undefined') {
            return { error: 'Objek window.Store.Chat tidak ditemukan. API internal WhatsApp mungkin telah diperbarui.' };
        }
        if (typeof window.Store.Chat.models === 'undefined') {
             return { error: 'Objek window.Store.Chat.models tidak ditemukan. Struktur data chat telah berubah.' };
        }

        const chats = window.Store.Chat.models;
        const unsavedContacts = [];

        for (const chat of chats) {
            const contact = chat.contact;
            if (!chat.isGroup && contact && !contact.isMyContact && contact.id.server === 'c.us') {
                unsavedContacts.push({
                    id: contact.id._serialized,
                    name: contact.name,
                    formattedName: contact.formattedName,
                    number: contact.id.user,
                });
            }
        }
        return { contacts: unsavedContacts };
    })();
`;

/**
 * Memulai proses pemindaian menggunakan Electron Debugger API.
 * @param {BrowserWindow} mainWindow - Jendela utama untuk mengirim update.
 * @param {WebContents} waWebContents - WebContents dari BrowserView WhatsApp.
 */
async function startScraping(mainWindow, waWebContents) {
    if (isScanRunning) {
        logger.warn('Pemindaian sudah berjalan.');
        return;
    }
    isScanRunning = true;
    logger.info('Memulai pemindaian WhatsApp dengan Electron Debugger API...');

    try {
        // 1. Pasang debugger ke target (BrowserView)
        waWebContents.debugger.attach('1.3');
        mainWindow.webContents.send('scan-update', { message: 'Debugger terpasang. Menunggu WhatsApp Web siap...' });

        // 2. Tunggu hingga Store WhatsApp siap
        // Kita lakukan ini dengan mencoba mengevaluasi skrip secara berkala
        await waitForWhatsAppStore(waWebContents);
        mainWindow.webContents.send('scan-update', { message: 'Store WhatsApp ditemukan. Mengekstrak kontak...' });

        // 3. Jalankan skrip utama untuk ekstraksi
        const result = await waWebContents.debugger.sendCommand('Runtime.evaluate', {
            expression: SCRIPT_TO_INJECT,
            awaitPromise: true,
            returnByValue: true
        });

        if (result.exceptionDetails) {
            throw new Error(`Error saat eksekusi skrip: ${result.exceptionDetails.text}`);
        }

        const extractedData = result.result.value;
        if (extractedData.error) {
            throw new Error(extractedData.error);
        }

        const contacts = extractedData.contacts || [];
        mainWindow.webContents.send('scan-update', {
            message: `Ekstraksi selesai. Ditemukan ${contacts.length} kontak.`,
            processedChats: contacts.length
        });

        // 4. Proses dan kirim hasil ke UI
        for (const contact of contacts) {
            const normalized = normalizePhoneNumber(`+${contact.number}`);
            if (normalized) {
                mainWindow.webContents.send('scan-result', {
                    original_text: contact.formattedName,
                    normalized_number: normalized,
                    chat_title: contact.formattedName || contact.number,
                });
            }
        }
    } catch (error) {
        logger.error('Terjadi error saat scraping:', error);
        mainWindow.webContents.send('scan-error', { message: `Error: ${error.message}` });
    } finally {
        if (waWebContents.debugger.isAttached()) {
            waWebContents.debugger.detach();
        }
        isScanRunning = false;
        logger.info('Pemindaian selesai, debugger dilepas.');
        mainWindow.webContents.send('scan-complete');
    }
}

// Helper untuk menunggu Store siap
async function waitForWhatsAppStore(webContents) {
    let storeReady = false;
    const startTime = Date.now();
    const timeout = 60000; // 60 detik

    while (!storeReady && (Date.now() - startTime) < timeout) {
        try {
            const result = await webContents.debugger.sendCommand('Runtime.evaluate', {
                expression: 'typeof window.Store !== "undefined" && typeof window.Store.Chat !== "undefined"',
                returnByValue: true
            });
            if (result.result.value === true) {
                storeReady = true;
                return;
            }
        } catch (err) {
            // Abaikan error jika debugger belum siap atau halaman sedang navigasi
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Tunggu 2 detik sebelum mencoba lagi
    }

    if (!storeReady) {
        throw new Error('Timeout: Gagal mendeteksi Store WhatsApp setelah 60 detik.');
    }
}

function normalizePhoneNumber(phoneNumber) {
    try {
        const parsed = parsePhoneNumberFromString(phoneNumber);
        return (parsed && parsed.isValid()) ? parsed.format('E.164') : null;
    } catch (error) {
        logger.warn(`Gagal normalisasi nomor: ${phoneNumber}`);
        return null;
    }
}

module.exports = {
    startScraping
};
