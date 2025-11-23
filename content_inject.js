// File: content_inject.js
// Deskripsi: Skrip ini diinjeksikan ke WhatsApp Web untuk melakukan scraping.
// Ini menangani scrolling, iterasi chat, dan ekstraksi nomor.

(function() {
  // Pastikan skrip tidak diinjeksi berulang kali
  if (window.hasRun) {
    return;
  }
  window.hasRun = true;

  // --- KONFIGURASI DAN STATE ---
  let config = {
    delayPerChat: 2000,
    delayPerScroll: 1000,
    maxRetries: 3,
  };
  let isExtractionRunning = false;

  // --- SELEKTOR DOM ---
  // Peringatan: Selektor ini sangat mungkin berubah di pembaruan WhatsApp Web.
  // Selektor ini bersifat umum untuk mengurangi kemungkinan kerusakan.
  const SELECTORS = {
    chatListContainer: '#pane-side', // Kontainer daftar chat
    chatListItem: 'div[role="listitem"]', // Setiap item dalam daftar chat
    chatHeader: 'header', // Header dari chat yang dibuka
    contactNameTitle: 'header span[dir="auto"]', // Judul nama di header
    messageBubble: 'div.message-in, div.message-out', // Bubble pesan
    messageText: 'span.selectable-text', // Teks di dalam bubble
  };

  // --- FUNGSI UTILITAS ---
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Membersihkan nomor telepon ke format standar
  const cleanPhone = (raw) => {
    let digits = raw.replace(/\D/g, '');
    if (raw.includes('+')) {
        return `+${digits}`;
    }
    return digits;
  };

  // Mengekstrak nomor telepon dari teks
  const extractPhonesFromText = (text) => {
    // Regex ini mencari nomor telepon (minimal 6 digit) dengan berbagai format
    const phoneRegex = /(?:(?:\+|00)[1-9]\d{0,3}[ -]?)?(?:\(\d{1,5}\)[ -]?)?\d{1,5}[ -]?\d{1,5}[ -]?\d{1,5}(?:[ -]?\d{1,5}){0,2}/g;
    const waMeRegex = /wa\.me\/(\d+)/g;
    let matches = [...(text.match(phoneRegex) || []), ...(text.match(waMeRegex) || [])];
    return matches.map(cleanPhone).filter(p => p.length >= 6);
  };

  // --- LOGIKA UTAMA EKSTRAKSI ---

  // 1. Scroll chat list untuk memuat semua chat
  async function scrollChatList() {
    logToServiceWorker("Starting to scroll chat list...");
    const chatList = document.querySelector(SELECTORS.chatListContainer);
    if (!chatList) {
      logToServiceWorker("Error: Chat list container not found.");
      return;
    }

    let lastHeight = 0;
    let attempts = 0;
    while (attempts < 5) { // Coba 5 kali setelah scroll berhenti
      chatList.scrollTop = chatList.scrollHeight;
      await sleep(config.delayPerScroll);
      if (chatList.scrollTop === lastHeight) {
        attempts++;
      } else {
        attempts = 0;
      }
      lastHeight = chatList.scrollTop;
    }
    logToServiceWorker("Finished scrolling chat list.");
  }

  // 2. Memproses setiap chat
  async function processChats() {
    logToServiceWorker("Starting to process individual chats...");
    const chatItems = document.querySelectorAll(SELECTORS.chatListItem);
    logToServiceWorker(`Found ${chatItems.length} chat items to process.`);

    for (let i = 0; i < chatItems.length; i++) {
      if (!isExtractionRunning) {
        logToServiceWorker("Extraction stopped by user.");
        break;
      }

      logToServiceWorker(`Processing chat ${i + 1} of ${chatItems.length}...`);
      const chatItem = chatItems[i];
      chatItem.click();
      await sleep(config.delayPerChat);

      // Tunggu chat dimuat (gunakan fallback polling sederhana)
      let retries = 0;
      let chatLoaded = false;
      while(retries < config.maxRetries && !chatLoaded) {
          await sleep(500);
          if (document.querySelector(SELECTORS.chatHeader)) {
              chatLoaded = true;
          }
          retries++;
      }
      if (!chatLoaded) {
          logToServiceWorker(`Failed to load chat ${i + 1}. Skipping.`);
          continue;
      }

      await extractContactsFromCurrentChat();
    }

    if (isExtractionRunning) {
        chrome.runtime.sendMessage({ type: 'scan_finished_content' });
    }
  }

  // 3. Ekstrak kontak dari chat yang sedang aktif
  async function extractContactsFromCurrentChat() {
    let foundContacts = [];
    const chatTitleElement = document.querySelector(SELECTORS.contactNameTitle);
    const chatTitle = chatTitleElement ? chatTitleElement.innerText : 'Unknown Chat';

    // Ekstrak dari header
    const headerText = document.querySelector(SELECTORS.chatHeader)?.innerText || '';
    extractPhonesFromText(headerText).forEach(phone => {
      foundContacts.push({ phone, displayTextFound: headerText.slice(0, 50), chatTitle });
    });

    // Ekstrak dari pesan
    const messages = document.querySelectorAll(SELECTORS.messageText);
    messages.forEach(msg => {
      const msgText = msg.innerText;
      extractPhonesFromText(msgText).forEach(phone => {
        foundContacts.push({ phone, displayTextFound: msgText.slice(0, 50), chatTitle });
      });
    });

    if (foundContacts.length > 0) {
      chrome.runtime.sendMessage({ type: 'found_contacts', data: foundContacts });
    }
  }

  // Mengirim log ke service worker
  function logToServiceWorker(message) {
    chrome.runtime.sendMessage({ type: 'scan_progress', log: message });
  }

  // --- LISTENER PESAN DARI SERVICE WORKER ---
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'start_scroll_and_extract') {
      if (isExtractionRunning) return;
      isExtractionRunning = true;
      config = message.config;
      await scrollChatList();
      if(isExtractionRunning) await processChats();
    } else if (message.type === 'stop_extraction') {
      isExtractionRunning = false;
    }
  });

})();