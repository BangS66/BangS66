# WhatsApp Unsaved Contact Scraper

Aplikasi desktop berbasis Electron untuk memindai (scrape) riwayat chat dari WhatsApp Web dan mengekspor semua nomor telepon yang belum tersimpan ke dalam format file CSV, vCard (VCF), atau TXT.

## Fitur Utama

- **Login Mudah**: Cukup pindai QR code WhatsApp Web di dalam aplikasi untuk terhubung. Sesi Anda akan disimpan sehingga tidak perlu login berulang kali.
- **Pemindaian Komprehensif**: Memindai seluruh daftar chat untuk menemukan kontak yang belum disimpan (yang tampil sebagai nomor telepon, bukan nama).
- **Konfigurasi Fleksibel**: Atur penundaan (*delay*) antar pemindaian chat untuk mengontrol kecepatan dan mengurangi risiko.
- **Progres Real-time**: Pantau progres pemindaian dengan progress bar dan penghitung.
- **Ekspor Serbaguna**: Ekspor data dalam format `CSV`, `VCF` (cocok untuk impor ke kontak HP), dan `TXT` (daftar nomor sederhana).
- **Normalisasi Nomor**: Secara otomatis mencoba mengubah nomor ke format internasional (misalnya, +62 untuk Indonesia).

## Disclaimer & Peringatan Etis

**PERHATIAN:** Aplikasi ini mengotomatiskan interaksi dengan WhatsApp Web dan memproses data pribadi (nomor telepon). Penggunaan alat ini sepenuhnya menjadi **tanggung jawab Anda**.

- **Gunakan dengan Bijak**: Jangan gunakan aplikasi ini untuk spamming atau aktivitas yang melanggar hukum.
- **Risiko Pemblokiran**: Meskipun aplikasi ini menyertakan fitur penundaan untuk meniru perilaku manusia, penggunaan berlebihan atau terlalu cepat dapat menyebabkan akun WhatsApp Anda diblokir sementara atau permanen. **Pengembang tidak bertanggung jawab atas konsekuensi apa pun.**
- **Privasi**: Semua data diproses secara lokal di komputer Anda. Tidak ada data yang dikirim ke server eksternal.

---

## Cara Menggunakan

### 1. Instalasi

Pastikan Anda memiliki [Node.js](https://nodejs.org/) (versi LTS direkomendasikan) terinstal.

```bash
# Clone repositori ini (atau unduh sebagai ZIP)
git clone https://github.com/user/repo-name.git
cd repo-name

# Instal dependensi
npm install
```

### 2. Menjalankan Aplikasi

```bash
# Jalankan aplikasi dalam mode development
npm run start
```

Setelah aplikasi terbuka:
1.  Jendela di sisi kanan akan memuat **WhatsApp Web**.
2.  Jika Anda belum login, pindai QR code menggunakan ponsel Anda. Tunggu hingga semua chat Anda termuat.
3.  Setelah login, Anda siap untuk memulai pemindaian.

### 3. Melakukan Pemindaian

1.  **Atur Opsi**: Di panel kiri, sesuaikan pengaturan seperti `Delay per Chat`. Direkomendasikan untuk menggunakan delay minimal `1000` ms (1 detik) atau lebih untuk keamanan.
2.  **Mulai Pindai**: Klik tombol **Start Full Scan**.
3.  **Pantau Progres**: Aplikasi akan mulai mengklik setiap chat satu per satu. Anda dapat melihat status dan nomor yang ditemukan di tabel hasil.
4.  **Hentikan (jika perlu)**: Klik tombol **Stop Scan** untuk menghentikan proses kapan saja.

### 4. Mengekspor Hasil

Setelah pemindaian selesai (atau dihentikan), Anda dapat mengekspor data yang ditemukan:
1.  Pilih kolom tambahan yang ingin Anda sertakan (jika mengekspor ke CSV).
2.  Klik tombol ekspor yang sesuai (`Ekspor CSV`, `Ekspor VCF`, `Ekspor TXT`).
3.  Sebuah dialog akan muncul untuk memilih lokasi penyimpanan file.

## Membangun Aplikasi (Build)

Untuk membuat file installer `.exe` untuk Windows, jalankan perintah berikut:

```bash
npm run dist
```

Hasil build akan tersedia di dalam folder `dist`.

## Struktur Proyek

- `src/main.js`: File utama Electron, mengelola jendela aplikasi dan `BrowserView`.
- `src/preload.js`: Skrip untuk mengekspos API dari proses utama ke renderer dengan aman.
- `src/renderer/`: Berisi file untuk UI (HTML, CSS, JS).
- `src/scraper/scanner.js`: Logika inti untuk melakukan scraping menggunakan Playwright.
- `src/utils/`: Modul bantuan untuk logging dan ekspor data.
- `package.json`: Mendefinisikan dependensi dan skrip.
