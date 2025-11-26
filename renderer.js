const scanButton = document.getElementById('scan-button');
const statusDiv = document.getElementById('status');
const exportButtonsDiv = document.getElementById('export-buttons');
const exportJsonButton = document.getElementById('export-json');
const exportCsvButton = document.getElementById('export-csv');
const exportVcfButton = document.getElementById('export-vcf');

let unsavedContacts = [];

scanButton.addEventListener('click', async () => {
  scanButton.disabled = true;
  statusDiv.textContent = 'Scanning...';
  exportButtonsDiv.style.display = 'none';

  try {
    unsavedContacts = await window.electronAPI.scanContacts();
    statusDiv.textContent = `Scan complete! Found ${unsavedContacts.length} unsaved contacts.`;
    if (unsavedContacts.length > 0) {
      exportButtonsDiv.style.display = 'flex';
    }
  } catch (error) {
    statusDiv.textContent = `Error: ${error.message}`;
    console.error('Scan failed:', error);
  } finally {
    scanButton.disabled = false;
  }
});

exportJsonButton.addEventListener('click', () => {
  window.electronAPI.exportFile(unsavedContacts, 'json');
});

exportCsvButton.addEventListener('click', () => {
  window.electronAPI.exportFile(unsavedContacts, 'csv');
});

exportVcfButton.addEventListener('click', () => {
  window.electronAPI.exportFile(unsavedContacts, 'vcf');
});
