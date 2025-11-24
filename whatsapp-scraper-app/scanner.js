// File: scanner.js
// Deskripsi: Skrip ini diinjeksikan ke dalam WhatsApp Web untuk melakukan scraping.
// Berisi semua logika untuk menggulir, mengekstrak, dan memformat data.

async function scanAllChats(options) {
    // --- Konfigurasi dan State ---
    const { delayPerChat = 2000, maxRetries = 3 } = options || {};
    const contacts = new Map();

    // --- Fungsi Utilitas ---
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const randomDelay = (base) => base + Math.floor(Math.random() * 500);

    // --- Selector DOM (dengan fallback) ---
    const SELECTORS = {
        chatListContainer: '#pane-side',
        chatListItem: [
            'div[data-testid="cell-frame-container"]', // Selector utama saat ini
            'div[role="listitem"]' // Fallback
        ],
        contactNameTitle: [
            'span[data-testid="conversation-header-title"]', // Selector utama saat ini
            'header span[dir="auto"]' // Fallback
        ],
        groupIcon: 'span[data-testid="default-group"]',
        messageText: 'span.selectable-text',
    };

    function getElement(selectors) {
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return null;
    }

    function getElements(selectors) {
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) return elements;
        }
        return [];
    }

    // --- Fungsi Ekstraksi dan Pembersihan ---
    function cleanPhone(raw) {
        if (!raw) return null;
        let digits = raw.replace(/\D/g, '');
        if (digits.length < 6 || digits.length > 15) return null;
        if (raw.includes('+')) return `+${digits}`;
        return digits;
    }

    function extractPhonesFromText(text) {
        const regex = /(\+?\d[\d\s\-\(\)]{5,}\d)|(wa\.me\/(\d+))|(tel:(\d+))/g;
        const matches = text.match(regex) || [];
        return matches.map(cleanPhone).filter(Boolean);
    }

    // Fungsi ini akan diekspos oleh Puppeteer sebagai 'reportProgressToMain'
    const reportProgress = window.reportProgressToMain;

    // --- Logika Scraping Utama ---
    async function scrollChatList() {
        reportProgress(5, 'Memulai scroll daftar obrolan...');
        const chatList = document.querySelector(SELECTORS.chatListContainer);
        if (!chatList) throw new Error('Container daftar obrolan tidak ditemukan.');

        let lastHeight = 0;
        let stableScrolls = 0;
        while (stableScrolls < 5) {
            chatList.scrollTop = chatList.scrollHeight;
            await sleep(randomDelay(1000));
            if (chatList.scrollTop === lastHeight) {
                stableScrolls++;
            } else {
                stableScrolls = 0;
            }
            lastHeight = chatList.scrollTop;
        }
        reportProgress(10, 'Selesai menggulir daftar obrolan.');
    }

    async function getPhoneNumberForSavedContact() {
        try {
            document.querySelector('header').click(); // Klik header untuk membuka info kontak
            await sleep(randomDelay(1000));

            const phoneElement = document.querySelector('span[data-testid="phoneNumber"]');
            let phone = null;
            if (phoneElement) {
                phone = cleanPhone(phoneElement.textContent);
            }

            // Klik tombol kembali/tutup
            const backButton = document.querySelector('button[data-testid="icon-back"]');
            if (backButton) backButton.click();
            await sleep(randomDelay(500));

            return phone;
        } catch (e) {
            console.warn("Could not extract phone number from contact info panel:", e.message);
            // Pastikan panel tertutup jika terjadi kesalahan
            const backButton = document.querySelector('button[data-testid="icon-back"]');
            if (backButton) backButton.click();
            await sleep(randomDelay(500));
            return null;
        }
    }

    async function processChats() {
        const chatItems = getElements(SELECTORS.chatListItem);
        const totalChats = chatItems.length;
        if (totalChats === 0) throw new Error('Tidak ada item obrolan yang ditemukan.');

        for (let i = 0; i < totalChats; i++) {
            const progress = 10 + Math.round((i / totalChats) * 90);
            const chatItem = chatItems[i];

            try {
                chatItem.click();
                await sleep(randomDelay(delayPerChat));

                const nameEl = getElement(SELECTORS.contactNameTitle);
                const name = nameEl ? nameEl.textContent : 'Unknown';

                reportProgress(progress, `(${i+1}/${totalChats}) Memproses: ${name}`);

                const headerText = document.querySelector('header')?.innerText || '';
                let phone = extractPhonesFromText(headerText)[0] || null;
                const isUnsaved = !!phone;

                const chatType = document.querySelector(SELECTORS.groupIcon) ? 'Group' : 'Private';

                // Jika itu grup atau kontak yang disimpan, coba dapatkan nomor dari panel info
                if (chatType === 'Private' && !isUnsaved) {
                    phone = await getPhoneNumberForSavedContact();
                }

                if (!phone) {
                    reportProgress(progress, `(${i+1}/${totalChats}) Nomor tidak ditemukan untuk ${name}, melewati.`);
                    continue;
                }

                if (contacts.has(phone)) continue;

                const lastMessageEl = chatItem.querySelector('span[data-testid="last-message-preview"]');
                const lastMessage = lastMessageEl ? lastMessageEl.textContent : '';

                let timestamp = '';
                const timestampEl = chatItem.querySelector('div[data-testid="cell-frame-primary-trailing"] > span');
                if (timestampEl) timestamp = timestampEl.textContent;

                contacts.set(phone, {
                    name: isUnsaved ? `Unsaved (${phone})` : name,
                    phone,
                    chatType,
                    lastMessage,
                    timestamp,
                });

            } catch (err) {
                 reportProgress(progress, `Gagal memproses obrolan ${i+1}: ${err.message}`);
            }
        }
    }

    // --- Alur Eksekusi ---
    try {
        await scrollChatList();
        await processChats();
        return Array.from(contacts.values());
    } catch (error) {
        throw new Error(`Kesalahan fatal saat scraping: ${error.message}`);
    }
}
