# Security Policy

## Scope

VedWriter is a local-first application. Journal entries are encrypted in the application before being persisted to IndexedDB. The project does not currently provide a server, account system, or built-in synchronization service.

The current implementation uses Web Crypto AES-GCM with 256-bit keys and PBKDF2-SHA-256 with 100,000 iterations. This describes the implementation today; it is not a guarantee that the application protects against every local compromise.

## Important limitations

- A compromised device, browser profile, operating system, or runtime may access data while VedWriter is unlocked.
- The master key is held in memory while the application is unlocked.
- Browser storage can be deleted or corrupted. Export backups should be stored securely and tested.
- Anyone with the password can decrypt the data.
- There is no password recovery mechanism.
- Exported backups may contain encrypted application data and should still be treated as sensitive.

## Reporting a vulnerability

Please do not publish an unpatched security vulnerability in an issue. Use GitHub's private vulnerability reporting for this repository when available. If it is unavailable, contact the repository owner privately through GitHub with a description, impact, reproduction steps, affected versions, and suggested mitigation.
