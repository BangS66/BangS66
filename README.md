# WHATSAPP WEB FULL-HISTORY SCRAPER — MANIFEST V3

## Peringatan Penting: Risiko dan Penggunaan Etis

**Harap baca ini dengan saksama sebelum menggunakan ekstensi ini.**

Ekstensi ini dirancang untuk mengotomatiskan proses pengumpulan nomor kontak dari riwayat chat WhatsApp Web Anda. Penggunaan alat otomatisasi semacam ini dapat bertentangan dengan **Ketentuan Layanan (Terms of Service) WhatsApp**.

**Potensi Risiko:**
1.  **Pemblokiran Akun:** WhatsApp dapat mendeteksi aktivitas otomatisasi sebagai perilaku "bot-like" dan dapat mengakibatkan pemblokiran sementara atau permanen pada akun Anda. **Gunakan dengan risiko Anda sendiri.**
2.  **Pelanggaran Privasi:** Mengekstrak informasi kontak orang lain tanpa izin mereka dapat melanggar undang-undang privasi di banyak negara (seperti GDPR). Pastikan Anda memiliki hak atau izin untuk mengumpulkan dan menyimpan informasi kontak ini.
3.  **Tidak Ada Jaminan:** Struktur DOM WhatsApp Web sering berubah. Ekstensi ini mungkin berhenti berfungsi setelah pembaruan. Pemeliharaan mungkin diperlukan untuk menyesuaikan *query selector*.

Ekstensi ini dibuat untuk tujuan **penggunaan pribadi dan etis**, seperti membuat cadangan kontak Anda sendiri dari riwayat percakapan. Pengembang tidak bertanggung jawab atas penyalahgunaan atau konsekuensi apa pun yang timbul dari penggunaan alat ini.

---

## Ringkasan Cara Kerja

Ekstensi Chrome ini menyuntikkan skrip ke dalam tab WhatsApp Web yang aktif untuk mengekstrak nomor telepon secara otomatis. Prosesnya berjalan sebagai berikut:

1.  **Inisiasi dari Popup:** Pengguna mengonfigurasi pengaturan (seperti *delay*) di popup ekstensi dan menekan "Start Full Scan".
2.  **Injeksi Skrip:** *Service worker* ekstensi menerima perintah dan menginjeksi `content_inject.js` ke halaman WhatsApp Web.
3.  **Scrolling Otomatis:** Skrip konten pertama-tama akan menggulir (scroll) daftar obrolan di sidebar kiri secara otomatis hingga ke bawah untuk memastikan semua percakapan termuat dalam daftar.
4.  **Iterasi dan Ekstraksi:** Setelah semua chat dimuat, skrip akan mengklik setiap percakapan satu per satu. Setelah sebuah chat dibuka, skrip akan memindai header chat dan semua gelembung pesan untuk menemukan teks yang cocok dengan pola nomor telepon atau tautan `wa.me`.
5.  **Pengiriman Data:** Setiap nomor unik yang ditemukan beserta metadatanya (nama chat, teks sumber) dikirim kembali ke *service worker* di latar belakang, di mana data tersebut dikumpulkan dan diduplikasi.
6.  **Unduh Hasil:** Setelah semua chat diproses, *service worker* akan membuat file (CSV atau JSON) yang berisi semua kontak unik yang ditemukan dan memicu dialog unduhan di browser.

Proses ini sengaja dibuat dapat dikonfigurasi dengan *delay* untuk meniru perilaku manusia dan mengurangi risiko deteksi.

---

## Cara Instalasi (Load Unpacked)

1.  **Unduh Kode:** Unduh atau *clone* semua file dari repositori ini ke sebuah folder di komputer Anda.
2.  **Buka Ekstensi Chrome:** Buka Google Chrome dan navigasikan ke `chrome://extensions/`.
3.  **Aktifkan Mode Pengembang:** Di pojok kanan atas halaman, aktifkan sakelar "Developer mode".
4.  **Muat Ekstensi:** Klik tombol "Load unpacked" yang muncul di kiri atas.
5.  **Pilih Folder:** Pilih folder tempat Anda menyimpan file ekstensi.
6.  **Selesai:** Ekstensi "WhatsApp Contact Extractor" sekarang akan muncul di daftar ekstensi Anda dan siap digunakan.

---

## Cara Penggunaan

1.  **Login ke WhatsApp Web:** Buka [https://web.whatsapp.com](https://web.whatsapp.com) dan login ke akun Anda dengan memindai kode QR.
2.  **Tunggu hingga Chat Dimuat:** Pastikan daftar obrolan Anda sudah terlihat.
3.  **Buka Ekstensi:** Klik ikon ekstensi di toolbar Chrome untuk membuka popup.
4.  **Konfigurasi (Opsional):**
    *   **Delay per Chat:** Waktu tunggu (dalam milidetik) setelah membuka setiap chat. Nilai yang lebih tinggi lebih aman.
    *   **Delay per Scroll:** Waktu tunggu (dalam milidetik) setelah setiap aksi gulir di daftar chat.
    *   **Export Format:** Pilih format file output (CSV, JSON, atau VCF).
5.  **Mulai Pemindaian:** Klik tombol **Start Full Scan**. Jangan berinteraksi dengan tab WhatsApp Web saat pemindaian berjalan.
6.  **Pantau Progres:** Progres akan ditampilkan di area log di dalam popup. Anda akan melihat jumlah chat yang diproses dan jumlah kontak unik yang ditemukan.
7.  **Hentikan Pemindaian (Opsional):** Jika Anda perlu menghentikan proses, klik tombol **Stop Scan**.
8.  **Unduh File:** Setelah pemindaian selesai, dialog "Simpan Sebagai" akan muncul secara otomatis. Pilih lokasi untuk menyimpan file kontak Anda.

---

## Tambahan dan Tips

### Mengurangi Risiko Diblokir

*   **Tingkatkan Delay:** Atur `Delay per Chat` ke nilai yang lebih tinggi (misalnya, 3000-5000 ms). Semakin lambat prosesnya, semakin mirip dengan perilaku manusia.
*   **Gunakan pada Jam Sepi:** Jalankan pemindaian saat Anda tidak aktif menggunakan WhatsApp untuk menghindari konflik.
*   **Jangan Lakukan Terlalu Sering:** Gunakan alat ini seperlunya saja.

### Implementasi Ekspor XLSX (SheetJS)

Untuk menambahkan fungsionalitas ekspor ke XLSX, Anda bisa menggunakan *library* seperti [SheetJS](https://sheetjs.com/).

1.  **Unduh SheetJS:** Unduh file `xlsx.full.min.js` dari CDN atau repositori SheetJS dan letakkan di folder proyek Anda.
2.  **Izinkan di Manifes:** Tambahkan `xlsx.full.min.js` ke `content_security_policy` di `manifest.json` jika diperlukan (biasanya tidak untuk Manifest V3 dengan skrip lokal).
3.  **Impor di Service Worker:** Impor skrip di `service_worker.js` menggunakan `importScripts('xlsx.full.min.js');` di baris paling atas.
4.  **Modifikasi Fungsi Unduh:** Perbarui fungsi `triggerDownload` di `service_worker.js`:

```javascript
// Di dalam triggerDownload()

} else if (format === 'xlsx') {
  const worksheet = XLSX.utils.json_to_sheet(contacts);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
  const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

  content = new Blob([xlsxBuffer], { type: 'application/octet-stream' });
  mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  // Lanjutkan dengan logika Blob dan URL...
}
```
*Catatan: Anda juga perlu mengaktifkan kembali opsi XLSX di `popup.html`.*
