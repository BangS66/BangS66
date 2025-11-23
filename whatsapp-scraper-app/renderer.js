document.addEventListener('DOMContentLoaded', () => {
    const scanAllButton = document.getElementById('scan-all');
    const scanSelectedButton = document.getElementById('scan-selected');
    const exportCsvButton = document.getElementById('export-csv');
    const exportTxtButton = document.getElementById('export-txt');
    const clearDataButton = document.getElementById('clear-data');
    const contactCountSpan = document.getElementById('contact-count');
    const contactsTableBody = document.getElementById('contacts-table-body');

    let contacts = [];

    scanAllButton.addEventListener('click', () => {
        console.log('Starting scan...');
        window.electronAPI.startScan();
    });

    scanSelectedButton.addEventListener('click', () => {
        console.log('Starting scan of selected chat...');
        window.electronAPI.scanSelected();
    });

    window.electronAPI.onScanComplete((scrapedContacts) => {
        console.log('Scan complete:', scrapedContacts);
        contacts = scrapedContacts;
        updateTable();
    });

    window.electronAPI.onScanError((errorMessage) => {
        console.error('Scan error:', errorMessage);
        alert(`An error occurred during scanning: ${errorMessage}`);
    });

    clearDataButton.addEventListener('click', () => {
        contacts = [];
        updateTable();
    });

    exportCsvButton.addEventListener('click', () => {
        if (contacts.length > 0) {
            window.electronAPI.exportCSV(contacts);
        } else {
            alert('No contacts to export.');
        }
    });

    exportTxtButton.addEventListener('click', () => {
        if (contacts.length > 0) {
            window.electronAPI.exportTXT(contacts);
        } else {
            alert('No contacts to export.');
        }
    });

    function updateTable() {
        contactsTableBody.innerHTML = '';
        contacts.forEach(contact => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${contact.phone}</td>
                <td>${contact.chatName}</td>
                <td>${contact.isSaved ? 'Yes' : 'No'}</td>
            `;
            contactsTableBody.appendChild(row);
        });
        contactCountSpan.textContent = contacts.length;
    }
});
