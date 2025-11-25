const fs = require('fs').promises;
const path = require('path');
const { ipcMain, dialog } = require('electron');
const { logger } = require('./logger');

/**
 * Mengubah array objek kontak menjadi string CSV.
 * @param {Array<Object>} contacts - Data kontak.
 * @param {Object} options - Opsi kolom yang akan disertakan.
 * @returns {string} - String dalam format CSV.
 */
function toCSV(contacts, options) {
    const headers = ['original_text', 'normalized_number'];
    if (options.include_chat_name) headers.push('chat_title');
    if (options.include_last_message) headers.push('last_message_preview');
    if (options.include_timestamp) headers.push('last_activity_timestamp');

    let csvContent = headers.join(',') + '\n';

    contacts.forEach(contact => {
        const row = [
            `"${contact.original_text || ''}"`,
            `"${contact.normalized_number || ''}"`
        ];
        if (options.include_chat_name) row.push(`"${contact.chat_title || ''}"`);
        if (options.include_last_message) row.push(`"${(contact.last_message_preview || '').replace(/"/g, '""')}"`);
        if (options.include_timestamp) row.push(`"${contact.last_activity_timestamp || ''}"`);

        csvContent += row.join(',') + '\n';
    });

    return csvContent;
}

/**
 * Mengubah array objek kontak menjadi string VCF (vCard).
 * @param {Array<Object>} contacts - Data kontak.
 * @returns {string} - String dalam format VCF.
 */
function toVCF(contacts) {
    let vcfContent = '';
    contacts.forEach(contact => {
        const name = `Unknown ${contact.normalized_number.replace('+', '')}`;
        vcfContent += 'BEGIN:VCARD\n';
        vcfContent += 'VERSION:3.0\n';
        vcfContent += `FN:${name}\n`;
        vcfContent += `TEL;TYPE=CELL:${contact.normalized_number}\n`;
        vcfContent += 'END:VCARD\n';
    });
    return vcfContent;
}

/**
 * Mengubah array objek kontak menjadi string TXT (satu nomor per baris).
 * @param {Array<Object>} contacts - Data kontak.
 * @returns {string} - String dalam format TXT.
 */
function toTXT(contacts) {
    return contacts.map(c => c.normalized_number).join('\n');
}

// Menangani permintaan ekspor dari renderer
ipcMain.handle('export-data', async (event, { data, format }) => {
    const { contacts, options } = data;
    if (!contacts || contacts.length === 0) {
        return { success: false, error: 'Tidak ada data untuk diekspor.' };
    }

    const { filePath } = await dialog.showSaveDialog({
        title: `Simpan sebagai ${format.toUpperCase()}`,
        defaultPath: `whatsapp-contacts-${Date.now()}.${format}`,
        filters: [{ name: format.toUpperCase(), extensions: [format] }]
    });

    if (!filePath) {
        return { success: false, error: 'Penyimpanan dibatalkan.' };
    }

    try {
        let content;
        if (format === 'csv') {
            content = toCSV(contacts, options);
        } else if (format === 'vcf') {
            content = toVCF(contacts);
        } else if (format === 'txt') {
            content = toTXT(contacts);
        } else {
            throw new Error('Format tidak didukung.');
        }

        await fs.writeFile(filePath, content, 'utf8');
        logger.info(`Data berhasil diekspor ke ${filePath}`);
        return { success: true, filePath };
    } catch (error) {
        logger.error(`Gagal mengekspor data: ${error.message}`);
        return { success: false, error: error.message };
    }
});
