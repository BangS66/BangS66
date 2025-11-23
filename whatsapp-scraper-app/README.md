# WhatsApp Scraper Desktop App

This is a desktop application built with Electron that allows you to scrape contacts from your WhatsApp Web chats.

## How it Works

The application opens WhatsApp Web in a sandboxed browser window. When you trigger a scan, it injects a script that scrolls through your chat list and extracts phone numbers from the chat headers. The scraped data is then displayed in the application's UI, where you can export it to CSV or TXT formats.

## Features

- **Scan All Chats**: Automatically scrolls through your entire chat list to find contacts.
- **Export to CSV/TXT**: Save the scraped contact information for use in other applications.
- **Secure**: Your WhatsApp session is not saved. You will need to scan the QR code each time you start the app.
- **Local**: All scraping is done on your computer. No data is sent to any servers.
- **Automatic Backups**: Scan results are automatically saved to a local file in case the app closes unexpectedly.

## Installation and Usage

### Prerequisites

- [Node.js](https://nodejs.org/) (which includes npm)

### Running the Application

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd whatsapp-scraper-app
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```
4.  **Run the application:**
    ```bash
    npm start
    ```

### Building the Application

You can build the application for Windows, macOS, and Linux. The distributable files will be placed in the `dist` directory.

-   **Windows (.exe):**
    ```bash
    npm run dist -- --win
    ```
-   **macOS (.dmg):**
    ```bash
    npm run dist -- --mac
    ```
-   **Linux (.AppImage):**
    ```bash
    npm run dist -- --linux
    ```

## Disclaimer

This application automates interactions with WhatsApp Web in a way that may be against their Terms of Service. Use this application at your own risk. The developers are not responsible for any consequences, including account suspension or banning. To minimize risk, avoid using this tool excessively or for spamming purposes.
