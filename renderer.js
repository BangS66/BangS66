// --- DOM Elements ---
const waStatus = document.getElementById('wa-status');
const scanButton = document.getElementById('scan-button');
const fetchGroupsButton = document.getElementById('fetch-groups-button');
const groupSelect = document.getElementById('group-select');
const scrapeGroupButton = document.getElementById('scrape-group-button');
const statusDiv = document.getElementById('status');
const exportButtonsDiv = document.getElementById('export-buttons');
const exportJsonButton = document.getElementById('export-json');
const exportCsvButton = document.getElementById('export-csv');
const exportVcfButton = document.getElementById('export-vcf');
const logoutButton = document.getElementById('logout-button');

let collectedContacts = [];

// --- IPC Event Handlers ---

// Handle status updates from the main process (e.g., "Logged In", "Scanning...")
window.electronAPI.onStatusUpdate((message) => {
    waStatus.textContent = message;
    if (message === 'Logged In') {
        waStatus.textContent = 'You are already logged in. WhatsApp is running in the background.';
        fetchGroupsButton.disabled = false;
        scanButton.disabled = false;
    } else {
        waStatus.textContent = message;
    }
});

// --- Event Listeners ---

logoutButton.addEventListener('click', async () => {
    if (confirm('Are you sure you want to log out and clear all session data? The application will restart.')) {
        await window.electronAPI.logoutReset();
    }
});

// Scan for unsaved contacts based on date filters
scanButton.addEventListener('click', async () => {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    setLoadingState('Scanning for unsaved contacts...');
    try {
        collectedContacts = await window.electronAPI.scanContacts({ startDate, endDate });
        handleScanComplete(collectedContacts);
    } catch (error) {
        handleScanError(error);
    }
});

// Fetch all groups and populate the dropdown
fetchGroupsButton.addEventListener('click', async () => {
    setLoadingState('Fetching groups...');
    try {
        const groups = await window.electronAPI.fetchGroups();
        populateGroupDropdown(groups);
        statusDiv.textContent = `Found ${groups.length} groups.`;
        scrapeGroupButton.disabled = groups.length === 0;
    } catch (error) {
        handleScanError(error);
    }
});

// Scrape members from the selected group
scrapeGroupButton.addEventListener('click', async () => {
    const selectedGroupId = groupSelect.value;
    if (!selectedGroupId) {
        statusDiv.textContent = 'Please select a group first.';
        return;
    }
    setLoadingState('Scraping group members...');
    try {
        collectedContacts = await window.electronAPI.scrapeGroupMembers(selectedGroupId);
        handleScanComplete(collectedContacts);
    } catch (error) {
        handleScanError(error);
    }
});


// --- Export Button Listeners ---

exportJsonButton.addEventListener('click', () => handleExport('json'));
exportCsvButton.addEventListener('click', () => handleExport('csv'));
exportVcfButton.addEventListener('click', () => handleExport('vcf'));

// --- UI Helper Functions ---

function setLoadingState(message) {
    statusDiv.textContent = message;
    scanButton.disabled = true;
    fetchGroupsButton.disabled = true;
    scrapeGroupButton.disabled = true;
    exportButtonsDiv.style.display = 'none';
}

function handleScanComplete(contacts) {
    statusDiv.textContent = `Scan complete! Found ${contacts.length} contacts.`;
    scanButton.disabled = false;
    fetchGroupsButton.disabled = false;
    scrapeGroupButton.disabled = false; // Re-enable after scan
    if (contacts.length > 0) {
        exportButtonsDiv.style.display = 'flex';
    }
}

function handleScanError(error) {
    statusDiv.textContent = `Error: ${error.message}`;
    console.error('Operation failed:', error);
    scanButton.disabled = false;
    fetchGroupsButton.disabled = false;
    scrapeGroupButton.disabled = false;
}

function populateGroupDropdown(groups) {
    groupSelect.innerHTML = ''; // Clear existing options
    if (groups.length > 0) {
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);
        });
        groupSelect.disabled = false;
    } else {
        const option = document.createElement('option');
        option.textContent = 'No groups found';
        groupSelect.appendChild(option);
        groupSelect.disabled = true;
    }
}

function handleExport(format) {
    const prefix = document.getElementById('contact-prefix').value || 'Contact';
    window.electronAPI.exportFile(collectedContacts, prefix, format);
}
