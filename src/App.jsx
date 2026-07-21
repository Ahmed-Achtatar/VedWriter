import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Plus, KeyRound, ShieldAlert, RefreshCw, CheckCircle2, AlertTriangle, Search } from 'lucide-react';

import {
  getSetting, setSetting, saveJournal, getAllJournals,
  deleteJournal, saveEntry, getEntriesForJournal, deleteEntry,
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
import CreateJournalModal from './components/CreateJournalModal';
import ShareBackupModal from './components/ShareBackupModal';

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const AUTO_LOCK_MINUTES = 15;
const AUTO_LOCK_CHECK_MS = 60000;

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

  // Dashboard
  const [journals, setJournals] = useState([]);
  const [activeJournal, setActiveJournal] = useState(null);
  const [entries, setEntries] = useState([]);
  const [activeEntry, setActiveEntry] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Dashboard search and sort
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
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
  }, [showCreateModal, showShareModal, activeJournal]);

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

      await setSetting('salt', generatedSalt);
      await setSetting('verifier', encryptedVerifier);
      await setSetting('verifier_hash', hash);
      await setSetting('iterations', newIterations);

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

            await setSetting('verifier', newEncryptedVerifier);
            await setSetting('verifier_hash', hash);
            await setSetting('iterations', newIterations);

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
      setJournals(decrypted.filter(Boolean));
    } catch { showToast('Failed to load journals.', 'error'); }
    finally { setJournalsLoading(false); }
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
    setActiveJournal(journal); setEntries([]); setActiveEntry(null);
    await loadEntries(journal.id);
  };

  // Load entries (parallel decryption with cached key)
  const loadEntries = async (journalId) => {
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
            return { ...e, title, body, tags };
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
      setEntries(valid);
    } catch { showToast('Failed to load entries.', 'error'); }
    finally { setEntriesLoading(false); }
  };

  // Create entry
  const handleCreateEntry = async (templateId) => {
    if (!activeJournal) return;
    try {
      const id = generateRandomString(16);
      let entryTitle = 'Untitled Page';
      let entryBody = '';
      const entryTags = [];

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

      const encTitle = await encryptWithKey(entryTitle);
      const encBody = await encryptWithKey(entryBody);
      const encTags = await encryptWithKey(JSON.stringify(entryTags));

      const newEntry = {
        id, journalId: activeJournal.id,
        encryptedTitle: encTitle, encryptedBody: encBody, encryptedTags: encTags,
        dateCreated: Date.now(), dateModified: Date.now(),
        position: entries.length
      };
      await saveEntry(newEntry);
      const dec = { ...newEntry, title: entryTitle, body: entryBody, tags: entryTags };
      setEntries([dec, ...entries]);
      setActiveEntry(dec);
      showToast('New page added.');
      setJournals(journals.map(j => j.id === activeJournal.id ? { ...j, entryCount: j.entryCount + 1 } : j));
      setActiveJournal(prev => prev ? { ...prev, entryCount: prev.entryCount + 1 } : null);
    } catch { showToast('Failed to add page.', 'error'); }
  };

  // Save entry
  const handleSaveEntry = async (updatedEntry) => {
    try {
      const encTitle = await encryptWithKey(updatedEntry.title);
      const encBody = await encryptWithKey(updatedEntry.body);
      const encTags = await encryptWithKey(JSON.stringify(updatedEntry.tags));
      const savedEntry = {
        ...updatedEntry,
        encryptedTitle: encTitle,
        encryptedBody: encBody,
        encryptedTags: encTags,
        dateModified: Date.now()
      };
      await saveEntry(savedEntry);
      setEntries(prev => prev.map(e => e.id === updatedEntry.id ? savedEntry : e));
      setActiveEntry(savedEntry);
    } catch { /**/ }
  };

  // Delete entry
  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Delete this page? This cannot be undone.')) return;
    try {
      await deleteEntry(entryId);
      setEntries(prev => prev.filter(e => e.id !== entryId));
      setActiveEntry(null);
      showToast('Page deleted.');
      setJournals(prev => prev.map(j => j.id === activeJournal.id ? { ...j, entryCount: Math.max(0, j.entryCount - 1) } : j));
      setActiveJournal(prev => prev ? { ...prev, entryCount: Math.max(0, prev.entryCount - 1) } : null);
    } catch { showToast('Failed to delete page.', 'error'); }
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
    try {
      await deleteJournal(activeJournal.id);
      showToast(`"${activeJournal.title}" deleted.`);
      setActiveJournal(null); setActiveEntry(null);
      setShowDeleteJournal(false);
      await loadJournals();
    } catch { showToast('Failed to delete journal.', 'error'); }
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
  const handleExportBackup = async () => await exportAllData();
  const handleImportBackup = async (backupData) => {
    await bulkImport(backupData);
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
          id: entry.id,
          journalId: entry.journalId,
          encryptedTitle: entry.encryptedTitle,
          encryptedBody: entry.encryptedBody,
          encryptedTags: entry.encryptedTags,
          dateCreated: entry.dateCreated,
          dateModified: entry.dateModified,
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
    for (const id of entryIds) {
      await deleteEntry(id);
    }
    setEntries(prev => prev.filter(e => !entryIds.includes(e.id)));
    if (activeEntry && entryIds.includes(activeEntry.id)) setActiveEntry(null);
    showToast(`${entryIds.length} page(s) deleted.`);
    setJournals(prev => prev.map(j => j.id === activeJournal.id ? { ...j, entryCount: Math.max(0, j.entryCount - entryIds.length) } : j));
    setActiveJournal(prev => prev ? { ...prev, entryCount: Math.max(0, prev.entryCount - entryIds.length) } : null);
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
                  onClick={() => { if (window.confirm('Permanently delete all data?')) clearAllData().then(() => { setHasAccount(false); showToast('Database wiped.'); }); }}
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

  // 2. Dashboard
  if (!activeJournal) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header onBackup={() => setShowShareModal(true)} onLock={handleLock} />
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
        <Editor entry={activeEntry} onSave={handleSaveEntry} onDelete={handleDeleteEntry}
          onExport={() => setShowShareModal(true)}
        />
      </div>
      <ShareBackupModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} entry={activeEntry}
        onExportBackup={handleExportBackup} onImportBackup={handleImportBackup} />

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
