// scraper.js

// This function is injected into the WhatsApp Web BrowserView to perform the scraping.
// It is self-contained and does not rely on any external libraries.
async function scrapeContacts() {
    // These selectors are specific to WhatsApp Web's DOM structure.
    // They are subject to change if WhatsApp updates their web client.
    const SELECTORS = {
        chatListContainer: '#pane-side', // The container for the chat list
        chatListItem: 'div[role="listitem"]', // Each individual chat in the list
        chatHeader: 'header', // The header of the currently opened chat
        contactNameTitle: 'header span[dir="auto"]', // The title in the chat header, which contains the contact name or number
        messageBubble: 'div.message-in, div.message-out', // Message bubbles
        messageText: 'span.selectable-text', // Text within a message bubble
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const cleanPhone = (raw) => {
        let digits = raw.replace(/\D/g, '');
        if (raw.includes('+')) {
            return `+${digits}`;
        }
        return digits;
    };

    const extractPhonesFromText = (text) => {
        const phoneRegex = /(?:(?:\+|00)[1-9]\d{0,3}[ -]?)?(?:\(\d{1,5}\)[ -]?)?\d{1,5}[ -]?\d{1,5}[ -]?\d{1,5}(?:[ -]?\d{1,5}){0,2}/g;
        const waMeRegex = /wa\.me\/(\d+)/g;
        let matches = [...(text.match(phoneRegex) || []), ...(text.match(waMeRegex) || [])];
        return matches.map(cleanPhone).filter(p => p.length >= 6);
    };

    async function scrollChatList() {
        const chatList = document.querySelector(SELECTORS.chatListContainer);
        if (!chatList) return;

        let lastHeight = 0;
        let attempts = 0;
        while (attempts < 5) {
            chatList.scrollTop = chatList.scrollHeight;
            await sleep(1000);
            if (chatList.scrollTop === lastHeight) {
                attempts++;
            } else {
                attempts = 0;
            }
            lastHeight = chatList.scrollTop;
        }
    }

    await scrollChatList();

    const contacts = new Map();
    const chatItems = document.querySelectorAll(SELECTORS.chatListItem);

    for (let i = 0; i < chatItems.length; i++) {
        const chatItem = chatItems[i];
        chatItem.click();
        await sleep(200); // Short delay for chat to open

        const chatTitleElement = document.querySelector(SELECTORS.contactNameTitle);
        const chatTitle = chatTitleElement ? chatTitleElement.innerText : 'Unknown Chat';
        const isSaved = chatTitle !== 'Unknown Chat'; // Simple check

        const headerText = document.querySelector(SELECTORS.chatHeader)?.innerText || '';
        const phones = extractPhonesFromText(headerText);

        phones.forEach(phone => {
            if (!contacts.has(phone)) {
                contacts.set(phone, { phone, chatName: chatTitle, isSaved });
            }
        });

        const messages = document.querySelectorAll(SELECTORS.messageText);
        messages.forEach(msg => {
            const msgText = msg.innerText;
            extractPhonesFromText(msgText).forEach(phone => {
                if (!contacts.has(phone)) {
                    contacts.set(phone, { phone, chatName: chatTitle, isSaved });
                }
            });
        });
    }

    return Array.from(contacts.values());
}
