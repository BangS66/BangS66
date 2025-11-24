# WhatsApp Scraper Desktop

Aplikasi desktop berbasis ElectronJS untuk mengekstrak (scrape) kontak dan metadata dari chat WhatsApp Web secara lokal, menggunakan Puppeteer untuk stabilitas.

## Penafian (Disclaimer)

**Penggunaan aplikasi ini dapat melanggar Ketentuan Layanan WhatsApp.** Otomatisasi interaksi dengan platform mereka membawa risiko, termasuk kemungkinan akun Anda diblokir sementara atau permanen. Gunakan dengan bijak dan atas risiko Anda sendiri. Pengembang tidak bertanggung jawab atas segala konsekuensi dari penggunaan aplikasi ini.

## Cara Kerja

Aplikasi ini menggunakan arsitektur dua jendela untuk stabilitas maksimum:
1.  **Jendela Kontrol (Electron)**: Antarmuka pengguna utama tempat Anda mengontrol pemindaian dan melihat hasilnya.
2.  **Jendela Browser (Puppeteer)**: Jendela browser Chromium terpisah yang dikontrol oleh Puppeteer. WhatsApp Web berjalan di lingkungan browser yang lebih otentik ini, yang secara signifikan mengurangi kemungkinan deteksi dan pemblokiran.

Saat Anda memulai pemindaian, aplikasi akan menginjeksikan skrip (`scanner.js`) ke dalam halaman WhatsApp Web untuk mengumpulkan data secara lokal.

## Persiapan WAJIB: Mengatur Chromium

Aplikasi ini membutuhkan browser Chromium agar berfungsi. Anda **HARUS** menyediakan browser ini.

1.  **Unduh Chromium**:
    -   Kunjungi [situs unduhan Chromium](https://commondatastorage.googleapis.com/chromium-browser-snapshots/index.html?prefix=Win_x64/).
    -   Pilih versi stabil terbaru (cari nomor revisi tertinggi).
    -   Unduh file `chrome-win.zip`.

2.  **Ekstrak dan Tempatkan**:
    -   Buat folder bernama `chromium` di dalam direktori utama proyek (`whatsapp-scraper-app/chromium`).
    -   Ekstrak **seluruh isi** dari `chrome-win.zip` ke dalam folder `chromium` tersebut.
    -   Struktur akhir Anda harus terlihat seperti ini: `whatsapp-scraper-app/chromium/chrome-win/chrome.exe`. (Aplikasi akan secara otomatis mencari path ini).

## Instalasi dan Penggunaan

### Prasyarat

-   Node.js (versi LTS direkomendasikan)
-   Browser Chromium (lihat langkah-langkah di atas)

### Menjalankan Aplikasi (Mode Pengembangan)

1.  **Clone repositori dan instal dependensi:**
    ```bash
    git clone <URL_REPO_ANDA>
    cd whatsapp-scraper-app
    npm install
    ```

2.  **Pastikan Chromium sudah ada** di folder `chromium/`.

3.  **Jalankan aplikasi:**
    ```bash
    npm start
    ```
    Jendela kontrol akan terbuka, diikuti oleh jendela browser Chromium terpisah yang memuat WhatsApp Web.

## Membangun Aplikasi Lintas Platform

Anda dapat membangun aplikasi ini untuk Windows, macOS, dan Linux.

1.  **Jalankan skrip build yang sesuai:**
    -   **Untuk Windows (.exe):**
        ```bash
        npm run dist -- --win
        ```
    -   **Untuk macOS (.dmg):**
        ```bash
        npm run dist -- --mac
        ```
    -   **Untuk Linux (.AppImage):**
        ```bash
        npm run dist -- --linux
        ```

2.  **PENTING**: Setelah membangun, Anda harus **menyalin folder `chromium` secara manual** ke dalam direktori *resources* dari aplikasi yang sudah di-build (misalnya, di dalam `dist/win-unpacked/resources/`). `electron-builder` tidak selalu menangani bundel biner besar seperti ini dengan baik.

## Pemecahan Masalah

-   **Browser Chromium Tidak Terbuka**:
    -   Pastikan Anda telah menempatkan folder `chrome-win` dengan benar di dalam direktori `chromium`.
    -   Verifikasi bahwa `puppeteer-integration.js` dapat menemukan `chrome.exe`. Anda mungkin perlu menyesuaikan path di `getChromiumExecutablePath()` jika Anda menggunakan OS selain Windows.
