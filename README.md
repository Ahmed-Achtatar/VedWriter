# VedWriter

VedWriter is an offline-first, zero-knowledge encrypted journal application designed for private note-taking, reflection, and structured study. All user data is encrypted client-side using Web Crypto APIs and persisted locally in IndexedDB.

---

## Key Features

- **End-to-End Client Encryption**: Data is protected via PBKDF2 key derivation (600,000 iterations) and AES-GCM (256-bit) encryption. Passwords and unencrypted data never leave your local environment.
- **Offline-First Storage**: Uses browser-native IndexedDB for fast local persistence without mandatory cloud backends.
- **Cross-Platform**: Built as a React single-page application and wrapped into a native desktop application using Tauri 2.
- **Organization & Templates**: Multi-journal support with custom covers, pinned pages, drag-and-drop reordering, and built-in entry templates.
- **Security Features**: Auto-locks after 15 minutes of user inactivity and includes encrypted backup/restore capabilities.

---

## Tech Stack

- **Frontend**: React 19, Vite, Lucide Icons, CSS3
- **Desktop Runtime**: Tauri 2 (Rust)
- **Security**: Web Crypto API (`crypto.subtle`)
- **Database**: IndexedDB

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/) (required only for building the desktop app)

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Ahmed-Achtatar/VedWriter.git
   cd VedWriter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run web dev server:
   ```bash
   npm run dev
   ```

4. Run desktop dev server (Tauri):
   ```bash
   npm run tauri:dev
   ```

---

## Production Build

To build the native desktop installer (`.msi` / `.exe` for Windows, `.dmg` for macOS, `.AppImage` for Linux):

```bash
npm run tauri:build
```

The output installers will be generated under `src-tauri/target/release/bundle/`.

---

## License

This project is licensed under the [MIT License](LICENSE).
