from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
import re
import time
from datetime import datetime, timedelta

# WARNING: This script interacts with WhatsApp Web's internal JavaScript objects
# (e.g., window.Store). These objects are not a public API and can change at any
# time without notice, which will break this script. Use with caution and expect
# future maintenance.

# A robust regex that matches international phone numbers with optional spaces or hyphens
PHONE_REGEX = re.compile(r"(\+\d{1,3}[\s-]?\d[\d\s\-]{4,}\d)")

class WhatsAppExtractor:
    def __init__(self):
        self.play = None
        self.browser = None
        self.page = None

    def login(self):
        self.play = sync_playwright().start()
        self.browser = self.play.chromium.launch(headless=False)
        self.page = self.browser.new_page()
        self.page.goto("https://web.whatsapp.com")
        try:
            self.page.wait_for_selector("canvas", timeout=0)
        except PWTimeout:
            pass

    def wait_logged_in(self):
        try:
            # First, wait for the main UI element to ensure the page is rendering.
            self.page.wait_for_selector("div[role='grid'], #pane-side", timeout=120000) # 2 min timeout

            # Second, explicitly wait for the Store object to be ready.
            # This is crucial as the Store hydrates after the UI is visible.
            self.page.wait_for_function(
                "window.Store && window.Store.Chat && window.Store.Chat.models.length > 0",
                timeout=60000 # 1 min timeout for the store to be ready
            )
        except PWTimeout:
            raise Exception("Gagal login atau WhatsApp Web butuh waktu terlalu lama untuk memuat. Coba lagi.")

    def _normalize_phone(self, raw):
        p = re.sub(r"[\s\-()]", "", raw)
        if not p.startswith("+"):
            if p.startswith("0"):
                p = "+62" + p[1:]
        return p

    def scan_all_chats(self, start_date=None, end_date=None):
        start_ts = int(datetime.strptime(start_date, "%Y-%m-%d").timestamp()) if start_date else None
        end_ts = int(datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59).timestamp()) if end_date else None

        script = """
            (args) => {
                const startTs = args.start_ts;
                const endTs = args.end_ts;
                const contacts = [];
                const seen = new Set();

                window.Store.Chat.models.forEach(chat => {
                    if (chat.contact && chat.contact.isMyContact === false && chat.id.server === 'c.us') {
                        let inRange = false;
                        if (!startTs && !endTs) {
                            inRange = true;
                        } else {
                            for (const msg of chat.msgs.models) {
                                if ((!startTs || msg.t >= startTs) && (!endTs || msg.t <= endTs)) {
                                    inRange = true;
                                    break;
                                }
                            }
                        }

                        if (inRange) {
                            const phone = '+' + chat.id.user;
                            if (!seen.has(phone)) {
                                seen.add(phone);
                                contacts.push({ phone: phone, chat: chat.name || chat.formattedTitle });
                            }
                        }
                    }
                });
                return contacts;
            }
        """
        results = self.page.evaluate(script, {"start_ts": start_ts, "end_ts": end_ts})

        for contact in results:
            contact['phone'] = self._normalize_phone(contact['phone'])

        return results

    def get_groups(self):
        self.page.wait_for_selector("#pane-side", timeout=10000)
        groups = self.page.evaluate("""
            () => {
                const groups = {};
                window.Store.Chat.models.forEach(chat => {
                    if (chat.isGroup) {
                        groups[chat.name] = chat.id._serialized;
                    }
                });
                return groups;
            }
        """)
        return groups

    def scan_group_members(self, group_id):
        self.page.wait_for_selector("#pane-side", timeout=10000)
        contacts = self.page.evaluate("""
            (groupId) => {
                const chat = window.Store.Chat.get(groupId);
                if (!chat || !chat.participants) {
                    return [];
                }
                const contacts = [];
                const savedContacts = new Set(window.Store.Contact.models.map(c => c.id._serialized));

                chat.participants.forEach(p => {
                    if (!savedContacts.has(p.id._serialized)) {
                        contacts.push({
                            phone: '+' + p.id.user,
                            chat: p.displayName || p.id.user
                        });
                    }
                });
                return contacts;
            }
        """, group_id)

        for contact in contacts:
            contact['phone'] = self._normalize_phone(contact['phone'])

        return contacts
