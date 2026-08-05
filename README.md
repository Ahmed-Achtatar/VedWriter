# VedWriter

**A private, offline-first journal for people who want their thoughts to stay on their device.**

VedWriter is an open-source journal and study-notes app built with React and Tauri. Entries are encrypted locally with the Web Crypto API and stored in browser-native IndexedDB. No account, cloud backend, or network connection is required to use the app.

> VedWriter is currently early-stage software. Keep independent backups of important data and read [SECURITY.md](SECURITY.md) before relying on it for sensitive records.

## Features

### Private journal workspace

- Password-protected journals stored locally in IndexedDB.
- AES-GCM-256 encryption with a PBKDF2-SHA-256 password-derived key.
- Rich-text pages with headings, lists, formatting, tags, search, pinning, reordering, and templates.
- Drag-and-drop attachments for images, audio, video, PDFs, and documents.
- Multiple journals with covers, page management, and mobile-friendly navigation.

### Canvas pages

- Create Sticky Notes, Mind Maps, Kanban Boards, Moodboards, and Whiteboards.
- Move, resize, edit, connect, group, collapse, and organize cards on a freeform canvas.
- Add images and media, use focus mode and keyboard shortcuts, and search canvas cards.
- Export a canvas as PNG, SVG, or print/PDF, or send selected canvas content to a regular page.

### Side panel

- Open the named Side panel from the normal app and reveal it from the screen edge.
- Pin it to keep it open, or let it stay unobtrusive when it is not being used.
- Choose any journal and regular page, load its existing content, and edit the page freely.
- Create a new page directly from the panel; canvas pages are intentionally excluded from its page editor.

### Backup and sharing

- Export and restore the complete encrypted database as a local backup.
- Export an individual page as Markdown, plain text, or print/PDF.
- Create a password-protected, self-decrypting HTML copy of an individual page.
- Contact the developer from the normal app through email or WhatsApp.

VedWriter does not include a cloud backend, account system, synchronization service, or built-in analytics.

## Screenshot

![VedWriter journal interface](docs/screenshots/User%20attachment.png)

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

Run the native desktop shell with `npm run tauri:dev`. Build the web app with `npm run build`, or create a local desktop release with `npm run tauri:build`. Generated release files are intentionally not committed to the repository.

## Security at a glance

The current implementation derives an AES-GCM-256 key from the master password with PBKDF2-SHA-256 and 600,000 iterations, then stores ciphertext-only records locally. See [SECURITY.md](SECURITY.md) for scope and limitations.

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
