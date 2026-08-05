const DB_NAME = 'VedWriterDB';
const DB_VERSION = 2;

let dbInstance = null;

function scrubLegacyRuntimeFields(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['journals', 'entries'], 'readwrite');
    const scrub = (store, fields) => {
      const cursorRequest = store.openCursor();
      cursorRequest.onerror = () => reject(cursorRequest.error || new Error('Could not migrate stored records'));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        const value = cursor.value;
        fields.forEach((field) => { delete value[field]; });
        cursor.update(value);
        cursor.continue();
      };
    };
    scrub(transaction.objectStore('journals'), ['title', 'entryCount']);
    scrub(transaction.objectStore('entries'), ['title', 'body', 'tags', 'drafts']);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not migrate stored records'));
    transaction.onabort = () => reject(transaction.error || new Error('Record migration aborted'));
  });
}

export function openDatabase() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      reject('Error opening database: ' + event.target.error);
    };

    request.onsuccess = (event) => {
      const openedDb = event.target.result;
      dbInstance = openedDb;
      openedDb.onversionchange = () => {
        openedDb.close();
        if (dbInstance === openedDb) dbInstance = null;
      };
      openedDb.onclose = () => {
        if (dbInstance === openedDb) dbInstance = null;
      };
      scrubLegacyRuntimeFields(openedDb).then(() => resolve(openedDb), reject);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create journals store
      if (!db.objectStoreNames.contains('journals')) {
        db.createObjectStore('journals', { keyPath: 'id' });
      }

      // Create entries store with journalId index
      if (!db.objectStoreNames.contains('entries')) {
        const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
        entryStore.createIndex('journalId', 'journalId', { unique: false });
      }

      // Create settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

    };
  });
}
