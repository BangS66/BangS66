# WhatsApp Scraper Desktop

Aplikasi desktop berbasis ElectronJS untuk mengekstrak (scrape) kontak dan metadata dari chat WhatsApp Web secara lokal.

## Penafian (Disclaimer)

**Penggunaan aplikasi ini dapat melanggar Ketentuan Layanan WhatsApp.** Otomatisasi interaksi dengan platform mereka membawa risiko, termasuk kemungkinan akun Anda diblokir sementara atau permanen. Gunakan dengan bijak dan atas risiko Anda sendiri. Pengembang tidak bertanggung jawab atas segala konsekuensi dari penggunaan aplikasi ini. Untuk meminimalkan risiko, hindari penggunaan berlebihan atau untuk tujuan spam.

## Cara Kerja

Aplikasi ini membungkus WhatsApp Web dalam jendela desktop yang aman menggunakan Electron's `BrowserView`. Saat Anda memulai pemindaian, aplikasi akan menginjeksikan skrip (`scanner.js`) ke dalam `BrowserView` tersebut. Skrip ini secara lokal menyimulasikan perilaku pengguna—seperti menggulir daftar obrolan dan mengklik setiap obrolan—untuk mengumpulkan informasi yang terlihat di layar. Semua data diproses dan disimpan di komputer Anda dan **tidak pernah dikirim ke server eksternal mana pun.**

## Fitur Utama

- **Scraping Lokal**: Semua proses berjalan 100% di perangkat Anda.
- **Manajemen Sesi**: Opsi untuk menyimpan sesi login Anda agar tidak perlu memindai kode QR setiap kali.
- **Ekstrak Metadata Komprehensif**: Mengambil nama, nomor telepon, jenis obrolan (pribadi/grup), pesan terakhir, dan stempel waktu.
- **Ekspor Fleksibel**: Ekspor data yang dikumpulkan ke format CSV, JSON, atau TXT.
- **Penyimpanan Otomatis**: Hasil ekspor secara otomatis disimpan ke folder `exports` di dalam direktori aplikasi.

## Instalasi dan Penggunaan

### Prasyarat

- [Node.js](https://nodejs.org/) (versi LTS direkomendasikan)
- npm (biasanya sudah termasuk dalam Node.js)

### Menjalankan Aplikasi (Mode Pengembangan)

1.  **Clone repositori ini:**
    ```bash
    git clone <URL_REPO_ANDA>
    cd whatsapp-scraper-app
    ```

2.  **Instal dependensi:**
    ```bash
    npm install
    ```

3.  **Jalankan aplikasi:**
    ```bash
    npm start
    ```
    Aplikasi akan terbuka, dan Anda dapat login ke WhatsApp Web dengan memindai kode QR.

## Membangun Aplikasi Lintas Platform

Anda dapat membangun aplikasi ini untuk Windows, macOS, dan Linux. Perintah-perintah berikut akan membuat installer/paket yang sesuai di dalam direktori `dist`.

1.  **Pastikan semua dependensi terinstal:**
    ```bash
    npm install
    ```

2.  **Jalankan skrip build yang sesuai:**
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

3.  **Temukan installer Anda:**
    Setelah proses selesai, cari file yang dapat didistribusikan (misalnya, `.exe`, `.dmg`, atau `.AppImage`) di dalam direktori `dist` yang baru dibuat.

## Pemecahan Masalah (Troubleshooting)

-   **Pemindaian Gagal atau Macet**:
    -   Pastikan koneksi internet Anda stabil.
    -   Struktur DOM WhatsApp Web mungkin telah berubah. Coba buka DevTools (`Ctrl+Shift+I` lalu klik kanan pada area WhatsApp Web dan pilih "Inspect Element") untuk memeriksa apakah selector di `scanner.js` masih valid.
    -   Coba hapus sesi (`Clear Session`) dan login kembali.
-   **Aplikasi Menampilkan Layar Putih**:
    -   Ini bisa jadi masalah saat memuat UI atau WhatsApp Web. Buka DevTools (`Ctrl+Shift+I`) dan periksa tab `Console` untuk melihat pesan kesalahan.
