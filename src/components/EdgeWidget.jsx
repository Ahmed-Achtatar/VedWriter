import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold,
  BookOpen,
  Italic,
  Lock,
  List as ListIcon,
  PanelRightClose,
  Pin,
  PinOff,
  Save,
  Plus
} from 'lucide-react';
import {
  PhysicalPosition,
  PhysicalSize,
  currentMonitor,
  getCurrentWindow
} from '@tauri-apps/api/window';
import { sanitizeHtml } from '../utils/sanitizeHtml';

const COLLAPSED_WIDTH = 10;
const DISCOVERY_WIDTH = 220;
const EXPANDED_WIDTH = 360;
const MIN_WIDGET_HEIGHT = 320;
const WIDGET_MAX_HEIGHT = 720;
const PIN_STORAGE_KEY = 'vedwriter.edge-widget.pinned';
const WIDGET_MODE_EXIT_MS = 180;

function readPinnedPreference() {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function savePinnedPreference(pinned) {
  try {
    localStorage.setItem(PIN_STORAGE_KEY, String(pinned));
  } catch {
    // A browser fallback or a restricted webview may not expose storage.
  }
}

function hasEditableContent(html) {
  return String(html || '')
    .replace(/<br\s*\/?\s*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()
    .length > 0;
}

function isWritableEntry(entry) {
  return entry?.entryType !== 'canvas';
}

export default function EdgeWidget({
  activeEntry,
  activeJournal,
  entries,
  journals,
  onExitWidget,
  onLoadJournalEntries,
  onLock,
  onSaveWidgetNote,
  showDiscoveryHintOnOpen = false
}) {
  const [expanded, setExpanded] = useState(readPinnedPreference);
  const [pinned, setPinned] = useState(readPinnedPreference);
  const [nativeWindowReady, setNativeWindowReady] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState(activeJournal?.id || journals[0]?.id || '');
  const [selectedEntryId, setSelectedEntryId] = useState(
    isWritableEntry(activeEntry)
      && activeEntry?.id
      && activeJournal?.id === (activeEntry?.journalId || activeJournal?.id)
      ? activeEntry.id
      : ''
  );
  const [journalEntries, setJournalEntries] = useState(entries || []);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [pageTitleDraft, setPageTitleDraft] = useState('');
  const [pageDraftHtml, setPageDraftHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showDiscoveryHint, setShowDiscoveryHint] = useState(Boolean(showDiscoveryHintOnOpen));
  const nativeWindowRef = useRef(null);
  const originalWindowRef = useRef(null);
  const collapseTimerRef = useRef(null);
  const pageEditorRef = useRef(null);
  const pendingDiscardActionRef = useRef(null);
  const exitTimerRef = useRef(null);
  const expandedAtMountRef = useRef(expanded);
  const discoveryHintRef = useRef(Boolean(showDiscoveryHintOnOpen));
  const writableEntries = journalEntries.filter(isWritableEntry);
  const selectedEntry = writableEntries.find((entry) => entry.id === selectedEntryId);
  const selectedEntryTitle = selectedEntry?.title || '';
  const selectedEntryBody = selectedEntry?.body ? sanitizeHtml(selectedEntry.body) : '';
  const hasUnsavedChanges = selectedEntryId
    ? pageTitleDraft.trim() !== selectedEntryTitle.trim() || pageDraftHtml !== selectedEntryBody
    : Boolean(pageTitleDraft.trim() || hasEditableContent(pageDraftHtml));

  const getWidgetGeometry = useCallback(async (isExpanded, discoveryVisible = false) => {
    const monitor = await currentMonitor();
    if (!monitor) return null;

    const scaleFactor = monitor.scaleFactor || 1;
    const workAreaHeight = monitor.workArea.size.height / scaleFactor;
    const height = Math.max(
      MIN_WIDGET_HEIGHT,
      Math.min(WIDGET_MAX_HEIGHT, workAreaHeight - 24)
    );
    const width = isExpanded
      ? EXPANDED_WIDTH
      : discoveryVisible
        ? DISCOVERY_WIDTH
        : COLLAPSED_WIDTH;
    const physicalWidth = Math.round(width * scaleFactor);
    const physicalHeight = Math.round(height * scaleFactor);
    const edgeX = monitor.workArea.position.x + monitor.workArea.size.width - physicalWidth;
    const topY = monitor.workArea.position.y + Math.round(12 * scaleFactor);

    return {
      size: new PhysicalSize(physicalWidth, physicalHeight),
      position: new PhysicalPosition(edgeX, topY),
      minSize: new PhysicalSize(Math.round(COLLAPSED_WIDTH * scaleFactor), Math.round(MIN_WIDGET_HEIGHT * scaleFactor)),
      maxSize: new PhysicalSize(Math.round(EXPANDED_WIDTH * scaleFactor), physicalHeight)
    };
  }, []);

  const syncWidgetWindow = useCallback(async (isExpanded, discoveryVisible = false) => {
    const nativeWindow = nativeWindowRef.current;
    if (!nativeWindow) return false;

    try {
      const geometry = await getWidgetGeometry(isExpanded, discoveryVisible);
      if (!geometry) return false;

      await nativeWindow.setMinSize(geometry.minSize);
      await nativeWindow.setMaxSize(geometry.maxSize);
      await nativeWindow.setSize(geometry.size);
      await nativeWindow.setPosition(geometry.position);
      return true;
    } catch (error) {
      console.warn('[edge-widget] Could not resize the native window:', error);
      return false;
    }
  }, [getWidgetGeometry]);

  useEffect(() => {
    const previousHtmlBackground = document.documentElement.style.background;
    const previousBodyBackground = document.body.style.background;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';

    let cancelled = false;

    async function enterWidgetMode() {
      try {
        const nativeWindow = getCurrentWindow();
        nativeWindowRef.current = nativeWindow;

        const [size, position, decorated, resizable, maximizable, alwaysOnTop] = await Promise.all([
          nativeWindow.innerSize(),
          nativeWindow.outerPosition(),
          nativeWindow.isDecorated(),
          nativeWindow.isResizable(),
          nativeWindow.isMaximizable(),
          nativeWindow.isAlwaysOnTop()
        ]);

        if (cancelled) return;
        originalWindowRef.current = { size, position, decorated, resizable, maximizable, alwaysOnTop };

        await nativeWindow.setDecorations(false);
        await nativeWindow.setResizable(false);
        await nativeWindow.setMaximizable(false);
        await nativeWindow.setFocusable(true);
        await nativeWindow.setIgnoreCursorEvents(false);
        // The invisible edge trigger must remain reachable above other windows.
        await nativeWindow.setAlwaysOnTop(true);
        const synced = await syncWidgetWindow(expandedAtMountRef.current, discoveryHintRef.current);
        if (!synced) throw new Error('The native window did not accept widget geometry.');
        if (!cancelled) setNativeWindowReady(true);
      } catch (error) {
        // The fallback remains usable when opened in Vite instead of Tauri.
        console.warn('[edge-widget] Native window controls are unavailable:', error);
      }
    }

    enterWidgetMode();

    return () => {
      cancelled = true;
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);

      document.documentElement.style.background = previousHtmlBackground;
      document.body.style.background = previousBodyBackground;

      const nativeWindow = nativeWindowRef.current;
      const originalWindow = originalWindowRef.current;
      if (!nativeWindow || !originalWindow) return;

      Promise.resolve().then(async () => {
        try {
          await nativeWindow.setAlwaysOnTop(originalWindow.alwaysOnTop);
          await nativeWindow.setDecorations(originalWindow.decorated);
          await nativeWindow.setResizable(originalWindow.resizable);
          await nativeWindow.setMaximizable(originalWindow.maximizable);
          await nativeWindow.setMinSize(new PhysicalSize(800, 600));
          await nativeWindow.setMaxSize(null);
          await nativeWindow.setSize(originalWindow.size);
          await nativeWindow.setPosition(originalWindow.position);
          await nativeWindow.show();
        } catch (error) {
          console.warn('[edge-widget] Could not restore the main window:', error);
        }
      });
    };
  }, [syncWidgetWindow]);

  useEffect(() => {
    if (nativeWindowReady) syncWidgetWindow(expanded, showDiscoveryHint);
  }, [expanded, nativeWindowReady, showDiscoveryHint, syncWidgetWindow]);

  useEffect(() => {
    if (!showDiscoveryHint) return undefined;
    const timer = setTimeout(() => setShowDiscoveryHint(false), 4200);
    return () => clearTimeout(timer);
  }, [showDiscoveryHint]);

  useEffect(() => {
    if (selectedJournalId === activeJournal?.id) {
      setJournalEntries((entries || []).filter(isWritableEntry));
      return;
    }

    if (!selectedJournalId) {
      setJournalEntries([]);
      return;
    }

    let cancelled = false;
    setEntriesLoading(true);
    setJournalEntries([]);
    onLoadJournalEntries(selectedJournalId)
      .then((loadedEntries) => {
        if (!cancelled) setJournalEntries((loadedEntries || []).filter(isWritableEntry));
      })
      .catch(() => {
        if (!cancelled) setJournalEntries([]);
      })
      .finally(() => {
        if (!cancelled) setEntriesLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeJournal?.id, entries, onLoadJournalEntries, selectedJournalId]);

  useEffect(() => {
    if (!journals.some((journal) => journal.id === selectedJournalId)) {
      setSelectedJournalId(activeJournal?.id || journals[0]?.id || '');
    }
  }, [activeJournal?.id, journals, selectedJournalId]);

  useEffect(() => {
    const selectedRawEntry = journalEntries.find((entry) => entry.id === selectedEntryId);
    if (selectedRawEntry && !isWritableEntry(selectedRawEntry)) {
      setSelectedEntryId('');
      setPageTitleDraft('');
      setPageDraftHtml('');
    }
  }, [journalEntries, selectedEntryId]);

  useEffect(() => {
    const nextDraft = selectedEntryBody || '';
    setPageDraftHtml(nextDraft);
  }, [selectedEntryId, selectedEntryBody]);

  useEffect(() => {
    setPageTitleDraft(selectedEntryTitle);
  }, [selectedEntryId, selectedEntryTitle]);

  useEffect(() => {
    if (!expanded || !pageEditorRef.current) return;
    if (pageEditorRef.current.innerHTML !== pageDraftHtml) {
      pageEditorRef.current.innerHTML = pageDraftHtml;
    }
    pageEditorRef.current.focus();
  }, [expanded, pageDraftHtml]);

  useEffect(() => {
    if (!expanded || pinned || discardConfirmOpen) return undefined;

    const collapseOnWindowBlur = () => setExpanded(false);
    window.addEventListener('blur', collapseOnWindowBlur);
    return () => window.removeEventListener('blur', collapseOnWindowBlur);
  }, [discardConfirmOpen, expanded, pinned]);

  const handlePointerEnter = () => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    setShowDiscoveryHint(false);
    setExpanded(true);
  };

  const handlePointerLeave = () => {
    // Keep an unpinned panel available while the user is actively editing or
    // has changes waiting to be saved. Clicking elsewhere still blurs the
    // native widget window and collapses it through the window blur handler.
    if (pinned || discardConfirmOpen || editorFocused || hasUnsavedChanges) return;
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => setExpanded(false), 280);
  };

  const togglePinned = async () => {
    const nextPinned = !pinned;
    setPinned(nextPinned);
    savePinnedPreference(nextPinned);

    // The edge trigger stays topmost in both states. Pinning controls whether
    // the expanded panel remains open after the pointer leaves it.
  };

  const runEditorCommand = (command) => {
    if (!pageEditorRef.current) return;
    pageEditorRef.current.focus();
    document.execCommand(command, false);
    setPageDraftHtml(pageEditorRef.current.innerHTML);
  };

  const requestDiscard = (action) => {
    if (!hasUnsavedChanges || saving) {
      action();
      return;
    }
    pendingDiscardActionRef.current = action;
    setDiscardConfirmOpen(true);
  };

  const confirmDiscard = () => {
    const action = pendingDiscardActionRef.current;
    pendingDiscardActionRef.current = null;
    setDiscardConfirmOpen(false);
    action?.();
  };

  const cancelDiscard = () => {
    pendingDiscardActionRef.current = null;
    setDiscardConfirmOpen(false);
  };

  const exitWidgetMode = () => {
    if (isExiting) return;
    setIsExiting(true);
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      onExitWidget();
    }, WIDGET_MODE_EXIT_MS);
  };

  const handleExitWidget = () => requestDiscard(exitWidgetMode);

  const handleLock = () => requestDiscard(onLock);

  const handleJournalChange = (event) => {
    const nextJournalId = event.target.value;
    requestDiscard(() => {
      setSelectedJournalId(nextJournalId);
      setSelectedEntryId('');
      setPageTitleDraft('');
      setPageDraftHtml('');
      setSavedMessage('');
      setSaveError(false);
    });
  };

  const handlePageChange = (event) => {
    const nextEntryId = event.target.value;
    requestDiscard(() => {
      setSelectedEntryId(nextEntryId);
      setPageTitleDraft('');
      setPageDraftHtml('');
      setSavedMessage('');
      setSaveError(false);
    });
  };

  const handleSaveNote = async (event) => {
    event.preventDefault();
    const draftHtml = pageEditorRef.current?.innerHTML ?? pageDraftHtml;
    const draftHasContent = hasEditableContent(draftHtml);
    if ((!selectedEntryId && !draftHasContent) || !selectedJournalId || saving) return;

    setSaving(true);
    setSavedMessage('');
    setSaveError(false);
    try {
      const saved = await onSaveWidgetNote({
        journalId: selectedJournalId,
        entryId: selectedEntryId || null,
        title: pageTitleDraft.trim(),
        content: draftHasContent ? draftHtml : ''
      });
      if (saved?.body !== undefined) {
        const savedBody = sanitizeHtml(saved.body);
        setPageDraftHtml(savedBody);
        if (saved.title !== undefined) setPageTitleDraft(saved.title);
        const savedEntryId = saved.entryId || selectedEntryId;
        if (saved.entry) {
          setJournalEntries((previous) => [
            ...previous.filter((entry) => entry.id !== savedEntryId),
            { ...saved.entry, title: saved.title || saved.entry.title, body: savedBody }
          ]);
          setSelectedEntryId(savedEntryId);
        } else {
          setJournalEntries((previous) => previous.map((entry) => entry.id === savedEntryId
            ? { ...entry, title: saved.title ?? entry.title, body: savedBody }
            : entry));
        }
      }
      setSavedMessage(selectedEntryId ? 'Changes saved.' : 'Page created.');
      setTimeout(() => setSavedMessage(''), 1800);
    } catch (error) {
      setSaveError(true);
      setSavedMessage(error?.message || 'Could not save this page.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`edge-widget-root ${nativeWindowReady ? 'edge-widget-native' : 'edge-widget-fallback'} ${isExiting ? 'is-exiting' : ''}`}>
      <aside
        className={`edge-widget-panel ${expanded ? 'is-expanded' : 'is-collapsed'} ${showDiscoveryHint ? 'has-discovery-hint' : ''}`}
        onMouseEnter={handlePointerEnter}
        onMouseLeave={handlePointerLeave}
        aria-label="VedWriter side panel"
        title={expanded ? undefined : 'Hover to open the Side panel'}
      >
        {!expanded && (
          <>
            <span className="edge-widget-handle" aria-hidden="true" />
            {showDiscoveryHint && (
              <div className="edge-widget-discovery-hint" role="status">
                <strong>Side panel</strong>
                <span>Hover here to open it</span>
              </div>
            )}
          </>
        )}

        <div className="edge-widget-header">
          <div className="edge-widget-brand" title="VedWriter">
            <span className="edge-widget-brand-mark"><BookOpen size={17} /></span>
            {expanded && <span>Side panel</span>}
          </div>

          {expanded && (
            <div className="edge-widget-header-actions">
              <button
                type="button"
                className={`edge-widget-icon-button ${pinned ? 'is-pinned' : ''}`}
                onClick={togglePinned}
                aria-pressed={pinned}
                aria-label={pinned ? 'Unpin and auto-hide the side panel' : 'Keep the side panel open'}
                title={pinned ? 'Unpin and auto-hide' : 'Keep side panel open'}
              >
                {pinned ? <Pin size={15} /> : <PinOff size={15} />}
              </button>
              <button
                type="button"
                className="edge-widget-icon-button"
                onClick={handleExitWidget}
                aria-label="Open the full VedWriter window"
                title="Open full app"
              >
                <PanelRightClose size={16} />
              </button>
            </div>
          )}
        </div>

        {expanded && (
          <form className="edge-widget-composer" onSubmit={handleSaveNote}>
            <div className="edge-widget-composer-heading">
              <div>
                <span className="edge-widget-eyebrow">{selectedEntryId ? 'Edit page' : 'New page'}</span>
                <input
                  className="edge-widget-page-title"
                  value={pageTitleDraft}
                  onChange={(event) => setPageTitleDraft(event.target.value)}
                  onFocus={() => setEditorFocused(true)}
                  onBlur={() => setEditorFocused(false)}
                  placeholder="Untitled page"
                  disabled={saving || !selectedJournalId}
                  aria-label="Page title"
                />
              </div>
            </div>

            <div className="edge-widget-targets">
              <label className="edge-widget-field">
                <span>Journal</span>
                <select
                  value={selectedJournalId}
                  onChange={handleJournalChange}
                  disabled={saving || !journals.length}
                >
                  {!journals.length && <option value="">No journals available</option>}
                  {journals.map((journal) => (
                    <option key={journal.id} value={journal.id}>{journal.title}</option>
                  ))}
                </select>
              </label>

              <label className="edge-widget-field">
                <span>Page</span>
                <select
                  value={selectedEntryId}
                  onChange={handlePageChange}
                  disabled={saving || entriesLoading || !selectedJournalId}
                >
                  <option value="">+ New page</option>
                  {writableEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.title || 'Untitled page'}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="edge-widget-formatting" aria-label="Formatting tools">
              <button type="button" onMouseDown={(event) => { event.preventDefault(); runEditorCommand('bold'); }} title="Bold">
                <Bold size={14} />
              </button>
              <button type="button" onMouseDown={(event) => { event.preventDefault(); runEditorCommand('italic'); }} title="Italic">
                <Italic size={14} />
              </button>
              <button type="button" onMouseDown={(event) => { event.preventDefault(); runEditorCommand('insertUnorderedList'); }} title="Bulleted list">
                <ListIcon size={14} />
              </button>
            </div>

            <div
              ref={pageEditorRef}
              className="edge-widget-page-editor"
              contentEditable={!saving && Boolean(selectedJournalId)}
              suppressContentEditableWarning
              onInput={(event) => setPageDraftHtml(event.currentTarget.innerHTML)}
              onFocus={() => setEditorFocused(true)}
              onBlur={() => setEditorFocused(false)}
              data-placeholder={selectedEntryId ? 'This page is empty. Start writing...' : 'Write the first note on this page...'}
              aria-label={`Edit ${selectedEntry?.title || 'new page'}`}
            />

            <div className="edge-widget-composer-footer">
              <div className={`edge-widget-save-status ${saveError ? 'is-error' : hasUnsavedChanges ? 'is-dirty' : 'is-saved'}`} aria-live="polite">
                <span className="edge-widget-save-status-dot" />
                {saving ? 'Saving…' : saveError ? savedMessage : savedMessage || (hasUnsavedChanges ? 'Unsaved changes' : 'Saved')}
              </div>
              <div className="edge-widget-composer-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleExitWidget} disabled={saving}>Close</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleLock} disabled={saving} title="Lock VedWriter">
                  <Lock size={13} />
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !selectedJournalId || (!selectedEntryId && !hasEditableContent(pageDraftHtml)) || (Boolean(selectedEntryId) && !hasUnsavedChanges)}>
                {selectedEntryId ? <Save size={14} /> : <Plus size={14} />}
                {saving ? 'Saving...' : selectedEntryId ? 'Save changes' : 'Create page'}
                </button>
              </div>
            </div>
          </form>
        )}

        {discardConfirmOpen && (
          <div className="edge-widget-discard-overlay" role="presentation">
            <div
              className="edge-widget-discard-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edge-widget-discard-title"
            >
              <strong id="edge-widget-discard-title">Discard unsaved changes?</strong>
              <p>Your changes will be lost.</p>
              <div className="edge-widget-discard-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={cancelDiscard}>
                  Keep editing
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={confirmDiscard}>
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
