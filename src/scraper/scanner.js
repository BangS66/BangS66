const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { logger } = require('../utils/logger');

let isScanRunning = false;

// Skrip ini akan mencari Store WhatsApp di beberapa lokasi yang memungkinkan
// dan menggunakan yang pertama kali ditemukan.
const SCRIPT_TO_INJECT = `
    (async function() {
        // Fungsi helper untuk menemukan Store
        const findStore = () => {
            if (window.Store) {
                return window.Store;
            }
            if (window.WWebJS && window.WWebJS.store) {
                return window.WWebJS.store;
            }
            // Tambahkan kandidat lain di sini jika ditemukan di masa depan
            // Contoh: if (window.SomeOtherObject && window.SomeOtherObject.Chat) return window.SomeOtherObject;

            // Coba cari secara manual di window
            for (const key in window) {
                if (window.hasOwnProperty(key)) {
                    const prop = window[key];
                    if (typeof prop === 'object' && prop !== null && prop.Chat && prop.Chat.models) {
                        return prop;
                    }
                }
            }
            return null;
        };

        const Store = findStore();

        if (!Store || !Store.Chat || !Store.Chat.models) {
            return { error: 'Gagal menemukan data store WhatsApp. Strukturnya mungkin telah berubah secara signifikan.' };
        }

        const chats = Store.Chat.models;
        const unsavedContacts = [];

        for (const chat of chats) {
            const contact = chat.contact;
            // Hanya ambil kontak individu yang belum disimpan
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
        // 1. Pasang debugger
        if (!waWebContents.debugger.isAttached()) {
            waWebContents.debugger.attach('1.3');
        }
        mainWindow.webContents.send('scan-update', { message: 'Debugger terpasang. Menunggu WhatsApp Web...' });

        // 2. Tunggu hingga UI WhatsApp siap
        await waitForWhatsAppUI(waWebContents);
        mainWindow.webContents.send('scan-update', { message: 'UI siap. Mengekstrak kontak...' });

        // 3. Jalankan skrip ekstraksi
        const result = await waWebContents.debugger.sendCommand('Runtime.evaluate', {
            expression: SCRIPT_TO_INJECT,
            awaitPromise: true,
            returnByValue: true
        });

        if (result.exceptionDetails) {
            throw new Error(`Error eksekusi skrip: ${result.exceptionDetails.text}`);
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

        // 4. Proses dan kirim hasil
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
        logger.info('Pemindaian selesai.');
        mainWindow.webContents.send('scan-complete');
    }
}

// Helper untuk menunggu UI WhatsApp siap
async function waitForWhatsAppUI(webContents) {
    const startTime = Date.now();
    const timeout = 60000;

    while ((Date.now() - startTime) < timeout) {
        try {
            const result = await webContents.debugger.sendCommand('Runtime.evaluate', {
                expression: 'document.querySelector(\'[data-testid="chat-list-search"]\') !== null',
                returnByValue: true
            });
            if (result.result.value === true) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                return;
            }
        } catch (err) {
            // Abaikan
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Timeout: Gagal mendeteksi UI utama WhatsApp.');
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
