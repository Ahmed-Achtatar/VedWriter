# VedWriter

**A private, offline-first journal for people who want their thoughts to stay on their device.**

VedWriter is an open-source journal and study-notes app built with React and Tauri. Entries are encrypted locally with the Web Crypto API and stored in browser-native IndexedDB. No account, cloud backend, or network connection is required to use the app.

> VedWriter is currently early-stage software. Keep independent backups of important data and read [SECURITY.md](SECURITY.md) before relying on it for sensitive records.

## Features

- Private by default: passwords and journal content are not sent to a VedWriter server.
- Offline-first local storage with IndexedDB.
- Local AES-GCM-256 encryption using a password-derived key.
- Multiple journals, pinned pages, covers, reordering, and entry templates.
- Desktop packaging for Windows, macOS, and Linux through Tauri 2.

## Screenshot

![VedWriter journal interface](src/assets/hero.png)

## Download

Installers will be published on the [GitHub Releases page](https://github.com/Ahmed-Achtatar/VedWriter/releases). Until the first release is available, run VedWriter from source below.

## Development

Requirements: Node.js 18+ and Rust with platform build tools for Tauri.

```bash
git clone https://github.com/Ahmed-Achtatar/VedWriter.git
cd VedWriter
npm install
npm run dev
```

Run the native desktop shell with `npm run tauri:dev`. Build the web app with `npm run build` or desktop installers with `npm run tauri:build`.

## Security at a glance

The current implementation derives an AES-GCM-256 key from the master password with PBKDF2-SHA-256 and 100,000 iterations, then stores encrypted records locally. See [SECURITY.md](SECURITY.md) for scope and limitations.

VedWriter cannot recover a forgotten password. Losing the password or an exported backup can mean losing access to the data.

## Contributing

Bug reports, documentation, translations, accessibility fixes, and security review are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.

## Roadmap

- Signed cross-platform releases
- Automated encryption and restore tests
- Import tools for common journal formats
- More accessibility and localization coverage
- Optional, user-controlled multi-device synchronization

## License

VedWriter is released under the [MIT License](LICENSE).
