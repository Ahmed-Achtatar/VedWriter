// IndexedDB wrapper service for local storage
import { openDatabase } from './dbOpen.js';

const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
const MAX_BACKUP_JOURNALS = 10000;
const MAX_BACKUP_ENTRIES = 100000;
const MAX_BACKUP_SETTINGS = 32;
const ENTRY_STORAGE_FIELDS = [
  'id', 'journalId', 'entryType', 'canvasTemplate',
  'encryptedTitle', 'encryptedBody', 'encryptedTags', 'encryptedDrafts',
  'dateCreated', 'dateModified', 'position', 'wordGoal'
];
const JOURNAL_STORAGE_FIELDS = ['id', 'encryptedTitle', 'coverType', 'dateCreated', 'dateModified', 'position'];
const SETTING_KEYS = new Set(['salt', 'verifier', 'verifier_hash', 'iterations']);

// Runtime entries also contain decrypted fields for React. Never persist those
// fields: IndexedDB and exported backups must contain ciphertext plus metadata.
export function toStoredEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error('Invalid entry record');
  }

  const stored = {};
  ENTRY_STORAGE_FIELDS.forEach((field) => {
    if (entry[field] !== undefined) stored[field] = entry[field];
  });
  if (typeof stored.id !== 'string' || !stored.id || typeof stored.journalId !== 'string' || !stored.journalId) {
    throw new Error('Entry identity is invalid');
  }
  if (!['page', 'canvas'].includes(stored.entryType || 'page')) stored.entryType = 'page';
  ['encryptedTitle', 'encryptedBody', 'encryptedTags'].forEach((field) => {
    if (typeof stored[field] !== 'string' || !stored[field]) throw new Error(`Missing ${field}`);
  });
  if (stored.encryptedDrafts !== undefined && typeof stored.encryptedDrafts !== 'string') {
    throw new Error('Invalid encrypted drafts');
  }
  return stored;
}

export function toStoredJournal(journal) {
  if (!journal || typeof journal !== 'object' || Array.isArray(journal)) throw new Error('Invalid journal record');
  const stored = {};
  JOURNAL_STORAGE_FIELDS.forEach((field) => {
    if (journal[field] !== undefined) stored[field] = journal[field];
  });
  if (typeof stored.id !== 'string' || !stored.id || typeof stored.encryptedTitle !== 'string' || !stored.encryptedTitle) {
    throw new Error('Invalid journal record');
  }
  return stored;
}

function validateBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid backup');
  if (!Array.isArray(data.journals) || !Array.isArray(data.entries) || !Array.isArray(data.settings)) {
    throw new Error('Invalid backup structure');
  }
  if (data.journals.length > MAX_BACKUP_JOURNALS || data.entries.length > MAX_BACKUP_ENTRIES || data.settings.length > MAX_BACKUP_SETTINGS) {
    throw new Error('Backup exceeds safe limits');
  }
  if (JSON.stringify(data).length > MAX_BACKUP_BYTES) throw new Error('Backup is too large');

  const journalIds = new Set();
  data.journals.forEach((journal) => {
    const stored = toStoredJournal(journal);
    if (journalIds.has(stored.id)) throw new Error('Duplicate journal id');
    journalIds.add(stored.id);
  });

  data.entries.forEach((entry) => {
    const stored = toStoredEntry(entry);
    if (!journalIds.has(stored.journalId)) throw new Error('Entry references a missing journal');
  });

  data.settings.forEach((setting) => {
    if (!setting || typeof setting !== 'object' || Array.isArray(setting) || !SETTING_KEYS.has(setting.key)) {
      throw new Error('Invalid setting record');
    }
  });
}

// Get a setting by key
export async function getSetting(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('settings', 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => reject(request.error);
  });
}

// Set a setting
export async function setSetting(key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('settings', 'readwrite');
    const store = transaction.objectStore('settings');
    const request = store.put({ key, value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function setSettings(settings) {
  const records = Object.entries(settings || {}).map(([key, value]) => ({ key, value }));
  if (!records.every((record) => SETTING_KEYS.has(record.key))) throw new Error('Invalid setting key');
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('settings', 'readwrite');
    const store = transaction.objectStore('settings');
    records.forEach((record) => store.put(record));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Failed to save settings'));
    transaction.onabort = () => reject(transaction.error || new Error('Settings save aborted'));
  });
}

// Save a journal
export async function saveJournal(journal) {
  const db = await openDatabase();
  const storedJournal = toStoredJournal(journal);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('journals', 'readwrite');
    const store = transaction.objectStore('journals');
    const request = store.put(storedJournal);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get all journals
export async function getAllJournals() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('journals', 'readonly');
    const store = transaction.objectStore('journals');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Delete a journal and all its entries
export async function deleteJournal(journalId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['journals', 'entries'], 'readwrite');
    const journalStore = transaction.objectStore('journals');
    const entryStore = transaction.objectStore('entries');
    journalStore.delete(journalId);
    const cursorRequest = entryStore.index('journalId').openCursor(IDBKeyRange.only(journalId));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Failed to delete journal'));
    transaction.onabort = () => reject(transaction.error || new Error('Journal deletion aborted'));
  });
}

// Save an entry
export async function saveEntry(entry) {
  const db = await openDatabase();
  const storedEntry = toStoredEntry(entry);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('entries', 'readwrite');
    const store = transaction.objectStore('entries');
    const request = store.put(storedEntry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get all entries for a journal
export async function getEntriesForJournal(journalId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('entries', 'readonly');
    const store = transaction.objectStore('entries');
    const index = store.index('journalId');
    const request = index.getAll(journalId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Delete a single entry
export async function deleteEntry(entryId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('entries', 'readwrite');
    const store = transaction.objectStore('entries');
    const request = store.delete(entryId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Delete a batch in one transaction so mass deletion cannot leave a partially
// removed selection behind.
export async function deleteEntries(entryIds) {
  const ids = [...new Set((entryIds || []).filter((id) => typeof id === 'string' && id))];
  if (!ids.length) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('entries', 'readwrite');
    const store = transaction.objectStore('entries');
    ids.forEach((id) => store.delete(id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Failed to delete entries'));
    transaction.onabort = () => reject(transaction.error || new Error('Entry deletion aborted'));
  });
}

// Clear all data (Master reset)
export async function clearAllData() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['journals', 'entries', 'settings'], 'readwrite');
    transaction.objectStore('journals').clear();
    transaction.objectStore('entries').clear();
    transaction.objectStore('settings').clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Bulk Import for Restore
export async function bulkImport(data) {
  validateBackup(data);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['journals', 'entries', 'settings'], 'readwrite');
    
    // Clear existing
    transaction.objectStore('journals').clear();
    transaction.objectStore('entries').clear();
    transaction.objectStore('settings').clear();

    const journalStore = transaction.objectStore('journals');
    const entryStore = transaction.objectStore('entries');
    const settingsStore = transaction.objectStore('settings');

    // Load journals
    data.journals.forEach(j => journalStore.put(toStoredJournal(j)));
    // Load entries
    data.entries.forEach(e => entryStore.put(toStoredEntry(e)));
    // Load settings (salt and verifier)
    data.settings.forEach(s => settingsStore.put(s));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Export All Data (Encrypted)
export async function exportAllData() {
  const db = await openDatabase();
  const result = { journals: [], entries: [], settings: [] };

  const getJournals = new Promise((resolve, reject) => {
    const store = db.transaction('journals', 'readonly').objectStore('journals');
    const request = store.getAll();
    request.onsuccess = (e) => { result.journals = (e.target.result || []).map(toStoredJournal); resolve(); };
    request.onerror = () => reject(request.error);
  });

  const getEntries = new Promise((resolve, reject) => {
    const store = db.transaction('entries', 'readonly').objectStore('entries');
    const request = store.getAll();
    request.onsuccess = (e) => { result.entries = (e.target.result || []).map(toStoredEntry); resolve(); };
    request.onerror = () => reject(request.error);
  });

  const getSettings = new Promise((resolve, reject) => {
    const store = db.transaction('settings', 'readonly').objectStore('settings');
    const request = store.getAll();
    request.onsuccess = (e) => { result.settings = e.target.result || []; resolve(); };
    request.onerror = () => reject(request.error);
  });

  await Promise.all([getJournals, getEntries, getSettings]);
  return result;
}
