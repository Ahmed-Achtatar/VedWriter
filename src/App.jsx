import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Plus, KeyRound, ShieldAlert, RefreshCw, CheckCircle2, AlertTriangle, Search } from 'lucide-react';

import {
  getSetting, setSettings, saveJournal, getAllJournals,
  deleteJournal, saveEntry, getEntriesForJournal, deleteEntries,
  clearAllData, bulkImport, exportAllData
} from './services/db';

import {
  encryptText, decryptText, generateRandomString,
  initKey, encryptWithKey, decryptWithKey, clearKey
} from './services/crypto';

import { initTheme } from './theme';
import Header from './components/Header';
import JournalCard from './components/JournalCard';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import CanvasEntry, { CanvasErrorBoundary } from './components/canvas/CanvasEntry';
import { createStarterBody } from './components/canvas/canvasUtils';
import CreateJournalModal from './components/CreateJournalModal';
import ShareBackupModal from './components/ShareBackupModal';
import ContactDeveloperModal from './components/ContactDeveloperModal';
import EdgeWidget from './components/EdgeWidget';
import { sanitizeHtml } from './utils/sanitizeHtml';

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const AUTO_LOCK_MINUTES = 15;
const AUTO_LOCK_CHECK_MS = 60000;
const EDGE_WIDGET_MODE_KEY = 'vedwriter.edge-widget.enabled';

function setEdgeWidgetPreference(enabled) {
  try {
    localStorage.setItem(EDGE_WIDGET_MODE_KEY, String(enabled));
  } catch {
    // Storage can be unavailable in a restricted webview.
  }
}

function shouldOpenEdgeWidget() {
  try {
    return localStorage.getItem(EDGE_WIDGET_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function App() {
  useEffect(() => { initTheme(); }, []);

  // Auth
  const [hasAccount, setHasAccount] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [salt, setSalt] = useState('');
  const [verifier, setVerifier] = useState('');
  const [verifierHash, setVerifierHash] = useState('');
  const [iterations, setIterations] = useState(100000);
  const [loading, setLoading] = useState(true);

  // UI
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });
  const [edgeWidgetMode, setEdgeWidgetMode] = useState(false);
  const [showSidePanelHint, setShowSidePanelHint] = useState(false);

  const openEdgeWidget = () => {
    setEdgeWidgetPreference(true);
    setShowSidePanelHint(true);
    setEdgeWidgetMode(true);
  };

  const closeEdgeWidget = () => {
    setEdgeWidgetPreference(false);
    setShowSidePanelHint(false);
    setEdgeWidgetMode(false);
  };

  // Once the user enables the dock, bring it back automatically after unlock.
  useEffect(() => {
    if (!loading && !isLocked && shouldOpenEdgeWidget()) setEdgeWidgetMode(true);
  }, [isLocked, loading]);

  // Alt+Shift+W toggles the Side panel even when its collapsed hit area is
  // visually quiet.
  useEffect(() => {
    const handleEdgeWidgetShortcut = (event) => {
      if (event.altKey && event.shiftKey && event.code === 'KeyW') {
        event.preventDefault();
        if (edgeWidgetMode) closeEdgeWidget();
        else openEdgeWidget();
      }
    };
    window.addEventListener('keydown', handleEdgeWidgetShortcut);
    return () => window.removeEventListener('keydown', handleEdgeWidgetShortcut);
  }, [edgeWidgetMode]);

  // Dashboard
  const [journals, setJournals] = useState([]);
  const [activeJournal, setActiveJournal] = useState(null);
  const [entries, setEntries] = useState([]);
  const [activeEntry, setActiveEntry] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const saveQueuesRef = React.useRef(new Map());
  const saveRevisionRef = React.useRef(new Map());
  const deletedEntryIdsRef = React.useRef(new Set());
  const deletedJournalIdsRef = React.useRef(new Set());
  const activeJournalIdRef = React.useRef(null);
  const loadEntriesRequestRef = React.useRef(0);
  const loadJournalsRequestRef = React.useRef(0);

  // Dashboard search and sort
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showContactDeveloperModal, setShowContactDeveloperModal] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);


  // Pinned entries
  const [pinnedEntries, setPinnedEntries] = useState([]);

  // Auto-lock timer
  const lastActivityRef = React.useRef(Date.now());

  // Load setup status
  useEffect(() => {
    async function initCheck() {
      try {
        const storedSalt = await getSetting('salt');
        const storedVerifier = await getSetting('verifier');
        const storedVerifierHash = await getSetting('verifier_hash');
        const storedIterations = await getSetting('iterations');
        if (storedSalt && storedVerifier) {
          setHasAccount(true);
          setSalt(storedSalt);
          setVerifier(storedVerifier);
          setVerifierHash(storedVerifierHash || '');
          setIterations(storedIterations || 100000);
        } else {
          setHasAccount(false);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    }
    initCheck();
  }, []);

  // Track user activity for auto-lock
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, updateActivity));
  }, []);

  // Auto-lock check every minute
  useEffect(() => {
    if (isLocked || loading) return;
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > AUTO_LOCK_MINUTES * 60000) {
        handleLock();
        showToast('Auto-locked after inactivity.');
      }
    }, AUTO_LOCK_CHECK_MS);
    return () => clearInterval(interval);
  }, [isLocked, loading]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      // Esc to close modals
      if (e.key === 'Escape') {
        if (showCreateModal) setShowCreateModal(false);
        if (showShareModal) setShowShareModal(false);
        if (showContactDeveloperModal) setShowContactDeveloperModal(false);
        return;
      }
      // Ctrl+K for search (only on dashboard)
      if (mod && e.key === 'k' && !activeJournal) {
        e.preventDefault();
        const el = document.getElementById('dashboard-search');
        if (el) el.focus();
        return;
      }
      // Ctrl+S for save on workspace
      if (mod && e.key === 's' && activeJournal) {
        e.preventDefault();
        showToast('Save triggered.');
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [showContactDeveloperModal, showCreateModal, showShareModal, activeJournal]);

  // Toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 3000);
  };

  // 1. Account Setup
  const handleSetup = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      setShake(true); setTimeout(() => setShake(false), 500);
      return;
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      setShake(true); setTimeout(() => setShake(false), 500);
      return;
    }
    setLoading(true);
    try {
      const generatedSalt = generateRandomString(16);
      const newIterations = 600000;
      const randomVerifierToken = generateRandomString(32);
      const encryptedVerifier = await encryptText(randomVerifierToken, password, generatedSalt, newIterations);
      const hash = await sha256(randomVerifierToken);

      await setSettings({ salt: generatedSalt, verifier: encryptedVerifier, verifier_hash: hash, iterations: newIterations });

      setSalt(generatedSalt);
      setVerifier(encryptedVerifier);
      setVerifierHash(hash);
      setIterations(newIterations);
      setHasAccount(true);
      setIsLocked(false);
      // Cache the derived key for fast subsequent encrypt/decrypt
      await initKey(password, generatedSalt, newIterations);
      lastActivityRef.current = Date.now();
      showToast('Master password set successfully!');
    } catch (err) {
      console.error(err);
      showToast('Setup failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2. Unlock
  const handleUnlock = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const decrypted = await decryptText(verifier, password, salt, iterations);
      let verified = false;
      let upgradedIterations = iterations;

      if (verifierHash) {
        const computedHash = await sha256(decrypted);
        if (computedHash === verifierHash) {
          verified = true;
        }
      } else {
        // Legacy fallback
        if (decrypted === 'verification_token') {
          verified = true;
          // Upgrade legacy user to 600k iterations / verifier hash unique token
          try {
            const newIterations = 600000;
            const randomVerifierToken = generateRandomString(32);
            const newEncryptedVerifier = await encryptText(randomVerifierToken, password, salt, newIterations);
            const hash = await sha256(randomVerifierToken);

            await setSettings({ verifier: newEncryptedVerifier, verifier_hash: hash, iterations: newIterations });

            // Re-encrypt all journals and entries
            const rawJournals = await getAllJournals();
            for (const j of rawJournals) {
              const decTitle = await decryptText(j.encryptedTitle, password, salt, 100000);
              const encTitle = await encryptText(decTitle, password, salt, newIterations);
              await saveJournal({ ...j, encryptedTitle: encTitle });

              const rawEntries = await getEntriesForJournal(j.id);
              for (const ent of rawEntries) {
                const t = await decryptText(ent.encryptedTitle, password, salt, 100000);
                const b = await decryptText(ent.encryptedBody, password, salt, 100000);
                const tgs = await decryptText(ent.encryptedTags, password, salt, 100000);
                const encT = await encryptText(t, password, salt, newIterations);
                const encB = await encryptText(b, password, salt, newIterations);
                const encTgs = await encryptText(tgs, password, salt, newIterations);
                await saveEntry({
                  ...ent,
                  encryptedTitle: encT,
                  encryptedBody: encB,
                  encryptedTags: encTgs
                });
              }
            }

            setVerifier(newEncryptedVerifier);
            setVerifierHash(hash);
            setIterations(newIterations);
            upgradedIterations = newIterations;
            console.log('Successfully upgraded legacy database to 600,000 iterations.');
          } catch (upgradeErr) {
            console.error('Database security upgrade failed:', upgradeErr);
          }
        }
      }

      if (verified) {
        setIsLocked(false);
        lastActivityRef.current = Date.now();
        // Cache the derived key for fast subsequent encrypt/decrypt
        await initKey(password, salt, upgradedIterations);
        showToast('Welcome back!');
        await loadJournals();
      } else throw new Error('Verification failed');
    } catch (err) {
      console.error('Unlock error:', err);
      showToast('Incorrect master password.', 'error');
      setShake(true); setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  // 3. Lock
  const handleLock = () => {
    clearKey(); // clear cached crypto key
    setEdgeWidgetMode(false);
    activeJournalIdRef.current = null;
    loadEntriesRequestRef.current += 1;
    loadJournalsRequestRef.current += 1;
    setIsLocked(true);
    setPassword(''); setConfirmPassword('');
    setJournals([]); setActiveJournal(null); setEntries([]); setActiveEntry(null);
    showToast('Journal locked.');
  };

  // Load journals
  // Loading states
  const [journalsLoading, setJournalsLoading] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const loadJournals = async () => {
    const requestId = ++loadJournalsRequestRef.current;
    setJournalsLoading(true);
    try {
      const raw = await getAllJournals();
      // Decrypt all journals in parallel using cached key
      const decrypted = await Promise.all(
        raw.map(async (j) => {
          try {
            const decTitle = await decryptWithKey(j.encryptedTitle);
            const jEntries = await getEntriesForJournal(j.id);
            return { ...j, title: decTitle, entryCount: jEntries.length };
          } catch { return null; }
        })
      );
      if (requestId === loadJournalsRequestRef.current) setJournals(decrypted.filter(Boolean));
    } catch { showToast('Failed to load journals.', 'error'); }
    finally {
      if (requestId === loadJournalsRequestRef.current) setJournalsLoading(false);
    }
  };

  // Create journal
  const handleCreateJournal = async (title, coverType) => {
    try {
      const id = generateRandomString(12);
      const encTitle = await encryptWithKey(title);
      await saveJournal({ id, encryptedTitle: encTitle, coverType, dateCreated: Date.now() });
      showToast('Journal created.');
      await loadJournals();
    } catch { showToast('Failed to create journal.', 'error'); }
  };

  // Select journal
  const handleSelectJournal = async (journal) => {
    activeJournalIdRef.current = journal.id;
    setActiveJournal(journal); setEntries([]); setActiveEntry(null);
    await loadEntries(journal.id);
  };

  // Load entries (parallel decryption with cached key)
  const loadEntries = async (journalId) => {
    const requestId = ++loadEntriesRequestRef.current;
    setEntriesLoading(true);
    try {
      const raw = await getEntriesForJournal(journalId);
      // Decrypt all entries in parallel
      const decrypted = await Promise.all(
        raw.map(async (e) => {
          try {
            const title = await decryptWithKey(e.encryptedTitle);
            const body = await decryptWithKey(e.encryptedBody);
            const tags = JSON.parse(await decryptWithKey(e.encryptedTags));
            const drafts = e.encryptedDrafts ? JSON.parse(await decryptWithKey(e.encryptedDrafts)) : [];
            return { ...e, title, body, tags, drafts, entryType: e.entryType || 'page', canvasTemplate: e.canvasTemplate || null };

          } catch { return null; }
        })
      );
      const valid = decrypted.filter(Boolean);
      valid.sort((a, b) => {
        if (a.position !== undefined && b.position !== undefined) {
          return a.position - b.position;
        }
        return b.dateCreated - a.dateCreated;
      });
      if (requestId === loadEntriesRequestRef.current && activeJournalIdRef.current === journalId) {
        setEntries(valid);
      }
    } catch { showToast('Failed to load entries.', 'error'); }
    finally {
      if (requestId === loadEntriesRequestRef.current) setEntriesLoading(false);
    }
  };

  // Decrypted page data for the Side panel's target selector and continuation preview.
  const loadWidgetEntries = React.useCallback(async (journalId) => {
    const rawEntries = (await getEntriesForJournal(journalId))
      .filter((entry) => entry.entryType !== 'canvas');
    const summaries = await Promise.all(rawEntries.map(async (entry) => {
      try {
        return {
          id: entry.id,
          title: await decryptWithKey(entry.encryptedTitle),
          body: await decryptWithKey(entry.encryptedBody),
          dateModified: entry.dateModified || entry.dateCreated,
          position: entry.position,
          entryType: entry.entryType || 'page'
        };
      } catch {
        return null;
      }
    }));

    return summaries.filter(Boolean).sort((a, b) => {
      if (a.position !== undefined && b.position !== undefined) return a.position - b.position;
      return (b.dateModified || 0) - (a.dateModified || 0);
    });
  }, []);

  // Create entry
  const handleCreateEntry = async (payload) => {
    if (!activeJournal) return;
    try {
      const id = generateRandomString(16);
      let entryTitle = 'Untitled Page';
      let entryBody = '';
      let entryTags = [];
      let entryType = 'page';
      let canvasTemplate = null;

      if (payload && typeof payload === 'object') {
        entryType = payload.entryType || 'page';
        if (entryType === 'canvas') {
          canvasTemplate = payload.canvasTemplate || 'sticky';
        } else {
          if (payload.title) entryTitle = payload.title;
          if (payload.body) entryBody = payload.body;
          if (Array.isArray(payload.tags)) entryTags = payload.tags;
          const templateId = payload.templateId;
          if (templateId && !payload.title && !payload.body) {
            const now = new Date();
            switch (templateId) {
              case 'daily':
                entryTitle = `Reflection — ${now.toLocaleDateString()}`;
                entryBody = '<h2>Today I learned</h2><p></p><h2>Challenges</h2><p></p><h2>Tomorrow</h2><p></p>';
                break;
              case 'study':
                entryTitle = 'Study Notes';
                entryBody = '<h2>Topic</h2><p></p><h2>Key Points</h2><ul><li></li><li></li></ul><h2>Summary</h2><p></p>';
                break;
              case 'meeting':
                entryTitle = `Meeting — ${now.toLocaleDateString()}`;
                entryBody = '<h2>Attendees</h2><p></p><h2>Agenda</h2><ul><li></li></ul><h2>Action Items</h2><ul><li></li></ul>';
                break;
              default: break;
            }
          }
        }
      } else if (typeof payload === 'string' || payload === null) {
        const templateId = payload;
        if (templateId) {
          const now = new Date();
          switch (templateId) {
            case 'daily':
              entryTitle = `Reflection — ${now.toLocaleDateString()}`;
              entryBody = '<h2>Today I learned</h2><p></p><h2>Challenges</h2><p></p><h2>Tomorrow</h2><p></p>';
              break;
            case 'study':
              entryTitle = 'Study Notes';
              entryBody = '<h2>Topic</h2><p></p><h2>Key Points</h2><ul><li></li><li></li></ul><h2>Summary</h2><p></p>';
              break;
            case 'meeting':
              entryTitle = `Meeting — ${now.toLocaleDateString()}`;
              entryBody = '<h2>Attendees</h2><p></p><h2>Agenda</h2><ul><li></li></ul><h2>Action Items</h2><ul><li></li></ul>';
              break;
            default: break;
          }
        }
      }

      if (entryType === 'canvas') {
        const titles = {
          sticky: 'Sticky Notes',
          mindmap: 'Mind Map',
          kanban: 'Kanban Board',
          moodboard: 'Moodboard',
          whiteboard: 'Whiteboard'
        };
        entryTitle = titles[canvasTemplate] || 'Canvas';
        entryBody = createStarterBody(canvasTemplate);
      }

      const encTitle = await encryptWithKey(entryTitle);
      const encBody = await encryptWithKey(entryBody);
      const encTags = await encryptWithKey(JSON.stringify(entryTags));

      const newEntry = {
        id, journalId: activeJournal.id,
        entryType, canvasTemplate,
        encryptedTitle: encTitle, encryptedBody: encBody, encryptedTags: encTags,
        dateCreated: Date.now(), dateModified: Date.now(),
        position: entries.length
      };
      await saveEntry(newEntry);
      const dec = { ...newEntry, title: entryTitle, body: entryBody, tags: entryTags };
      setEntries([dec, ...entries]);
      setActiveEntry(dec);
      showToast(entryType === 'canvas' ? 'New canvas added.' : 'New page added.');
      setJournals(journals.map(j => j.id === activeJournal.id ? { ...j, entryCount: j.entryCount + 1 } : j));
      setActiveJournal(prev => prev ? { ...prev, entryCount: prev.entryCount + 1 } : null);
    } catch { showToast('Failed to add page.', 'error'); }
  };

  // Side panel page save: replace a chosen page or create a new page in the
  // chosen journal. The write still goes through the same encrypted database.
  const handleSaveWidgetNote = async ({ journalId, entryId, title, content }) => {
    if (!journalId) throw new Error('Choose a journal first.');

    const rawEntries = await getEntriesForJournal(journalId);
    const safeContent = sanitizeHtml(content || '');
    const hasContent = safeContent
      .replace(/<br\s*\/?\s*>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .trim()
      .length > 0;
    const targetEntry = entryId ? rawEntries.find((entry) => entry.id === entryId) : null;
    const targetJournal = journals.find((journal) => journal.id === journalId);

    if (entryId && !targetEntry) throw new Error('That page is no longer available.');
    if (targetEntry?.entryType === 'canvas') {
      throw new Error('Canvas pages cannot be edited in the Side panel.');
    }
    if (!targetEntry && !hasContent) throw new Error('Write something before creating a page.');

    if (targetEntry) {
      const updatedBody = safeContent;
      const currentTitle = await decryptWithKey(targetEntry.encryptedTitle);
      const updatedTitle = String(title || '').trim() || currentTitle || 'Untitled page';
      const updatedEntry = {
        ...targetEntry,
        encryptedTitle: await encryptWithKey(updatedTitle),
        encryptedBody: await encryptWithKey(updatedBody),
        dateModified: Date.now()
      };

      await saveEntry(updatedEntry);

      if (activeJournal?.id === journalId) {
        setEntries((previous) => previous.map((entry) => entry.id === entryId
          ? { ...entry, title: updatedTitle, body: updatedBody, encryptedTitle: updatedEntry.encryptedTitle, encryptedBody: updatedEntry.encryptedBody, dateModified: updatedEntry.dateModified }
          : entry));
        setActiveEntry((previous) => previous?.id === entryId
          ? { ...previous, title: updatedTitle, body: updatedBody, encryptedTitle: updatedEntry.encryptedTitle, encryptedBody: updatedEntry.encryptedBody, dateModified: updatedEntry.dateModified }
          : previous);
      }
      return { entryId: targetEntry.id, title: updatedTitle, body: updatedBody };
    }

    const now = Date.now();
    const entryTitle = String(title || '').trim()
      || `New Page - ${new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const body = safeContent;
    const newEntry = {
      id: generateRandomString(16),
      journalId,
      entryType: 'page',
      encryptedTitle: await encryptWithKey(entryTitle),
      encryptedBody: await encryptWithKey(body),
      encryptedTags: await encryptWithKey(JSON.stringify([])),
      dateCreated: now,
      dateModified: now,
      position: rawEntries.length
    };

    await saveEntry(newEntry);
    setJournals((previous) => previous.map((journal) => journal.id === journalId
      ? { ...journal, entryCount: (journal.entryCount || 0) + 1, dateModified: now }
      : journal));

    if (activeJournal?.id === journalId) {
      const runtimeEntry = {
        ...newEntry,
        title: entryTitle,
        body,
        tags: [],
        drafts: []
      };
      setEntries((previous) => [runtimeEntry, ...previous]);
      setActiveEntry(runtimeEntry);
    }

    if (targetJournal) await loadJournals();
    return {
      entryId: newEntry.id,
      title: entryTitle,
      body,
      entry: { ...newEntry, title: entryTitle, body, tags: [], drafts: [] }
    };
  };

  // Save entry
  const handleSaveEntry = (updatedEntry) => {
    if (!updatedEntry?.id) return Promise.resolve();
    const entryId = updatedEntry.id;
    if (deletedEntryIdsRef.current.has(entryId) || deletedJournalIdsRef.current.has(updatedEntry.journalId)) {
      return Promise.reject(new Error('This entry is being deleted.'));
    }
    const revision = (saveRevisionRef.current.get(entryId) || 0) + 1;
    saveRevisionRef.current.set(entryId, revision);
    const previous = saveQueuesRef.current.get(entryId) || Promise.resolve();
    const saveTask = previous.catch(() => {}).then(async () => {
      if (deletedEntryIdsRef.current.has(entryId) || deletedJournalIdsRef.current.has(updatedEntry.journalId)) {
        throw new Error('This entry is being deleted.');
      }
      const encTitle = await encryptWithKey(updatedEntry.title || '');
      const encBody = await encryptWithKey(updatedEntry.body || '');
      const encTags = await encryptWithKey(JSON.stringify(Array.isArray(updatedEntry.tags) ? updatedEntry.tags : []));
      const encDrafts = await encryptWithKey(JSON.stringify(Array.isArray(updatedEntry.drafts) ? updatedEntry.drafts : []));
      const savedEntry = {
        ...updatedEntry,
        encryptedTitle: encTitle,
        encryptedBody: encBody,
        encryptedTags: encTags,
        encryptedDrafts: encDrafts,
        dateModified: Date.now(),
      };
      await saveEntry(savedEntry);
      // Older saves may finish after a newer edit. They remain persisted in
      // order, but must never push stale state back into the live workspace.
      if (saveRevisionRef.current.get(entryId) === revision && !deletedEntryIdsRef.current.has(entryId)) {
        setEntries((prev) => prev.map((entry) => entry.id === entryId ? savedEntry : entry));
        setActiveEntry((current) => current?.id === entryId ? savedEntry : current);
      }
      return savedEntry;
    });
    saveQueuesRef.current.set(entryId, saveTask);
    saveTask.then(() => {
      if (saveQueuesRef.current.get(entryId) === saveTask) saveQueuesRef.current.delete(entryId);
    }, () => {
      if (saveQueuesRef.current.get(entryId) === saveTask) saveQueuesRef.current.delete(entryId);
    });
    saveTask.catch((error) => {
      if (!deletedEntryIdsRef.current.has(entryId) && !deletedJournalIdsRef.current.has(updatedEntry.journalId)) {
        console.error('Failed to save entry:', error);
        showToast('Changes could not be saved.', 'error');
      }
    });
    return saveTask;
  };

  const handleCreatePageFromCanvas = async ({ title, body, tags }) => {
    await handleCreateEntry({ entryType: 'page', title, body, tags });
  };

  const handleOpenEntryFromCanvas = (entryId) => {
    const target = entries.find((item) => item.id === entryId);
    if (target) setActiveEntry(target);
  };

  const invalidateEntrySaves = async (entryId) => {
    const pending = saveQueuesRef.current.get(entryId);
    deletedEntryIdsRef.current.add(entryId);
    saveRevisionRef.current.set(entryId, (saveRevisionRef.current.get(entryId) || 0) + 1);
    if (pending) await pending.catch(() => {});
  };

  const invalidateAllSaves = async () => {
    const pendingIds = [...saveQueuesRef.current.keys()];
    await Promise.all(pendingIds.map((entryId) => invalidateEntrySaves(entryId)));
  };


  // Delete entry
  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Delete this page? This cannot be undone.')) return;
    await invalidateEntrySaves(entryId);
    try {
      await deleteEntries([entryId]);
      setEntries(prev => prev.filter(e => e.id !== entryId));
      setActiveEntry(null);
      showToast('Page deleted.');
      setJournals(prev => prev.map(j => j.id === activeJournal.id ? { ...j, entryCount: Math.max(0, j.entryCount - 1) } : j));
      setActiveJournal(prev => prev ? { ...prev, entryCount: Math.max(0, prev.entryCount - 1) } : null);
    } catch {
      deletedEntryIdsRef.current.delete(entryId);
      showToast('Failed to delete page.', 'error');
    }
  };

  // Delete journal (with typing confirmation)
  const [showDeleteJournal, setShowDeleteJournal] = useState(false);
  const [deleteJournalInput, setDeleteJournalInput] = useState('');

  const requestDeleteJournal = () => {
    if (!activeJournal) return;
    setDeleteJournalInput('');
    setShowDeleteJournal(true);
  };

  const confirmDeleteJournal = async () => {
    if (!activeJournal) return;
    if (deleteJournalInput.trim() !== activeJournal.title.trim()) {
      showToast('Journal name doesn\'t match.', 'error');
      return;
    }
    const journalId = activeJournal.id;
    let journalEntries = [];
    try {
      journalEntries = await getEntriesForJournal(journalId);
      deletedJournalIdsRef.current.add(journalId);
      await Promise.all(journalEntries.map((entry) => invalidateEntrySaves(entry.id)));
      await deleteJournal(journalId);
      showToast(`"${activeJournal.title}" deleted.`);
      activeJournalIdRef.current = null;
      setActiveJournal(null); setActiveEntry(null);
      setShowDeleteJournal(false);
      await loadJournals();
    } catch {
      deletedJournalIdsRef.current.delete(journalId);
      journalEntries.forEach((entry) => deletedEntryIdsRef.current.delete(entry.id));
      showToast('Failed to delete journal.', 'error');
    }
  };

  // Drag-to-reorder journals
  const [draggedJournalIndex, setDraggedJournalIndex] = useState(null);
  const handleJournalDragStart = (index) => setDraggedJournalIndex(index);
  const handleJournalDragOver = (e, index) => {
    e.preventDefault();
    if (draggedJournalIndex === null || draggedJournalIndex === index) return;
    const reordered = [...journals];
    const [item] = reordered.splice(draggedJournalIndex, 1);
    reordered.splice(index, 0, item);
    setJournals(reordered);
    setDraggedJournalIndex(index);
  };
  const handleJournalDragEnd = () => setDraggedJournalIndex(null);

  // Fullscreen mode (F11) — but custom: we want it to hide browser chrome, not system-level fullscreen
  useEffect(() => {
    const onKey = (e) => {
      // F11 is captured by browser, but we can listen for it. We use a different key combo.
      // Use Ctrl+Shift+F for in-app fullscreen (editor expands)
      if (e.ctrlKey && e.shiftKey && e.key === 'F' && activeJournal) {
        e.preventDefault();
        const root = document.documentElement;
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
        } else {
          root.requestFullscreen?.().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeJournal]);

  // Export
  const handleExportBackup = async () => {
    const detail = { promises: [] };
    window.dispatchEvent(new CustomEvent('vedwriter:flush-saves', { detail }));
    await Promise.all(detail.promises);
    await Promise.all([...saveQueuesRef.current.values()]);
    return exportAllData();
  };
  const handleImportBackup = async (backupData) => {
    await invalidateAllSaves();
    try {
      await bulkImport(backupData);
      deletedEntryIdsRef.current.clear();
      deletedJournalIdsRef.current.clear();
      handleLock();
      const s = await getSetting('salt');
      const v = await getSetting('verifier');
      const vh = await getSetting('verifier_hash');
      const it = await getSetting('iterations');
      if (s && v) {
        setHasAccount(true);
        setSalt(s);
        setVerifier(v);
        setVerifierHash(vh || '');
        setIterations(it || 100000);
      }
    } catch (error) {
      deletedEntryIdsRef.current.clear();
      deletedJournalIdsRef.current.clear();
      throw error;
    }
  };

  // Sort and filter journals
  const sortJournals = (list) => {
    const sorted = [...list];
    switch (sortBy) {
      case 'name': sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
      case 'entries': sorted.sort((a, b) => (b.entryCount || 0) - (a.entryCount || 0)); break;
      case 'created': sorted.sort((a, b) => (b.dateCreated || 0) - (a.dateCreated || 0)); break;
      case 'recent':
      default: sorted.sort((a, b) => (b.dateModified || b.dateCreated || 0) - (a.dateModified || a.dateCreated || 0)); break;
    }
    return sorted;
  };

  const filteredJournals = sortJournals(
    journals.filter(j => {
      const q = dashboardSearch.toLowerCase().trim();
      if (!q) return true;
      return j.title?.toLowerCase().includes(q);
    })
  );

  // Filter entries
  const filteredEntries = entries.filter(e => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return e.title?.toLowerCase().includes(q) || e.body?.toLowerCase().includes(q) || e.tags?.some(t => t.toLowerCase().includes(q));
  });

  // Reorder entries (for drag-drop)
  const sortedFilteredEntries = [...filteredEntries].sort((a, b) => {
    const aPinned = pinnedEntries.includes(a.id);
    const bPinned = pinnedEntries.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    
    if (a.position !== undefined && b.position !== undefined) {
      return a.position - b.position;
    }
    return b.dateCreated - a.dateCreated;
  });

  const togglePinEntry = (entryId) => {
    setPinnedEntries(prev => prev.includes(entryId) ? prev.filter(id => id !== entryId) : [...prev, entryId]);
  };

  const handleReorderEntries = async (reordered) => {
    const positionMap = new Map();
    reordered.forEach((entry, index) => {
      positionMap.set(entry.id, index);
    });

    const updatedEntries = entries.map((entry) => {
      if (positionMap.has(entry.id)) {
        return { ...entry, position: positionMap.get(entry.id) };
      }
      return entry;
    });

    setEntries(updatedEntries);

    try {
      for (const entry of reordered) {
        const newPos = positionMap.get(entry.id);
        await saveEntry({
          ...entry,
          position: newPos
        });
      }
    } catch (err) {
      console.error('Failed to save reordered entries:', err);
      showToast('Failed to save page order.', 'error');
    }
  };

  // Bulk delete entries from sidebar
  const handleBulkDeleteEntries = async (entryIds) => {
    const ids = [...new Set(entryIds || [])];
    if (!ids.length) return;
    await Promise.all(ids.map((id) => invalidateEntrySaves(id)));
    try {
      await deleteEntries(ids);
      setEntries(prev => prev.filter(e => !ids.includes(e.id)));
      if (activeEntry && ids.includes(activeEntry.id)) setActiveEntry(null);
      showToast(`${ids.length} page(s) deleted.`);
      setJournals(prev => prev.map(j => j.id === activeJournal.id ? { ...j, entryCount: Math.max(0, j.entryCount - ids.length) } : j));
      setActiveJournal(prev => prev ? { ...prev, entryCount: Math.max(0, prev.entryCount - ids.length) } : null);
    } catch {
      ids.forEach((id) => deletedEntryIdsRef.current.delete(id));
      showToast('Failed to delete selected pages.', 'error');
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="loading-screen">
        <RefreshCw className="spin" size={32} />
        <p>Deriving cryptographic keys...</p>
      </div>
    );
  }

  // 1. Lock Screen
  if (isLocked) {
    return (
      <div className="lock-screen-container">
        <div className={`lock-card animate-scale-up ${shake ? 'animate-shake' : ''}`}>
          <div className="lock-icon"><Lock size={28} /></div>
          <h1 className="lock-title">VedWriter</h1>
          <p className="lock-subtitle">Your private, offline journal for learning and thinking.</p>

          {!hasAccount ? (
            <form onSubmit={handleSetup}>
              <div className="input-group">
                <label className="input-label">Set Master Password</label>
                <input type="password" className="input" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Confirm Master Password</label>
                <input type="password" className="input" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
              </div>
              <div className="warning-box">
                <ShieldAlert size={18} style={{ flexShrink: 0, color: '#ef4444' }} />
                <span><strong>Important:</strong> VedWriter is fully local. If you lose this password, your journals cannot be recovered.</span>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                <KeyRound size={16} /> Create Private Database
              </button>
              <div className="lock-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowShareModal(true)}>Restore from backup</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleUnlock}>
              <div className="input-group">
                <label className="input-label">Enter Master Password</label>
                <input type="password" className="input" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                <Unlock size={16} /> Unlock Journals
              </button>
              <div className="lock-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowShareModal(true)}>Restore backup</button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }}
                  onClick={async () => {
                    if (!window.confirm('Permanently delete all data?')) return;
                    try {
                      await invalidateAllSaves();
                      await clearAllData();
                      clearKey();
                      deletedEntryIdsRef.current.clear();
                      deletedJournalIdsRef.current.clear();
                      activeJournalIdRef.current = null;
                      setHasAccount(false);
                      setIsLocked(true);
                      setJournals([]); setEntries([]); setActiveJournal(null); setActiveEntry(null);
                      showToast('Database wiped.');
                    } catch {
                      showToast('Factory reset failed.', 'error');
                    }
                  }}
                >Factory reset</button>
              </div>
            </form>
          )}
        </div>
        <ShareBackupModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} onImportBackup={handleImportBackup} />
        {toast.message && <div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}<span>{toast.message}</span></div>}
      </div>
    );
  }

  if (edgeWidgetMode) {
    return (
      <EdgeWidget
        activeEntry={activeEntry}
        activeJournal={activeJournal}
        entries={entries}
        journals={journals}
        onExitWidget={closeEdgeWidget}
        onLoadJournalEntries={loadWidgetEntries}
        onLock={handleLock}
        onSaveWidgetNote={handleSaveWidgetNote}
        showDiscoveryHintOnOpen={showSidePanelHint}
      />
    );
  }

  // 2. Dashboard
  if (!activeJournal) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header
          onBackup={() => setShowShareModal(true)}
          onLock={handleLock}
          onToggleEdgeWidget={openEdgeWidget}
          onContactDeveloper={() => setShowContactDeveloperModal(true)}
        />
        <main className="dashboard-container">
          <div className="page-header">
            <h2>My Journals</h2>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={18} /> New Journal
            </button>
          </div>

          {/* Global search + sort */}
          <div className="dashboard-controls">
            <div className="dashboard-search">
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="dashboard-search"
                type="text"
                className="input"
                placeholder="Search journals (Ctrl+K)..."
                value={dashboardSearch}
                onChange={e => setDashboardSearch(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>
            <select className="toolbar-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="recent">Most recent</option>
              <option value="name">By name</option>
              <option value="entries">Most entries</option>
              <option value="created">Date created</option>
            </select>
          </div>

          {journals.length === 0 ? (
            <div className="empty-state">
              <AlertTriangle size={48} />
              <h3>No Journals Found</h3>
              <p>Every great study habit starts with the first page. Create your first journal now.</p>
              <div className="empty-state-prompts">
                <span className="empty-prompt">Personal diary</span>
                <span className="empty-prompt">Study notes</span>
                <span className="empty-prompt">Project log</span>
              </div>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                Create First Journal
              </button>
            </div>
          ) : filteredJournals.length === 0 ? (
            <div className="empty-state">
              <Search size={48} />
              <h3>No Results</h3>
              <p>No journals match "{dashboardSearch}".</p>
            </div>
          ) : journalsLoading && journals.length === 0 ? (
            <div className="journal-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="journal-card skeleton-card">
                  <div className="skeleton-line skeleton-swatch" />
                  <div className="skeleton-line skeleton-card-title" />
                  <div className="skeleton-line skeleton-card-meta" />
                </div>
              ))}
            </div>
          ) : (
            <div className="journal-grid">
              {filteredJournals.map((j, i) => (
                <div key={j.id}
                  draggable
                  onDragStart={() => handleJournalDragStart(i)}
                  onDragOver={(e) => handleJournalDragOver(e, i)}
                  onDragEnd={handleJournalDragEnd}
                  className={draggedJournalIndex === i ? 'dragging' : ''}
                  style={{ cursor: 'grab' }}
                >
                  <JournalCard title={j.title} coverType={j.coverType} entryCount={j.entryCount}
                    dateModified={j.dateModified || j.dateCreated} onClick={() => handleSelectJournal(j)} />
                </div>
              ))}
            </div>
          )}
        </main>

        <CreateJournalModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onCreate={handleCreateJournal} />
        <ShareBackupModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} onExportBackup={handleExportBackup} onImportBackup={handleImportBackup} />
        <ContactDeveloperModal isOpen={showContactDeveloperModal} onClose={() => setShowContactDeveloperModal(false)} />
        {toast.message && <div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}<span>{toast.message}</span></div>}
      </div>
    );
  }

  // 3. Workspace
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        variant="workspace" journalTitle={activeJournal.title}
        onBack={() => { setActiveJournal(null); setActiveEntry(null); loadJournals(); }}
        onBackup={() => setShowShareModal(true)} onDeleteJournal={requestDeleteJournal} onLock={handleLock}
        mobileMenuOpen={mobileSidebarOpen} onToggleMobileMenu={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        onToggleEdgeWidget={openEdgeWidget}
        onContactDeveloper={() => setShowContactDeveloperModal(true)}
      />
      <div className="workspace-container">
        <Sidebar
          entries={sortedFilteredEntries} activeEntry={activeEntry}
          loading={entriesLoading}
          searchQuery={searchQuery} onSearchChange={setSearchQuery}
          onSelectEntry={(entry) => { setActiveEntry(entry); setMobileSidebarOpen(false); }}
          onCreateEntry={(templateId) => { handleCreateEntry(templateId); setMobileSidebarOpen(false); }}
          mobileOpen={mobileSidebarOpen} pinnedEntries={pinnedEntries} onTogglePin={togglePinEntry}
          onReorderEntries={handleReorderEntries} onBulkDelete={handleBulkDeleteEntries}
        />
        {activeEntry?.entryType === 'canvas' ? (
          <CanvasErrorBoundary key={activeEntry.id} entryId={activeEntry.id}>
            <CanvasEntry entry={activeEntry} onSave={handleSaveEntry} onDelete={handleDeleteEntry}
              onExport={() => setShowShareModal(true)}
              entries={entries} onOpenEntry={handleOpenEntryFromCanvas} onCreatePage={handleCreatePageFromCanvas}
            />
          </CanvasErrorBoundary>
        ) : (
          <Editor entry={activeEntry} onSave={handleSaveEntry} onDelete={handleDeleteEntry}
            onExport={() => setShowShareModal(true)}
          />
        )}
      </div>
      <ShareBackupModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} entry={activeEntry}
        onExportBackup={handleExportBackup} onImportBackup={handleImportBackup} />
      <ContactDeveloperModal isOpen={showContactDeveloperModal} onClose={() => setShowContactDeveloperModal(false)} />
      {/* Mobile FAB for new page */}
      <button className="mobile-fab" onClick={() => handleCreateEntry(null)} title="New page">
        <Plus size={22} />
      </button>

      {/* Delete journal confirmation modal */}
      {showDeleteJournal && activeJournal && (
        <div className="modal-overlay" onClick={() => setShowDeleteJournal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: '#ef4444' }}>Delete Journal</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDeleteJournal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="warning-box" style={{ marginBottom: '20px' }}>
                <ShieldAlert size={18} style={{ flexShrink: 0, color: '#ef4444' }} />
                <span>
                  This will permanently delete <strong>{activeJournal.title}</strong> and all of its pages. This cannot be undone.
                </span>
              </div>
              <div className="input-group">
                <label className="input-label">Type the journal name to confirm:</label>
                <input
                  type="text"
                  className="input"
                  placeholder={activeJournal.title}
                  value={deleteJournalInput}
                  onChange={(e) => setDeleteJournalInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmDeleteJournal(); }}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteJournal(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={confirmDeleteJournal}
                disabled={deleteJournalInput.trim() !== activeJournal.title.trim()}
              >
                Delete Journal Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.message && <div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}<span>{toast.message}</span></div>}
    </div>
  );
}
