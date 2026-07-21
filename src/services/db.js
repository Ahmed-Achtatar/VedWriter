// IndexedDB wrapper service for local storage
import { openDatabase } from './dbOpen.js';

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

// Save a journal
export async function saveJournal(journal) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('journals', 'readwrite');
    const store = transaction.objectStore('journals');
    const request = store.put(journal);
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
  
  // 1. Delete journal metadata
  await new Promise((resolve, reject) => {
    const transaction = db.transaction('journals', 'readwrite');
    const store = transaction.objectStore('journals');
    const request = store.delete(journalId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // 2. Delete all entries in that journal
  const entries = await getEntriesForJournal(journalId);
  for (const entry of entries) {
    await deleteEntry(entry.id);
  }
}

// Save an entry
export async function saveEntry(entry) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('entries', 'readwrite');
    const store = transaction.objectStore('entries');
    const request = store.put(entry);
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
    if (data.journals) {
      data.journals.forEach(j => journalStore.put(j));
    }
    // Load entries
    if (data.entries) {
      data.entries.forEach(e => entryStore.put(e));
    }
    // Load settings (salt and verifier)
    if (data.settings) {
      data.settings.forEach(s => settingsStore.put(s));
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Export All Data (Encrypted)
export async function exportAllData() {
  const db = await openDatabase();
  const result = { journals: [], entries: [], settings: [] };

  const getJournals = new Promise((resolve) => {
    const store = db.transaction('journals', 'readonly').objectStore('journals');
    store.getAll().onsuccess = (e) => { result.journals = e.target.result || []; resolve(); };
  });

  const getEntries = new Promise((resolve) => {
    const store = db.transaction('entries', 'readonly').objectStore('entries');
    store.getAll().onsuccess = (e) => { result.entries = e.target.result || []; resolve(); };
  });

  const getSettings = new Promise((resolve) => {
    const store = db.transaction('settings', 'readonly').objectStore('settings');
    store.getAll().onsuccess = (e) => { result.settings = e.target.result || []; resolve(); };
  });

  await Promise.all([getJournals, getEntries, getSettings]);
  return result;
}
