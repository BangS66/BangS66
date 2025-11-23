
async function scrapeActiveChat() {
    const SELECTORS = {
        chatHeader: 'header',
        contactNameTitle: 'header span[dir="auto"]',
        messageBubble: 'div.message-in, div.message-out',
        messageText: 'span.selectable-text',
    };

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

    const contacts = new Map();
    const chatTitleElement = document.querySelector(SELECTORS.contactNameTitle);
    const chatTitle = chatTitleElement ? chatTitleElement.innerText : 'Unknown Chat';
    const isSaved = chatTitle !== 'Unknown Chat';

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

    return Array.from(contacts.values());
}
