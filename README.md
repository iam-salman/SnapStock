### SnapStock 📸

A client-side web application for rapid, QR-code-based inventory scanning. It's designed to be a progressive web app (PWA) that runs entirely in the browser, saving all data locally.

***

### Core Features

* **QR Code Scanning**: Uses the device camera for real-time scanning.
* **Session Management**: Groups scans into sessions with details like batch counts.
* **Local Data Storage**: All scan history is saved in the browser's `localStorage`, categorized by user-defined location profiles.
* **Shareable Reports**: Instantly generates pre-formatted text reports to share via WhatsApp or copy to the clipboard.
* **Modern UI**: Features a clean interface with light/dark modes and fluid animations.

***

### Tech Stack

* **Framework**: React
* **Scanning Library**: `html5-qrcode`
* **Animation**: Framer Motion
* **Icons**: Lucide React
* **State**: React Context API

***

### Quick Setup

1.  Clone the repository.
2.  Run `npm install`.
3.  Run `npm run dev`.