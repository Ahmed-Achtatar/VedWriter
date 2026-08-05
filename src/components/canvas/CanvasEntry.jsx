import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import fixWebmDuration from 'fix-webm-duration';
import {
  StickyNote, Image as ImageIcon, GitBranch, Columns3,
  Trash2, ZoomIn, ZoomOut, Maximize, Hand, Palette, Sparkles,
  Copy, X, Minimize2, Maximize2, ImagePlus, Undo2, Redo2, Search,
  Link2, ExternalLink, Download, FileImage, FileText, Layers,
  Lock, Unlock, AlignLeft, AlignCenter, Rows3, Mic, Square,
} from 'lucide-react';
import {
  STICKY_COLORS, STICKER_TEMPLATES, buildStarterDoc, makeCard, makeEdge,
  ZONE_COLORS, makeZone, parseCanvasBody, serializeCanvasBody, zoomAt, fitToView,
  screenToWorld, worldToScreen, cardsCenter,
  parseMarkdown, extractHashtags, formatRelativeTime,
  computeSnap, findCardAtPoint, tagColor, canvasContentSnapshot,
  canvasContentKey, buildCanvasSvg, canvasCardsToHtml,
  removeCardsFromCanvas, MEDIA_KINDS, mediaKindFromFile, mediaIconForKind, formatFileSize,
} from './canvasUtils';
import PdfPreview from './PdfPreview';
import { subscribeToNativeFileDrop } from '../../utils/nativeFileDrop';

const TOOLS = [
  { id: 'select',  name: 'Select / Pan', icon: Hand },
  { id: 'sticky',  name: 'Sticky note',  icon: StickyNote },
  { id: 'connect', name: 'Connect',      icon: GitBranch },
  { id: 'column',  name: 'Kanban column',icon: Columns3 },
  { id: 'zone',    name: 'Draw a zone',   icon: Rows3 },
];

const SAVE_DEBOUNCE_MS = 600;
const MAX_MEDIA_FILE_BYTES = 50 * 1024 * 1024;
const MAX_CANVAS_DOCUMENT_BYTES = 80 * 1024 * 1024;
const MAX_VOICE_RECORDING_SECONDS = 5 * 60;
const MIN_CARD_W = 140;
const MIN_CARD_H = 80;
const DRAG_THRESHOLD_PX = 4;
const ROTATION_MAX_DEG = 3;

function themedCanvasColor(color, kind, channel) {
  const sourceKey = channel === 'bg' ? 'value' : channel;
  const source = color?.[sourceKey];
  if (typeof source !== 'string' || !source) return undefined;
  const target = channel === 'bg'
    ? `var(--canvas-${kind}-base)`
    : channel === 'border'
      ? 'var(--border-strong)'
      : 'var(--text-primary)';
  return `color-mix(in srgb, ${source} var(--canvas-${kind}-${channel}-weight), ${target})`;
}

export class CanvasErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown canvas error' };
  }

  componentDidCatch(error, info) {
    console.error('[canvas] render failure', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="canvas-error-state" role="alert">
        <h2>Canvas temporarily unavailable</h2>
        <p>Your saved page is safe. Reload the canvas to restore the workspace.</p>
        {this.state.message && <code className="canvas-error-detail">{this.state.message}</code>}
        <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Reload canvas</button>
      </section>
    );
  }
}

export default function CanvasEntry({
  entry, onSave, onDelete, onExport, entries = [], onOpenEntry, onCreatePage,
}) {
  const containerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const lastEntryIdRef = useRef(null);
  const tagHintShownRef = useRef(false);

  // Document state
  const [doc, setDoc] = useState(() => buildStarterDoc(entry?.canvasTemplate || 'whiteboard'));
  const [title, setTitle] = useState(entry?.title || 'Canvas');

  // UI state
  const [tool, setTool] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [colorPickerFor, setColorPickerFor] = useState(null);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [connectFrom, setConnectFrom] = useState(null);
  const [mouseWorld, setMouseWorld] = useState({ x: 0, y: 0 });
  const [snapGuides, setSnapGuides] = useState({ x: null, y: null });
  const [hoverPreviewId, setHoverPreviewId] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTagHint, setShowTagHint] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [zoneColorPickerFor, setZoneColorPickerFor] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [lastSavedAt, setLastSavedAt] = useState(entry?.dateModified || Date.now());
  const [selectionBox, setSelectionBox] = useState(null);
  const [showLinkPickerFor, setShowLinkPickerFor] = useState(null);
  const [linkQuery, setLinkQuery] = useState('');
  const [, setNowTick] = useState(0);

  // Force re-render every minute so relative timestamps stay fresh
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // Refs (don't trigger re-renders)
  const panState = useRef(null);
  const dragState = useRef(null);
  const resizeState = useRef(null);
  const zoneDragState = useRef(null);
  const zoneResizeState = useRef(null);
  const zoneCreateState = useRef(null);
  const selectionState = useRef(null);
  const cardDragIntent = useRef(null);
  const dragCounter = useRef(0);
  const searchInputRef = useRef(null);
  const historyRef = useRef({ past: [], future: [], current: null });
  const historyResetRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef(null);
  const latestEntryRef = useRef(entry);
  const latestOnSaveRef = useRef(onSave);
  const lastSaveKeyRef = useRef('');
  const latestDocRef = useRef(doc);
  const latestTitleRef = useRef(title);
  const nativeDropAddMediaRef = useRef(null);
  const nativeDropToWorldRef = useRef(null);
  const nativeDropMouseWorldRef = useRef(mouseWorld);

  latestEntryRef.current = entry;
  latestOnSaveRef.current = onSave;
  latestDocRef.current = doc;
  latestTitleRef.current = title;
  nativeDropMouseWorldRef.current = mouseWorld;

  // Load doc when entry changes
  useEffect(() => {
    if (!entry) return;
    if (entry.id === lastEntryIdRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    lastEntryIdRef.current = entry.id;
    const parsed = parseCanvasBody(entry.body, entry.canvasTemplate || 'whiteboard');
    setDoc(parsed);
    setTitle(entry.title || 'Canvas');
    setSelectedId(null);
    setSelectedIds([]);
    setEditingId(null);
    setConnectFrom(null);
    setColorPickerFor(null);
    setSnapGuides({ x: null, y: null });
    setShowSearch(false);
    setSearchQuery('');
    setShowExportMenu(false);
    setZoneColorPickerFor(null);
    setSelectedZoneId(null);
    setShowLinkPickerFor(null);
    historyRef.current = { past: [], future: [], current: null };
    historyResetRef.current = true;
    lastSaveKeyRef.current = `${entry.title || ''}\u0000${entry.body || ''}`;
    setSaveStatus('saved');
    setLastSavedAt(entry.dateModified || Date.now());
  }, [entry]);

  // Auto-fit on first load
  useEffect(() => {
    if (!containerRef.current) return;
    if (doc.cards.length === 0) {
      setDoc((d) => ({ ...d, view: { x: -200, y: -150, zoom: 1 } }));
      return;
    }
    if (entry && entry.id !== lastEntryIdRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const fit = fitToView([...(doc.cards || []), ...(doc.zones || [])], rect.width, rect.height, 120);
    if (fit) setDoc((d) => ({ ...d, view: fit }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  // Keep structural edits undoable while ignoring panning and zooming.
  useEffect(() => {
    const snapshot = canvasContentSnapshot(doc);
    const key = canvasContentKey(doc);
    if (historyResetRef.current) {
      historyResetRef.current = false;
      historyRef.current = { past: [], future: [], current: { snapshot, key } };
      return;
    }
    const history = historyRef.current;
    if (!history.current) {
      history.current = { snapshot, key };
      return;
    }
    if (history.current.key !== key) {
      history.past.push(history.current.snapshot);
      if (history.past.length > 80) history.past.shift();
      history.future = [];
      history.current = { snapshot, key };
    }
  }, [doc]);

  useEffect(() => {
    document.body.classList.toggle('focus-mode-active', isFocusMode);
    return () => document.body.classList.remove('focus-mode-active');
  }, [isFocusMode]);

  useEffect(() => {
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [showSearch]);

  // Debounced save
  const scheduleSave = useCallback(() => {
    const currentEntry = latestEntryRef.current;
    if (!currentEntry) return;
    const serializedBody = serializeCanvasBody(doc);
    if (serializedBody.length > MAX_CANVAS_DOCUMENT_BYTES) {
      setSaveStatus('error');
      return;
    }
    const saveKey = `${title}\u0000${serializedBody}`;
    if (saveKey === lastSaveKeyRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(() => {
      const saveEntry = latestEntryRef.current;
      const save = latestOnSaveRef.current;
      if (!saveEntry || !save) return;
      const updated = {
        ...saveEntry,
        title,
        body: serializedBody,
        tags: saveEntry.tags || [],
        drafts: saveEntry.drafts || [],
        dateModified: Date.now(),
      };
      Promise.resolve()
        .then(() => save(updated))
        .then(() => {
          lastSaveKeyRef.current = saveKey;
          setSaveStatus('saved');
          setLastSavedAt(Date.now());
        })
        .catch(() => setSaveStatus('error'));
    }, SAVE_DEBOUNCE_MS);
  }, [doc, title]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  useEffect(() => {
    const handleFlushRequest = (event) => {
      if (!latestEntryRef.current || !event.detail?.promises) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const serializedBody = serializeCanvasBody(latestDocRef.current);
      if (serializedBody.length > MAX_CANVAS_DOCUMENT_BYTES) {
        event.detail.promises.push(Promise.reject(new Error('Canvas is too large to export')));
        return;
      }
      const saveKey = `${latestTitleRef.current}\u0000${serializedBody}`;
      if (saveKey === lastSaveKeyRef.current) return;
      const updated = {
        ...latestEntryRef.current,
        title: latestTitleRef.current,
        body: serializedBody,
        tags: latestEntryRef.current.tags || [],
        drafts: latestEntryRef.current.drafts || [],
        dateModified: Date.now(),
      };
      const promise = Promise.resolve(latestOnSaveRef.current(updated)).then(() => {
        lastSaveKeyRef.current = saveKey;
        setSaveStatus('saved');
        setLastSavedAt(Date.now());
      });
      event.detail.promises.push(promise);
    };
    window.addEventListener('vedwriter:flush-saves', handleFlushRequest);
    return () => window.removeEventListener('vedwriter:flush-saves', handleFlushRequest);
  }, []);

  useEffect(() => { scheduleSave(); }, [doc, title, scheduleSave]);

  const selectedCards = useMemo(
    () => doc.cards.filter((card) => selectedIds.includes(card.id)),
    [doc.cards, selectedIds]
  );
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return doc.cards.filter((card) => `${card.text} ${card.linkEntryId || ''}`.toLowerCase().includes(q));
  }, [doc.cards, searchQuery]);

  // First-time hashtag hint
  useEffect(() => {
    if (tagHintShownRef.current) return;
    const hasTags = doc.cards.some((c) => extractHashtags(c.text).length > 0);
    if (hasTags) {
      tagHintShownRef.current = true;
      setShowTagHint(true);
      setTimeout(() => setShowTagHint(false), 6000);
    }
  }, [doc.cards]);

  // Coordinate transforms
  const view = doc.view;
  const toWorld = useCallback((clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    return screenToWorld(clientX, clientY, rect, view);
  }, [view]);
  nativeDropToWorldRef.current = toWorld;

  const selectCards = (ids) => {
    const unique = [...new Set(ids.filter(Boolean))];
    setSelectedIds(unique);
    setSelectedId(unique[0] || null);
  };

  const selectOnly = (id) => selectCards(id ? [id] : []);

  const toggleCardSelection = (id) => {
    if (!id) return;
    setSelectedIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      setSelectedId(next[0] || null);
      return next;
    });
  };

  const undo = () => {
    const history = historyRef.current;
    if (!history.past.length || !history.current) return;
    const previous = history.past.pop();
    history.future.push(history.current.snapshot);
    history.current = { snapshot: previous, key: canvasContentKey(previous) };
    setDoc((current) => ({ ...current, ...previous, view: current.view }));
    selectCards([]);
    setEditingId(null);
  };

  const redo = () => {
    const history = historyRef.current;
    if (!history.future.length || !history.current) return;
    const next = history.future.pop();
    history.past.push(history.current.snapshot);
    history.current = { snapshot: next, key: canvasContentKey(next) };
    setDoc((current) => ({ ...current, ...next, view: current.view }));
    selectCards([]);
    setEditingId(null);
  };

  const getScreenRect = (item) => {
    const screen = worldToScreen(item.x, item.y, view);
    return { left: screen.x, top: screen.y, width: item.w * view.zoom, height: item.h * view.zoom };
  };

  // ──────────────────────────────────────────────
  // Pan / place
  // ──────────────────────────────────────────────
  const onContainerPointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.canvas-card') || e.target.closest('.canvas-zone') || e.target.closest('.canvas-floating')) return;
    if (tool === 'connect') return;

    const rect = containerRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (tool === 'zone') {
      const w = toWorld(e.clientX, e.clientY);
      zoneCreateState.current = { startX: w.x, startY: w.y };
      setSelectionBox({ left: screenX, top: screenY, width: 0, height: 0, type: 'zone' });
      containerRef.current.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === 'sticky' || tool === 'text' || tool === 'image' || tool === 'column') {
      const w = toWorld(e.clientX, e.clientY);
      placeCard(tool, w.x, w.y);
      return;
    }

    setSelectedId(null);
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) setSelectedIds([]);
    setColorPickerFor(null);
    setConnectFrom(null);
    setSnapGuides({ x: null, y: null });
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      selectionState.current = { startX: screenX, startY: screenY, additive: e.ctrlKey || e.metaKey };
      setSelectionBox({ left: screenX, top: screenY, width: 0, height: 0, type: 'selection' });
    } else {
      panState.current = {
        startX: e.clientX, startY: e.clientY,
        viewStartX: view.x, viewStartY: view.y,
      };
    }
    containerRef.current.setPointerCapture(e.pointerId);
  };

  const onContainerPointerMove = (e) => {
    if (containerRef.current) {
      const w = toWorld(e.clientX, e.clientY);
      setMouseWorld(w);
    }

    if (cardDragIntent.current && !cardDragIntent.current.hasMoved) {
      const dx = e.clientX - cardDragIntent.current.startClientX;
      const dy = e.clientY - cardDragIntent.current.startClientY;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        cardDragIntent.current.hasMoved = true;
        dragState.current = {
          ids: cardDragIntent.current.dragIds || [cardDragIntent.current.id],
          startWX: cardDragIntent.current.startWX,
          startWY: cardDragIntent.current.startWY,
          startPositions: cardDragIntent.current.startPositions || [{
            id: cardDragIntent.current.id,
            x: cardDragIntent.current.startCardX,
            y: cardDragIntent.current.startCardY,
          }],
        };
        // (pointer capture is already set in onCardPointerDown)
      }
    }

    if (selectionState.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const start = selectionState.current;
      const box = {
        left: Math.min(start.startX, x), top: Math.min(start.startY, y),
        width: Math.abs(x - start.startX), height: Math.abs(y - start.startY), type: 'selection',
      };
      setSelectionBox(box);
      const hit = doc.cards.filter((card) => {
        const item = getScreenRect(card);
        return item.left < box.left + box.width && item.left + item.width > box.left
          && item.top < box.top + box.height && item.top + item.height > box.top;
      }).map((card) => card.id);
      selectCards(start.additive ? [...selectedIds, ...hit] : hit);
      return;
    }

    if (zoneCreateState.current) {
      const start = zoneCreateState.current;
      const w = toWorld(e.clientX, e.clientY);
      const left = Math.min(start.startX, w.x), top = Math.min(start.startY, w.y);
      const width = Math.max(40, Math.abs(w.x - start.startX));
      const height = Math.max(40, Math.abs(w.y - start.startY));
      const screen = worldToScreen(left, top, view);
      setSelectionBox({ left: screen.x, top: screen.y, width: width * view.zoom, height: height * view.zoom, type: 'zone' });
      return;
    }

    if (zoneDragState.current) {
      const { id, startWX, startWY, startX, startY } = zoneDragState.current;
      const w = toWorld(e.clientX, e.clientY);
      const dx = w.x - startWX, dy = w.y - startWY;
      setDoc((d) => ({ ...d, zones: (d.zones || []).map((zone) => zone.id === id ? { ...zone, x: startX + dx, y: startY + dy, dateModified: Date.now() } : zone) }));
      return;
    }

    if (zoneResizeState.current) {
      const { id, startW, startH, startWX, startWY } = zoneResizeState.current;
      const w = toWorld(e.clientX, e.clientY);
      setDoc((d) => ({ ...d, zones: (d.zones || []).map((zone) => zone.id === id ? { ...zone, w: Math.max(180, startW + w.x - startWX), h: Math.max(120, startH + w.y - startWY), dateModified: Date.now() } : zone) }));
      return;
    }

    if (panState.current) {
      const { startX, startY, viewStartX, viewStartY } = panState.current;
      const dx = (e.clientX - startX) / view.zoom;
      const dy = (e.clientY - startY) / view.zoom;
      setDoc((d) => ({ ...d, view: { ...d.view, x: viewStartX - dx, y: viewStartY - dy } }));
      return;
    }

    if (dragState.current) {
      const { ids, startWX, startWY, startPositions } = dragState.current;
      const w = toWorld(e.clientX, e.clientY);
      const dx = w.x - startWX;
      const dy = w.y - startWY;

      // Snap to other cards' edges
      const id = ids[0];
      const firstPosition = startPositions.find((item) => item.id === id);
      const candidate = { id, x: firstPosition.x + dx, y: firstPosition.y + dy, w: 0, h: 0 };
      const dragged = doc.cards.find((c) => c.id === id);
      if (dragged) { candidate.w = dragged.w; candidate.h = dragged.h; }
      const snap = computeSnap(candidate, doc.cards);
      const totalDx = dx + snap.dx;
      const totalDy = dy + snap.dy;

      // Convert guide values (world) to screen space
      const guideXScreen = snap.guides.x !== null ? (snap.guides.x - view.x) * view.zoom : null;
      const guideYScreen = snap.guides.y !== null ? (snap.guides.y - view.y) * view.zoom : null;
      setSnapGuides({ x: guideXScreen, y: guideYScreen });

      setDoc((d) => ({
        ...d,
        cards: d.cards.map((c) => {
          const start = startPositions.find((item) => item.id === c.id);
          if (start) {
            return { ...c, x: start.x + totalDx, y: start.y + totalDy, dateModified: Date.now() };
          }
          // Children follow parent
          if (!start && c.parentId === id) {
            return { ...c, x: c.x + totalDx, y: c.y + totalDy };
          }
          return c;
        }),
      }));
      return;
    }

    if (resizeState.current) {
      const { id, startW, startH, startWX, startWY } = resizeState.current;
      const w = toWorld(e.clientX, e.clientY);
      const newW = Math.max(MIN_CARD_W, startW + (w.x - startWX));
      const newH = Math.max(MIN_CARD_H, startH + (w.y - startWY));
      setDoc((d) => ({
        ...d,
        cards: d.cards.map((c) => c.id === id ? { ...c, w: newW, h: newH } : c),
      }));
      return;
    }
  };

  const onContainerPointerUp = (e) => {
    if (selectionState.current) {
      selectionState.current = null;
      setSelectionBox(null);
      try { containerRef.current.releasePointerCapture(e.pointerId); } catch {}
    }

    if (zoneCreateState.current) {
      const start = zoneCreateState.current;
      const w = toWorld(e.clientX, e.clientY);
      const left = Math.min(start.startX, w.x), top = Math.min(start.startY, w.y);
      const width = Math.abs(w.x - start.startX), height = Math.abs(w.y - start.startY);
      zoneCreateState.current = null;
      setSelectionBox(null);
      if (width > 60 && height > 60) {
        const color = ZONE_COLORS[(doc.zones || []).length % ZONE_COLORS.length];
        const zone = makeZone('New zone', left, top, Math.max(180, width), Math.max(120, height), color);
        setDoc((d) => ({ ...d, zones: [...(d.zones || []), zone] }));
        setSelectedZoneId(zone.id);
      }
      setTool('select');
      try { containerRef.current.releasePointerCapture(e.pointerId); } catch {}
    }

    if (zoneDragState.current) {
      zoneDragState.current = null;
      try { containerRef.current.releasePointerCapture(e.pointerId); } catch {}
    }
    if (zoneResizeState.current) {
      zoneResizeState.current = null;
      try { containerRef.current.releasePointerCapture(e.pointerId); } catch {}
    }

    if (cardDragIntent.current) {
      const intent = cardDragIntent.current;
      cardDragIntent.current = null;
      if (!intent.hasMoved && intent.tool !== 'connect') {
        if (intent.multiSelect) {
          setEditingId(null);
        } else {
          selectOnly(intent.id);
          setEditingId(intent.id);
        }
      }
    }
    if (panState.current) {
      panState.current = null;
      try { containerRef.current.releasePointerCapture(e.pointerId); } catch {}
    }
    if (dragState.current) {
      // After drag, unparent any children that are now outside the parent
      const draggedIds = dragState.current.ids || [];
      dragState.current = null;
      try { containerRef.current.releasePointerCapture(e.pointerId); } catch {}
      setSnapGuides({ x: null, y: null });
      setDoc((d) => {
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (!draggedIds.includes(c.parentId)) return c;
            const parent = d.cards.find((item) => item.id === c.parentId);
            if (!parent) return { ...c, parentId: null };
            const pad = 8;
            const px1 = parent.x - pad, py1 = parent.y - pad;
            const px2 = parent.x + parent.w + pad, py2 = parent.y + parent.h + pad;
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (cx < px1 || cx > px2 || cy < py1 || cy > py2) {
              return { ...c, parentId: null, dateModified: Date.now() };
            }
            return c;
          }),
        };
      });
    }
    if (resizeState.current) {
      resizeState.current = null;
      try { containerRef.current.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  const onContainerWheel = (e) => {
    if (!containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const fx = e.clientX - rect.left;
    const fy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setDoc((d) => ({ ...d, view: zoomAt(d.view, fx, fy, d.view.zoom * factor) }));
  };

  // ──────────────────────────────────────────────
  // Card actions
  // ──────────────────────────────────────────────
  const placeCard = (toolKind, worldX, worldY, extras = {}) => {
    let card;
    const rotation = (Math.random() - 0.5) * 2 * ROTATION_MAX_DEG;

    if (toolKind === 'sticky') {
      const color = extras.color || STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
      card = makeCard(extras.text ?? '', worldX - 110, worldY - 90, { type: 'note', color, rotation, ...extras });
    } else if (toolKind === 'text') {
      card = makeCard(extras.text || 'Text', worldX - 120, worldY - 60, { type: 'text', color: STICKY_COLORS[6], rotation, ...extras });
    } else if (toolKind === 'image') {
      card = makeCard('', worldX - 120, worldY - 120, { type: 'image', rotation, ...extras });
    } else if (toolKind === 'column') {
      card = makeCard('New column', worldX - 140, worldY - 60, { type: 'column', rotation: 0, ...extras });
    } else return;

    // If a parent card contains the click point, nest the new card inside it
    if (!extras.parentId) {
      const container = findCardAtPoint(worldX, worldY, doc.cards);
      if (container && container.id !== card.id && container.type !== 'image') {
        card.parentId = container.id;
        // Clamp child inside parent bounds
        card.x = Math.max(container.x + 6, Math.min(card.x, container.x + container.w - card.w - 6));
        card.y = Math.max(container.y + 6, Math.min(card.y, container.y + container.h - card.h - 6));
      }
    }

    setDoc((d) => ({ ...d, cards: [...d.cards, card] }));
    setSelectedId(card.id);
    setEditingId(card.id);
    setTool('select');
  };

  const placeTemplateCard = (template) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const center = screenToWorld(rect.width / 2, rect.height / 2, rect, view);
    placeCard('sticky', center.x, center.y, { text: template.text, color: template.color, template: template.id });
    setShowTemplates(false);
  };

  const onCardPointerDown = (e, card) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    // Capture the pointer on the card element immediately. This guarantees
    // we keep receiving pointermove/pointerup even when the cursor moves
    // outside the card's bounds (or over the resize handle / other cards).
    // Without this, dragging breaks once the cursor leaves the card.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    if (tool === 'connect') {
      if (!connectFrom) {
        setConnectFrom(card.id);
        setSelectedId(card.id);
        setEditingId(null);
      } else if (connectFrom !== card.id) {
        const newEdge = makeEdge(connectFrom, card.id);
        console.log('[canvas] edge created', newEdge);
        setDoc((d) => ({ ...d, edges: [...(d.edges || []), newEdge] }));
        setConnectFrom(null);
        setTool('select');
        setSelectedId(null);
      } else {
        setConnectFrom(null);
      }
      return;
    }

    setColorPickerFor(null);
    setConnectFrom(null);
    setSelectedZoneId(null);
    const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
    if (isMulti) {
      toggleCardSelection(card.id);
    } else if (!selectedIds.includes(card.id)) {
      selectOnly(card.id);
    }
    const w = toWorld(e.clientX, e.clientY);
    const groupedIds = card.groupId
      ? doc.cards.filter((item) => item.groupId === card.groupId).map((item) => item.id)
      : [];
    const dragIds = !isMulti && selectedIds.includes(card.id) && selectedIds.length > 1
      ? selectedIds
      : isMulti ? [card.id] : (selectedIds.includes(card.id) ? (groupedIds.length > 1 ? groupedIds : selectedIds) : [card.id]);
    const startPositions = dragIds.map((id) => {
      const item = doc.cards.find((candidate) => candidate.id === id);
      return item ? { id, x: item.x, y: item.y } : null;
    }).filter(Boolean);
    cardDragIntent.current = {
      id: card.id,
      startWX: w.x,
      startWY: w.y,
      startCardX: card.x,
      startCardY: card.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      hasMoved: false,
      tool,
      multiSelect: isMulti || dragIds.length > 1,
      dragIds,
      startPositions,
    };
  };

  const onCardTextChange = (id, value) => {
    setDoc((d) => ({ ...d, cards: d.cards.map((c) => c.id === id ? { ...c, text: value, dateModified: Date.now() } : c) }));
  };

  const onCardColorChange = (id, color) => {
    setDoc((d) => ({ ...d, cards: d.cards.map((c) => c.id === id ? { ...c, color } : c) }));
    setColorPickerFor(null);
  };

  const onCardResizeStart = (e, card) => {
    e.stopPropagation();
    e.preventDefault();
    const w = toWorld(e.clientX, e.clientY);
    resizeState.current = {
      id: card.id,
      startW: card.w,
      startH: card.h,
      startWX: w.x,
      startWY: w.y,
    };
    containerRef.current.setPointerCapture(e.pointerId);
  };

  const onCardDelete = (idOrIds) => {
    const ids = [...new Set((Array.isArray(idOrIds) ? idOrIds : [idOrIds]).filter(Boolean))];
    setDoc((d) => removeCardsFromCanvas(d, ids));
    selectCards([]);
    setColorPickerFor(null);
    setShowLinkPickerFor(null);
    if (ids.includes(editingId)) setEditingId(null);
    if (ids.includes(connectFrom)) setConnectFrom(null);
  };

  const onEdgeDelete = (id) => {
    setDoc((d) => ({ ...d, edges: (d.edges || []).filter((e) => e.id !== id) }));
  };

  // Toggle compact/expanded
  const onCardToggleCollapse = (id) => {
    setDoc((d) => ({ ...d, cards: d.cards.map((c) => c.id === id ? { ...c, collapsed: !c.collapsed } : c) }));
  };

  const onGroupCards = () => {
    if (selectedIds.length < 2) return;
    const groupId = crypto.randomUUID ? crypto.randomUUID() : `g_${Date.now()}`;
    setDoc((d) => ({ ...d, cards: d.cards.map((card) => selectedIds.includes(card.id) ? { ...card, groupId, dateModified: Date.now() } : card) }));
  };

  const onUngroupCards = () => {
    if (!selectedIds.length) return;
    setDoc((d) => ({ ...d, cards: d.cards.map((card) => selectedIds.includes(card.id) ? { ...card, groupId: null, dateModified: Date.now() } : card) }));
  };

  const onAlignCards = (axis) => {
    if (selectedCards.length < 2) return;
    const target = axis === 'x'
      ? Math.min(...selectedCards.map((card) => card.x))
      : Math.min(...selectedCards.map((card) => card.y));
    setDoc((d) => ({
      ...d,
      cards: d.cards.map((card) => selectedIds.includes(card.id)
        ? { ...card, [axis === 'x' ? 'x' : 'y']: target, dateModified: Date.now() }
        : card),
    }));
  };

  const onTidyCards = () => {
    if (selectedCards.length < 2) return;
    const sorted = [...selectedCards].sort((a, b) => a.y - b.y || a.x - b.x);
    const columns = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
    const gapX = 260, gapY = 210;
    const originX = Math.min(...sorted.map((card) => card.x));
    const originY = Math.min(...sorted.map((card) => card.y));
    const positions = new Map(sorted.map((card, index) => [card.id, {
      x: originX + (index % columns) * gapX,
      y: originY + Math.floor(index / columns) * gapY,
    }]));
    setDoc((d) => ({ ...d, cards: d.cards.map((card) => positions.has(card.id) ? { ...card, ...positions.get(card.id), dateModified: Date.now() } : card) }));
  };

  // Duplicate selected card (offset 20px down-right)
  const onCardDuplicate = (id) => {
    setDoc((d) => {
      const ids = selectedIds.length > 1 && selectedIds.includes(id) ? selectedIds : [id];
      const copies = d.cards.filter((card) => ids.includes(card.id)).map((src) => ({
        ...src,
        id: crypto.randomUUID ? crypto.randomUUID() : `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        x: src.x + 20, y: src.y + 20,
        parentId: null, groupId: null,
        dateCreated: Date.now(), dateModified: Date.now(),
      }));
      return { ...d, cards: [...d.cards, ...copies] };
    });
  };

  const onCardLinkChange = (id, linkEntryId) => {
    setDoc((d) => ({ ...d, cards: d.cards.map((card) => card.id === id ? { ...card, linkEntryId: linkEntryId || null, dateModified: Date.now() } : card) }));
    setShowLinkPickerFor(null);
    setLinkQuery('');
  };

  const onZonePointerDown = (e, zone) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelectedZoneId(zone.id);
    selectCards([]);
    if (zone.locked) return;
    const w = toWorld(e.clientX, e.clientY);
    zoneDragState.current = { id: zone.id, startWX: w.x, startWY: w.y, startX: zone.x, startY: zone.y };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };

  const onZoneResizeStart = (e, zone) => {
    e.stopPropagation();
    e.preventDefault();
    if (zone.locked) return;
    const w = toWorld(e.clientX, e.clientY);
    zoneResizeState.current = { id: zone.id, startW: zone.w, startH: zone.h, startWX: w.x, startWY: w.y };
    containerRef.current.setPointerCapture(e.pointerId);
  };

  const onZoneRename = (id, title) => {
    setDoc((d) => ({ ...d, zones: (d.zones || []).map((zone) => zone.id === id ? { ...zone, title: title || 'Zone', dateModified: Date.now() } : zone) }));
  };

  const onZoneColorChange = (id, color) => {
    setDoc((d) => ({ ...d, zones: (d.zones || []).map((zone) => zone.id === id ? { ...zone, color, dateModified: Date.now() } : zone) }));
    setZoneColorPickerFor(null);
  };

  const onZoneToggleLock = (id) => {
    setDoc((d) => ({ ...d, zones: (d.zones || []).map((zone) => zone.id === id ? { ...zone, locked: !zone.locked, dateModified: Date.now() } : zone) }));
  };

  const onZoneDelete = (id) => {
    setDoc((d) => ({ ...d, zones: (d.zones || []).filter((zone) => zone.id !== id) }));
    setSelectedZoneId(null);
    setZoneColorPickerFor(null);
  };

  // Media helpers. Files are persisted through the encrypted entry body, the
  // same path already used by editor attachments.
  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    if (!file || file.size > MAX_MEDIA_FILE_BYTES) {
      reject(new Error('Attachment exceeds the 50 MB limit'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });

  const readTextPreview = async (file, kind) => {
    if (kind !== MEDIA_KINDS.document || file.size > 1024 * 1024) return '';
    if (!(file.type.startsWith('text/') || /\.(txt|md|markdown|csv|json|xml|html|htm|log)$/i.test(file.name))) return '';
    try { return (await file.text()).slice(0, 1800); } catch { return ''; }
  };

  const mediaFromFile = async (file, options = {}) => {
    if (!file || file.size > MAX_MEDIA_FILE_BYTES) throw new Error('Attachment exceeds the 50 MB limit');
    const kind = options.kind || mediaKindFromFile(file);
    const dataUrl = options.dataUrl !== undefined ? options.dataUrl : await readFileAsDataUrl(file);
    return {
      kind,
      name: file.name || 'Attached file',
      size: file.size || 0,
      mime: file.type || 'application/octet-stream',
      dataUrl,
      textPreview: options.textPreview !== undefined ? options.textPreview : await readTextPreview(file, kind),
      url: options.url || null,
      duration: Number(options.duration) || 0,
      dateCreated: Date.now(),
    };
  };

  const addMediaCard = async (file, worldX, worldY, options = {}) => {
    try {
      const media = await mediaFromFile(file, options);
      const card = makeCard('', worldX - 140, worldY - 110, { type: 'media', media, color: STICKY_COLORS[6], rotation: 0 });
      setDoc((d) => ({ ...d, cards: [...d.cards, card] }));
      selectOnly(card.id);
      setEditingId(null);
    } catch {}
  };
  nativeDropAddMediaRef.current = addMediaCard;

  const attachMediaToCard = async (cardId, file) => {
    try {
      const media = await mediaFromFile(file);
      setDoc((d) => ({ ...d, cards: d.cards.map((card) => card.id === cardId ? { ...card, media, imageData: null, dateModified: Date.now() } : card) }));
    } catch {}
  };

  useEffect(() => {
    let active = true;
    let unlisten;
    subscribeToNativeFileDrop((files, position) => {
      if (!active || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const point = position && Number.isFinite(position.x) && Number.isFinite(position.y)
        ? { x: position.x / scale, y: position.y / scale }
        : null;
      const insideSurface = point && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
      const world = insideSurface && nativeDropToWorldRef.current
        ? nativeDropToWorldRef.current(point.x, point.y)
        : nativeDropMouseWorldRef.current;
      files.forEach((file, index) => nativeDropAddMediaRef.current?.(file, world.x + (index % 2) * 300, world.y + Math.floor(index / 2) * 240));
    }).then((stop) => {
      if (!active) stop?.();
      else unlisten = stop;
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  const onCardPaste = (e, card) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      const file = item.getAsFile?.();
      if (file) {
        e.preventDefault();
        attachMediaToCard(card.id, file);
        return;
      }
    }
  };

  const onCardDrop = (e, card) => {
    e.preventDefault();
    e.stopPropagation();
    const file = Array.from(e.dataTransfer?.files || [])[0];
    if (file) attachMediaToCard(card.id, file);
    else attachLinkToCard(card.id, e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain'));
  };

  const onCardRemoveMedia = (cardId) => {
    setDoc((d) => ({ ...d, cards: d.cards.map((card) => card.id === cardId ? { ...card, media: null, imageData: null, dateModified: Date.now() } : card) }));
  };

  const addLinkCard = (url, worldX, worldY) => {
    const cleanUrl = String(url || '').trim();
    if (!/^https?:\/\//i.test(cleanUrl)) return;
    const media = { kind: MEDIA_KINDS.link, name: cleanUrl.replace(/^https?:\/\//i, '').split('/')[0] || cleanUrl, size: 0, mime: 'text/uri-list', dataUrl: null, textPreview: cleanUrl, url: cleanUrl, dateCreated: Date.now() };
    const card = makeCard('', worldX - 140, worldY - 85, { type: 'media', media, color: STICKY_COLORS[6], rotation: 0 });
    setDoc((d) => ({ ...d, cards: [...d.cards, card] }));
    selectOnly(card.id);
    setEditingId(null);
  };

  const attachLinkToCard = (cardId, url) => {
    const cleanUrl = String(url || '').trim();
    if (!/^https?:\/\//i.test(cleanUrl)) return;
    const media = { kind: MEDIA_KINDS.link, name: cleanUrl.replace(/^https?:\/\//i, '').split('/')[0] || cleanUrl, size: 0, mime: 'text/uri-list', dataUrl: null, textPreview: cleanUrl, url: cleanUrl, dateCreated: Date.now() };
    setDoc((d) => ({ ...d, cards: d.cards.map((card) => card.id === cardId ? { ...card, media, dateModified: Date.now() } : card) }));
  };

  const onSurfacePaste = (e) => {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length) {
      e.preventDefault();
      files.forEach((file, index) => addMediaCard(file, mouseWorld.x + index * 24, mouseWorld.y + index * 24));
      return;
    }
    const text = e.clipboardData?.getData('text/plain') || '';
    if (/^https?:\/\//i.test(text.trim())) {
      e.preventDefault();
      addLinkCard(text.trim(), mouseWorld.x, mouseWorld.y);
    }
  };

  const startVoiceRecording = async () => {
    if (isRecording || !navigator.mediaDevices?.getUserMedia) return;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Audio capture is unavailable');

      const audioContext = new AudioContextClass();
      await audioContext.resume?.();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const muteGain = audioContext.createGain();
      const samples = [];
      const recordingPosition = { ...mouseWorld };
      muteGain.gain.value = 0;
      processor.onaudioprocess = (event) => {
        samples.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(audioContext.destination);

      const session = {
        state: 'recording',
        stop: async () => {
          if (session.state !== 'recording') return;
          session.state = 'inactive';
          processor.onaudioprocess = null;
          source.disconnect();
          processor.disconnect();
          muteGain.disconnect();
          stream.getTracks().forEach((track) => track.stop());
          const totalSamples = samples.reduce((total, chunk) => total + chunk.length, 0);
          const mergedSamples = new Float32Array(totalSamples);
          let offset = 0;
          samples.forEach((chunk) => { mergedSamples.set(chunk, offset); offset += chunk.length; });
          const blob = audioBufferToWav({
            numberOfChannels: 1,
            length: mergedSamples.length,
            sampleRate: audioContext.sampleRate,
            getChannelData: () => mergedSamples,
          });
          const durationMs = Math.max(250, Date.now() - recordingStartedAtRef.current);
          const file = new File([blob], `Voice note ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.wav`, { type: 'audio/wav' });
          await addMediaCard(file, recordingPosition.x, recordingPosition.y, { kind: MEDIA_KINDS.voice, duration: durationMs / 1000 });
          await audioContext.close();
        },
      };

      mediaRecorderRef.current = session;
      recordingStartedAtRef.current = Date.now();
      setRecordingElapsed(0);
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingElapsed((seconds) => {
        const next = seconds + 1;
        if (next >= MAX_VOICE_RECORDING_SECONDS) {
          setTimeout(() => stopVoiceRecording(), 0);
          return MAX_VOICE_RECORDING_SECONDS;
        }
        return next;
      }), 1000);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setIsRecording(false);
  };

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }, []);

  // Unparent a child (detach)
  const onCardUnparent = (cardId) => {
    setDoc((d) => ({ ...d, cards: d.cards.map((c) => c.id === cardId ? { ...c, parentId: null } : c) }));
  };

  // ──────────────────────────────────────────────
  // Surface-level image drop (creates a new image card)
  // ──────────────────────────────────────────────
  const onSurfaceDragEnter = (e) => {
    if (!e.dataTransfer?.types?.includes('Files') && !e.dataTransfer?.types?.includes('text/uri-list') && !e.dataTransfer?.types?.includes('text/plain')) return;
    e.preventDefault();
    dragCounter.current += 1;
    setIsDraggingMedia(true);
  };
  const onSurfaceDragOver = (e) => {
    if (!e.dataTransfer?.types?.includes('Files') && !e.dataTransfer?.types?.includes('text/uri-list') && !e.dataTransfer?.types?.includes('text/plain')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onSurfaceDragLeave = (e) => {
    if (!e.dataTransfer?.types?.includes('Files') && !e.dataTransfer?.types?.includes('text/uri-list') && !e.dataTransfer?.types?.includes('text/plain')) return;
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDraggingMedia(false);
  };
  const onSurfaceDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingMedia(false);
    const files = Array.from(e.dataTransfer?.files || []);
    const w = toWorld(e.clientX, e.clientY);
    files.forEach((file, i) => addMediaCard(file, w.x + (i % 2) * 300, w.y + Math.floor(i / 2) * 240));
    const droppedUrl = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
    if (!files.length && /^https?:\/\//i.test(String(droppedUrl || '').trim())) addLinkCard(droppedUrl.trim(), w.x, w.y);
  };

  // ──────────────────────────────────────────────
  // Toolbar
  // ──────────────────────────────────────────────
  const handleFit = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const fit = fitToView([...(doc.cards || []), ...(doc.zones || [])], rect.width, rect.height, 120);
    if (fit) setDoc((d) => ({ ...d, view: fit }));
  };
  const handleCenter = () => {
    const c = cardsCenter([...(doc.cards || []), ...(doc.zones || [])]);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDoc((d) => ({ ...d, view: { ...d.view, x: c.x - rect.width / 2 / d.view.zoom, y: c.y - rect.height / 2 / d.view.zoom } }));
  };
  const handleZoomIn = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDoc((d) => ({ ...d, view: zoomAt(d.view, rect.width / 2, rect.height / 2, d.view.zoom * 1.2) }));
  };
  const handleZoomOut = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDoc((d) => ({ ...d, view: zoomAt(d.view, rect.width / 2, rect.height / 2, d.view.zoom / 1.2) }));
  };

  const focusCard = (id) => {
    const card = doc.cards.find((item) => item.id === id);
    if (!card || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDoc((d) => ({ ...d, view: { ...d.view, x: card.x + card.w / 2 - rect.width / 2 / d.view.zoom, y: card.y + card.h / 2 - rect.height / 2 / d.view.zoom } }));
    selectOnly(id);
    setEditingId(null);
    setShowSearch(false);
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportVisual = async (format) => {
    const svg = buildCanvasSvg({ ...doc, cards: selectedIds.length ? selectedCards : doc.cards, zones: selectedIds.length ? [] : (doc.zones || []) });
    const safeTitle = (title || 'canvas').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
    if (format === 'svg') {
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${safeTitle}.svg`);
    } else if (format === 'png') {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = image.width * scale;
        canvas.height = image.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fbfaf7';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((png) => png && downloadBlob(png, `${safeTitle}.png`), 'image/png');
        URL.revokeObjectURL(url);
      };
      image.src = url;
    } else if (format === 'pdf') {
      const printWindow = window.open('', '_blank', 'noopener,noreferrer');
      if (printWindow) {
        printWindow.document.write(`<html><head><title>${safeTitle}</title><style>body{margin:0;padding:24px;background:#fff}svg{width:100%;height:auto}</style></head><body>${svg}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 150);
      }
    }
    setShowExportMenu(false);
  };

  const sendToEditor = () => {
    if (!onCreatePage) return;
    const cards = selectedIds.length ? selectedCards : doc.cards;
    if (!cards.length) return;
    onCreatePage({
      title: `${title || 'Canvas'} — Draft`,
      body: canvasCardsToHtml(cards, selectedIds.length ? [] : (doc.zones || [])),
      tags: [],
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.target.closest('.canvas-card textarea, .canvas-card input, .canvas-title-input')) return;
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setShowSearch(true);
        return;
      }
      if (mod && (e.key === 'd' || e.key === 'D')) {
        if (selectedId) { e.preventDefault(); onCardDuplicate(selectedId); return; }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length) { e.preventDefault(); onCardDelete(selectedIds); }
        else if (selectedZoneId) { e.preventDefault(); onZoneDelete(selectedZoneId); }
      } else if (e.key === 'Escape') {
        if (showSearch) { setShowSearch(false); setSearchQuery(''); return; }
        if (connectFrom) { setConnectFrom(null); return; }
        setSelectedId(null);
        setSelectedIds([]);
        setSelectedZoneId(null);
        setColorPickerFor(null);
        setZoneColorPickerFor(null);
        setShowLinkPickerFor(null);
        setShowTemplates(false);
        setTool('select');
      } else if (e.key === 'f' || e.key === 'F') { setIsFocusMode((current) => !current); }
      else if (e.key === 'v' || e.key === 'V') { setTool('select'); }
      else if (e.key === 's' || e.key === 'S') { setTool('sticky'); }
      else if (e.key === 't' || e.key === 'T') { setTool('text'); }
      else if (e.key === 'c' || e.key === 'C') { setTool('connect'); }
      else if (e.key === 'k' || e.key === 'K') { setTool('column'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedIds, selectedZoneId, connectFrom, showSearch]);

  const cardById = useMemo(() => {
    const m = new Map();
    doc.cards.forEach((c) => m.set(c.id, c));
    return m;
  }, [doc.cards]);

  const isEmpty = doc.cards.length === 0;
  if (!entry) return null;

  return (
    <main className={`canvas-workspace ${isFocusMode ? 'canvas-focus-mode' : ''}`}>
      {/* Top bar */}
      <div className="canvas-topbar">
        <div className="canvas-topbar-title-group">
          <input
            type="text"
            className="canvas-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Canvas"
            spellCheck={false}
          />
          <span className={`canvas-save-status ${saveStatus}`} aria-live="polite">
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : `Saved ${formatRelativeTime(lastSavedAt)}`}
          </span>
        </div>
        <div className="canvas-topbar-actions">
          <button className="canvas-topbar-icon-btn" onClick={undo} title="Undo (Ctrl+Z)"><Undo2 size={15} /></button>
          <button className="canvas-topbar-icon-btn" onClick={redo} title="Redo (Ctrl+Shift+Z)"><Redo2 size={15} /></button>
          <div className="canvas-topbar-divider" />
          <button className={`canvas-topbar-icon-btn ${showSearch ? 'active' : ''}`} onClick={() => setShowSearch((current) => !current)} title="Find cards (Ctrl+F)"><Search size={15} /></button>
          <button className="btn btn-secondary btn-sm" onClick={handleFit} title="Fit to view">
            <Maximize size={14} /> Fit
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setIsFocusMode((current) => !current)} title={isFocusMode ? 'Exit focus mode (Esc)' : 'Focus mode'}>
            {isFocusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />} Focus
          </button>
          <div className="canvas-export-wrap">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowExportMenu((current) => !current)} title="Export canvas">
              <Download size={14} /> Export
            </button>
            {showExportMenu && (
              <div className="canvas-export-menu" onPointerDown={(e) => e.stopPropagation()}>
                <button onClick={() => exportVisual('png')}><FileImage size={14} /> PNG {selectedIds.length ? '(selection)' : ''}</button>
                <button onClick={() => exportVisual('svg')}><FileText size={14} /> SVG {selectedIds.length ? '(selection)' : ''}</button>
                <button onClick={() => exportVisual('pdf')}><FileText size={14} /> Print / PDF</button>
                <div className="canvas-menu-divider" />
                <button onClick={sendToEditor} disabled={!doc.cards.length}><ExternalLink size={14} /> Send to editor</button>
                <button onClick={() => { setShowExportMenu(false); onExport(); }}><Download size={14} /> Backup & share</button>
              </div>
            )}
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(entry.id)} title="Delete this canvas">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Canvas surface */}
      <div
        ref={containerRef}
        className={`canvas-surface tool-${tool} ${isDraggingMedia ? 'dragging-image' : ''}`}
        onPointerDown={onContainerPointerDown}
        onPointerMove={onContainerPointerMove}
        onPointerUp={onContainerPointerUp}
        onPointerCancel={onContainerPointerUp}
        onWheel={onContainerWheel}
        onDragEnter={onSurfaceDragEnter}
        onDragOver={onSurfaceDragOver}
        onDragLeave={onSurfaceDragLeave}
        onDrop={onSurfaceDrop}
        onPaste={onSurfacePaste}
        tabIndex={0}
      >
        {isFocusMode && (
          <div className="canvas-focus-hint"><span className="kbd">Esc</span><span>to exit focus mode</span></div>
        )}
        <div
          className="canvas-grid"
          style={{
            backgroundPosition: `${-view.x * view.zoom}px ${-view.y * view.zoom}px`,
            backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`,
          }}
        />

        {showSearch && (
          <div className="canvas-search-panel" onPointerDown={(e) => e.stopPropagation()}>
            <div className="canvas-search-input-wrap">
              <Search size={14} />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find a card…"
                aria-label="Find a card"
              />
              <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} title="Close search"><X size={14} /></button>
            </div>
            {searchQuery && (
              <div className="canvas-search-results">
                {searchMatches.length ? searchMatches.slice(0, 8).map((card) => (
                  <button key={card.id} onClick={() => focusCard(card.id)}>
                    <span className="canvas-search-result-dot" style={{ background: themedCanvasColor(card.color || STICKY_COLORS[0], 'card', 'border') || 'var(--accent)' }} />
                    <span>{String(card.text || 'Untitled card').split('\n')[0].slice(0, 56)}</span>
                    <ExternalLink size={12} />
                  </button>
                )) : <div className="canvas-search-empty">No matching cards</div>}
              </div>
            )}
          </div>
        )}

        {/* Snap guide lines */}
        {snapGuides.x !== null && (
          <div className="canvas-snap-guide vertical" style={{ left: snapGuides.x }} />
        )}
        {snapGuides.y !== null && (
          <div className="canvas-snap-guide horizontal" style={{ top: snapGuides.y }} />
        )}

        {selectionBox && (
          <div
            className={`canvas-selection-box ${selectionBox.type === 'zone' ? 'zone-draft' : ''}`}
            style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.width, height: selectionBox.height }}
          />
        )}

        <div
          className="canvas-world"
          style={{
            transform: `translate3d(${(-view.x * view.zoom)}px, ${(-view.y * view.zoom)}px, 0) scale(${view.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Soft zones sit behind cards and remain optional visual guides. */}
          {(doc.zones || []).map((zone) => (
            <div
              key={zone.id}
              className={`canvas-zone ${selectedZoneId === zone.id ? 'selected' : ''} ${zone.locked ? 'locked' : ''}`}
              style={{
                left: zone.x, top: zone.y, width: zone.w, height: zone.h,
                background: themedCanvasColor(zone.color || ZONE_COLORS[0], 'zone', 'bg'),
                borderColor: themedCanvasColor(zone.color || ZONE_COLORS[0], 'zone', 'border'),
                color: themedCanvasColor(zone.color || ZONE_COLORS[0], 'zone', 'text'),
              }}
              onPointerDown={(e) => onZonePointerDown(e, zone)}
              onDoubleClick={(e) => { e.stopPropagation(); setSelectedZoneId(zone.id); }}
            >
              <div className="canvas-zone-header" onPointerDown={(e) => { if (!zone.locked) onZonePointerDown(e, zone); }}>
                {selectedZoneId === zone.id ? (
                  <input
                    value={zone.title}
                    onChange={(e) => onZoneRename(zone.id, e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
                    aria-label="Zone name"
                  />
                ) : <span>{zone.title}</span>}
                {selectedZoneId === zone.id && (
                  <div className="canvas-zone-actions" onPointerDown={(e) => e.stopPropagation()}>
                    <button className="canvas-zone-action" onClick={() => onZoneToggleLock(zone.id)} title={zone.locked ? 'Unlock zone' : 'Lock zone'}>
                      {zone.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    <button className="canvas-zone-action" onClick={() => setZoneColorPickerFor(zoneColorPickerFor === zone.id ? null : zone.id)} title="Change zone color"><Palette size={12} /></button>
                    <button className="canvas-zone-action danger" onClick={() => onZoneDelete(zone.id)} title="Delete zone"><Trash2 size={12} /></button>
                  </div>
                )}
              </div>
              {zoneColorPickerFor === zone.id && (
                <div className="canvas-zone-color-picker" onPointerDown={(e) => e.stopPropagation()}>
                  {ZONE_COLORS.map((color) => (
                    <button key={color.id} className="canvas-zone-color-swatch" style={{ background: themedCanvasColor(color, 'zone', 'bg'), borderColor: themedCanvasColor(color, 'zone', 'border') }} onClick={() => onZoneColorChange(zone.id, color)} title={color.id} />
                  ))}
                </div>
              )}
              {selectedZoneId === zone.id && !zone.locked && <div className="canvas-zone-resize" onPointerDown={(e) => onZoneResizeStart(e, zone)} title="Resize zone" />}
            </div>
          ))}

          {/* Edges */}
          <div className="canvas-edges">
            {(doc.edges || []).map((edge) => {
              const a = cardById.get(edge.from);
              const b = cardById.get(edge.to);
              if (!a || !b) return null;
              return <EdgeLine key={edge.id} a={a} b={b} onDelete={() => onEdgeDelete(edge.id)} />;
            })}
            {connectFrom && cardById.get(connectFrom) && (
              <EdgeLine
                a={cardById.get(connectFrom)}
                b={{ x: mouseWorld.x, y: mouseWorld.y }}
                preview
              />
            )}
          </div>

          {/* Cards */}
          {doc.cards.map((card) => {
            const children = doc.cards.filter((c) => c.parentId === card.id);
            const isParent = children.length > 0;
            return (
              <CanvasCard
                key={card.id}
                card={card}
                selected={selectedIds.includes(card.id)}
                editing={editingId === card.id}
                tool={tool}
                connectingFrom={connectFrom === card.id}
                dragging={dragState.current?.ids?.includes(card.id)}
                isParent={isParent}
                childCount={children.length}
                onPointerDown={(e) => onCardPointerDown(e, card)}
                onTextChange={(v) => onCardTextChange(card.id, v)}
                onFinishEdit={() => setEditingId(null)}
                onResizeStart={(e) => onCardResizeStart(e, card)}
                onPaste={(e) => onCardPaste(e, card)}
                onDrop={(e) => onCardDrop(e, card)}
                onRemoveMedia={() => onCardRemoveMedia(card.id)}
                showColorPicker={colorPickerFor === card.id}
                onColorChange={(c) => onCardColorChange(card.id, c)}
                onToggleCollapse={() => onCardToggleCollapse(card.id)}
                onUnparent={() => onCardUnparent(card.id)}
                onHoverChange={(hovering) => setHoverPreviewId(hovering ? card.id : null)}
                showColorPickerOpen={colorPickerFor === card.id}
                setColorPickerOpen={(open) => setColorPickerFor(open ? card.id : null)}
                linkedEntry={entries.find((item) => item.id === card.linkEntryId)}
                onLinkClick={() => card.linkEntryId && onOpenEntry?.(card.linkEntryId)}
              />
            );
          })}
        </div>

        {/* Hover preview for collapsed cards */}
        {hoverPreviewId && (() => {
          const card = cardById.get(hoverPreviewId);
          if (!card || !card.collapsed) return null;
          const screen = worldToScreen(card.x, card.y, view);
          const previewH = 200;
          return (
            <div
              className="canvas-card-hover-preview canvas-card"
              style={{
                left: screen.x,
                top: Math.max(8, screen.y - previewH - 20),
                width: card.w,
                height: previewH,
                background: themedCanvasColor(card.color, 'card', 'bg'),
                borderColor: themedCanvasColor(card.color, 'card', 'border'),
                color: themedCanvasColor(card.color, 'card', 'text'),
                transform: 'none',
                zIndex: 60,
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
              }}
            >
              {card.template && <div className="canvas-card-template-bar" style={{ color: themedCanvasColor(card.color, 'card', 'text') }} />}
              <div className="canvas-card-content">
                <div
                  className="canvas-card-rendered"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(card.text) || '<span class="canvas-card-placeholder">Empty</span>' }}
                />
              </div>
              <div className="canvas-card-footer">
                <span>{formatRelativeTime(card.dateModified)}</span>
              </div>
            </div>
          );
        })()}

        {/* Floating left toolbar */}
        <div className="canvas-floating canvas-toolbar-left">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = tool === t.id;
            return (
              <button
                key={t.id}
                className={`canvas-tool-btn ${active ? 'active' : ''}`}
                onClick={() => { setTool(t.id); setShowTemplates(false); }}
                title={t.name}
              >
                <Icon size={16} />
              </button>
            );
          })}
          <div className="canvas-tool-divider" />
          <div style={{ position: 'relative' }}>
            <button
              className={`canvas-tool-btn ${showTemplates ? 'active' : ''}`}
              onClick={() => setShowTemplates((v) => !v)}
              title="Sticker templates"
            >
              <Sparkles size={16} />
            </button>
            {showTemplates && (
              <div className="canvas-templates-popover" onPointerDown={(e) => e.stopPropagation()}>
                {STICKER_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    className="canvas-template-option"
                    onClick={() => placeTemplateCard(t)}
                  >
                    <span
                      className="canvas-template-swatch"
                      style={{ background: themedCanvasColor(t.color, 'card', 'bg'), borderColor: themedCanvasColor(t.color, 'card', 'border') }}
                    />
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className={`canvas-tool-btn ${isRecording ? 'active recording' : ''}`}
            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
            title={isRecording ? 'Stop voice recording' : 'Record voice note'}
          >
            {isRecording ? <Square size={14} /> : <Mic size={16} />}
          </button>
          {isRecording && <span className="canvas-recording-time">{String(Math.floor(recordingElapsed / 60)).padStart(2, '0')}:{String(recordingElapsed % 60).padStart(2, '0')}</span>}
        </div>

        {/* Floating right — zoom controls */}
        <div className="canvas-floating canvas-toolbar-right">
          <div className="canvas-zoom-group">
            <button className="canvas-tool-btn" onClick={handleZoomOut} title="Zoom out">
              <ZoomOut size={14} />
            </button>
            <button className="canvas-zoom-readout" onClick={handleFit} title="Click to fit">
              {Math.round(view.zoom * 100)}%
            </button>
            <button className="canvas-tool-btn" onClick={handleZoomIn} title="Zoom in">
              <ZoomIn size={14} />
            </button>
          </div>
          <button className="canvas-tool-btn" onClick={handleCenter} title="Center on content">
            <Maximize size={14} />
          </button>
        </div>

        {/* Selected card quick-actions popover */}
        {selectedIds.length > 0 && tool === 'select' && (() => {
          const card = cardById.get(selectedId);
          if (!card) return null;
          const anchor = selectedCards.reduce((rightmost, item) => Math.max(rightmost, item.x + item.w), 0);
          const top = Math.min(...selectedCards.map((item) => item.y));
          const screen = worldToScreen(anchor, top, view);
          const isMulti = selectedIds.length > 1;
          const linkedEntry = entries.find((item) => item.id === card.linkEntryId);
          return (
            <div
              className="canvas-floating canvas-card-actions"
              style={{ left: Math.min(screen.x + 8, Math.max(8, containerRef.current?.clientWidth - 260 || screen.x + 8)), top: Math.max(8, screen.y - 8) }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {isMulti ? (
                <>
                  <span className="canvas-selection-count">{selectedIds.length} selected</span>
                  <button className="canvas-tool-btn" onClick={onGroupCards} title="Group selected cards"><Layers size={14} /></button>
                  <button className="canvas-tool-btn" onClick={onUngroupCards} title="Ungroup selected cards"><Layers size={14} style={{ opacity: 0.55 }} /></button>
                  <button className="canvas-tool-btn" onClick={() => onAlignCards('x')} title="Align left"><AlignLeft size={14} /></button>
                  <button className="canvas-tool-btn" onClick={() => onAlignCards('y')} title="Align top"><AlignCenter size={14} /></button>
                  <button className="canvas-tool-btn" onClick={onTidyCards} title="Tidy layout"><Rows3 size={14} /></button>
                  <button className="canvas-tool-btn" onClick={sendToEditor} title="Send selection to editor"><ExternalLink size={14} /></button>
                  <div className="canvas-tool-divider" />
                  <button className="canvas-tool-btn" style={{ color: '#ef4444' }} onClick={() => onCardDelete(selectedIds)} title="Delete selected cards"><Trash2 size={14} /></button>
                </>
              ) : (
                <>
                  <button className="canvas-tool-btn" onClick={() => setColorPickerFor(selectedId)} title="Change color"><Palette size={14} /></button>
                  <button className="canvas-tool-btn" onClick={() => onCardDuplicate(selectedId)} title="Duplicate (Ctrl+D)"><Copy size={14} /></button>
                  <button className="canvas-tool-btn" onClick={() => onCardToggleCollapse(selectedId)} title={card.collapsed ? 'Expand' : 'Compact'}>
                    {card.collapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                  </button>
                  <button className={`canvas-tool-btn ${showLinkPickerFor === selectedId ? 'active' : ''}`} onClick={() => setShowLinkPickerFor(showLinkPickerFor === selectedId ? null : selectedId)} title={linkedEntry ? `Linked to ${linkedEntry.title}` : 'Link to a page'}><Link2 size={14} /></button>
                  {card.parentId && <button className="canvas-tool-btn" onClick={() => onCardUnparent(selectedId)} title="Detach from parent"><ImagePlus size={14} style={{ transform: 'rotate(45deg)' }} /></button>}
                  <div className="canvas-tool-divider" />
                  <button className="canvas-tool-btn" style={{ color: '#ef4444' }} onClick={() => onCardDelete(selectedId)} title="Delete card"><Trash2 size={14} /></button>
                  {colorPickerFor === selectedId && (
                    <div className="canvas-color-picker" onPointerDown={(e) => e.stopPropagation()}>
                      {STICKY_COLORS.map((c) => <button key={c.id} className="canvas-color-swatch" style={{ background: themedCanvasColor(c, 'card', 'bg'), borderColor: themedCanvasColor(c, 'card', 'border') }} onClick={() => onCardColorChange(selectedId, c)} title={c.id} />)}
                    </div>
                  )}
                  {showLinkPickerFor === selectedId && (
                    <div className="canvas-link-picker" onPointerDown={(e) => e.stopPropagation()}>
                      <div className="canvas-link-picker-title">Link this card to a page</div>
                      <input value={linkQuery} onChange={(e) => setLinkQuery(e.target.value)} placeholder="Search pages…" autoFocus />
                      {linkedEntry && <button className="canvas-link-option clear" onClick={() => onCardLinkChange(selectedId, null)}><X size={12} /> Remove link</button>}
                      {entries.filter((item) => item.id !== entry.id && `${item.title} ${item.entryType}`.toLowerCase().includes(linkQuery.toLowerCase())).slice(0, 6).map((item) => (
                        <button key={item.id} className="canvas-link-option" onClick={() => onCardLinkChange(selectedId, item.id)}><Link2 size={12} /><span>{item.title || 'Untitled page'}</span></button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* Empty-state hint */}
        {isEmpty && !(doc.zones || []).length && (
          <div className="canvas-empty-hint">
            <div style={{ fontSize: 28, marginBottom: 8 }}>✦</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>An empty canvas</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Pick a tool on the left and click anywhere to drop a card.
              <br /><b>Click</b> to edit · <b>Drag</b> to move · use <b>#tags</b> to organize.
            </div>
          </div>
        )}

        {/* Connection-mode banner */}
        {tool === 'connect' && (
          <div className="canvas-connection-banner">
            {connectFrom
              ? <>Now click a card to link to it · <span className="kbd">Esc</span> to cancel.</>
              : <>Click the first card you want to connect.</>}
          </div>
        )}

        {/* Media drop overlay */}
        {isDraggingMedia && (
          <div className="canvas-drop-overlay">
            <div style={{ fontSize: 36, marginBottom: 8 }}>🖼️</div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Drop to add media</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Images, PDFs, audio, video, documents, or links</div>
          </div>
        )}

        {/* First-time hashtag hint */}
        {showTagHint && (
          <div className="canvas-hint-toast">
            <Sparkles size={14} style={{ color: 'var(--accent)' }} />
            <span>Type <span className="kbd">#tag</span> inside a card — it becomes a colored chip you can scan.</span>
            <button onClick={() => setShowTagHint(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

// ────────────────────────────────────────────────────────────
// Single card subcomponent
// ────────────────────────────────────────────────────────────
function CanvasCard({
  card, selected, editing, tool, connectingFrom, dragging, isParent, childCount,
  onPointerDown, onTextChange, onFinishEdit,
  onResizeStart, onPaste, onDrop, onRemoveMedia,
  showColorPicker, onColorChange, onUnparent, onHoverChange,
  linkedEntry, onLinkClick,
}) {
  const isColumn = card.type === 'column';
  const isImage = card.type === 'image';
  const isMedia = card.type === 'media';
  const color = card.color || STICKY_COLORS[0];
  const isChild = !!card.parentId;
  const tags = useMemo(() => extractHashtags(card.text), [card.text]);
  const renderedHtml = useMemo(() => parseMarkdown(card.text), [card.text]);

  // Transform: rotation always; scale when dragging
  const transform = dragging
    ? `scale(1.03) rotate(${card.rotation}deg)`
    : `rotate(${card.rotation}deg)`;

  return (
    <div
      className={`canvas-card canvas-card-${card.type} ${selected ? 'selected' : ''} ${editing ? 'editing' : ''} ${connectingFrom ? 'connecting-from' : ''} ${tool === 'connect' ? 'connect-mode' : ''} ${isParent ? 'is-parent' : ''} ${isChild ? 'is-child' : ''} ${card.collapsed ? 'collapsed' : ''} ${dragging ? 'dragging' : ''} ${card.groupId ? 'is-grouped' : ''}`}
      style={{
        left: card.x, top: card.y,
        width: card.w, height: card.h,
        background: themedCanvasColor(color, 'card', 'bg'),
        borderColor: themedCanvasColor(color, 'card', 'border'),
        color: themedCanvasColor(color, 'card', 'text'),
        transform,
      }}
      onPointerDown={onPointerDown}
      onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files') || e.dataTransfer?.types?.includes('text/uri-list')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
      onDrop={onDrop}
      onMouseEnter={() => card.collapsed && onHoverChange && onHoverChange(true)}
      onMouseLeave={() => card.collapsed && onHoverChange && onHoverChange(false)}
    >
      {/* Template accent bar at the top */}
      {card.template && !isColumn && !card.collapsed && (
        <div className="canvas-card-template-bar" style={{ color: color.text }} />
      )}

      {isImage ? (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {card.imageData ? (
            <img src={card.imageData} alt="" className="canvas-card-image" draggable={false}
              onDragStart={(e) => e.preventDefault()} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', gap: 8, padding: 12,
            }}>
              <ImageIcon size={28} />
              <span style={{ fontSize: 12 }}>Paste or drop an image</span>
            </div>
          )}
        </div>
      ) : isMedia ? (
        <MediaCardContent media={card.media} onRemove={onRemoveMedia} />
      ) : isColumn ? (
        <div className="canvas-column-inner">
          <div className="canvas-column-header">
            <input
              className="canvas-card-title-input"
              value={card.text}
              onChange={(e) => onTextChange(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="Column name"
            />
          </div>
          <div className="canvas-column-body">
            <div className="canvas-column-hint">
              {editing ? 'Type the column name above.' : 'Drop or paste cards here.'}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Inline image (for non-image cards) */}
          {card.media && !card.collapsed && (
            <MediaCardContent media={card.media} onRemove={onRemoveMedia} compact />
          )}
          {card.imageData && !card.collapsed && (
            <div style={{ position: 'relative' }}>
              <img src={card.imageData} alt="" className="canvas-card-embedded-image" draggable={false}
                onDragStart={(e) => e.preventDefault()} />
              <button
                className="canvas-card-remove-image"
                onPointerDown={(e) => { e.stopPropagation(); onRemoveMedia(); }}
                title="Remove image"
              >×</button>
            </div>
          )}

          <div className="canvas-card-content">
            {editing ? (
              <textarea
                className="canvas-card-textarea"
                value={card.text}
                onChange={(e) => onTextChange(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={onFinishEdit}
                onPaste={(e) => onPaste(e)}
                onKeyDown={(e) => { if (e.key === 'Escape') onFinishEdit(); }}
                placeholder="Type a note. Use **bold**, *italic*, # heading, - [ ] todo, #tag"
                autoFocus
              />
            ) : (
              <div
                className="canvas-card-rendered"
                dangerouslySetInnerHTML={{
                  __html: renderedHtml || '<span class="canvas-card-placeholder">Click to write…</span>',
                }}
              />
            )}

            {/* Hashtag chips */}
            {!editing && !card.collapsed && tags.length > 0 && (
              <div className="canvas-card-tags">
                {tags.map((tag) => {
                  const c = tagColor(tag);
                  const tagColorSet = { value: c.bg, border: c.border, text: c.text };
                  return (
                    <span
                      key={tag}
                      className="canvas-tag-chip"
                      style={{
                        background: themedCanvasColor(tagColorSet, 'card', 'bg'),
                        borderColor: themedCanvasColor(tagColorSet, 'card', 'border'),
                        color: themedCanvasColor(tagColorSet, 'card', 'text'),
                      }}
                    >
                      #{tag}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Color picker popover (only on non-column cards) */}
      {showColorPicker && !isColumn && (
        <div className="canvas-color-picker" onPointerDown={(e) => e.stopPropagation()}>
          {STICKY_COLORS.map((c) => (
            <button
              key={c.id}
              className="canvas-color-swatch"
              style={{ background: themedCanvasColor(c, 'card', 'bg'), borderColor: themedCanvasColor(c, 'card', 'border') }}
              onClick={() => onColorChange(c)}
              title={c.id}
            />
          ))}
        </div>
      )}

      {/* Footer: child badge + relative date */}
      {!isColumn && (
        <div className="canvas-card-footer">
          <div className="canvas-card-footer-left">
            {isParent && (
              <span className="canvas-card-children-badge" title="Children count">
                {childCount} {childCount === 1 ? 'child' : 'children'}
              </span>
            )}
            {isChild && !card.collapsed && (
              <span
                className="canvas-card-children-badge"
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => { e.stopPropagation(); }}
                onClick={(e) => { e.stopPropagation(); onUnparent(); }}
                title="Click to detach from parent"
              >
                ⊂ nested
              </span>
            )}
            {linkedEntry && !card.collapsed && (
              <button
                className="canvas-card-link-badge"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onLinkClick?.(); }}
                title={`Open ${linkedEntry.title || 'linked page'}`}
              >
                <Link2 size={11} /> {String(linkedEntry.title || 'Linked page').slice(0, 22)}
              </button>
            )}
          </div>
          <span>{formatRelativeTime(card.dateModified)}</span>
        </div>
      )}

      {/* Resize handle */}
      <div
        className="canvas-card-resize"
        onPointerDown={onResizeStart}
        title="Drag to resize"
      />
    </div>
  );
}

function formatAudioDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function audioBufferToWav(audioBuffer) {
  const channelCount = Math.min(2, audioBuffer.numberOfChannels);
  const sampleCount = audioBuffer.length;
  const bytesPerSample = 2;
  const dataSize = sampleCount * channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  const writeUint16 = (offset, value) => view.setUint16(offset, value, true);
  const writeUint32 = (offset, value) => view.setUint32(offset, value, true);

  writeString(0, 'RIFF');
  writeUint32(4, 36 + dataSize);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  writeUint32(16, 16);
  writeUint16(20, 1);
  writeUint16(22, channelCount);
  writeUint32(24, audioBuffer.sampleRate);
  writeUint32(28, audioBuffer.sampleRate * channelCount * bytesPerSample);
  writeUint16(32, channelCount * bytesPerSample);
  writeUint16(34, 16);
  writeString(36, 'data');
  writeUint32(40, dataSize);

  const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));
  let offset = 44;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const value = Math.max(-1, Math.min(1, channels[channel][sample] || 0));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function VoiceAudioPreview({ media, onPointerDown }) {
  const audioRef = useRef(null);
  const durationProbeRef = useRef(false);
  const [source, setSource] = useState(media.dataUrl);
  const [duration, setDuration] = useState(Number(media.duration) || 0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    setSource(media.dataUrl);
    setDuration(Number(media.duration) || 0);
    durationProbeRef.current = false;

    const preparePreviewSource = async () => {
      if (!media.dataUrl) return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      let audioContext;
      try {
        const rawBlob = await fetch(media.dataUrl).then((response) => response.blob());
        audioContext = new AudioContextClass();
        const decoded = await audioContext.decodeAudioData(await rawBlob.arrayBuffer());
        let repairedBlob = rawBlob;
        if (rawBlob.type.toLowerCase().includes('webm')) {
          try { repairedBlob = await fixWebmDuration(rawBlob, decoded.duration * 1000, { logger: false }); } catch {}
        }
        const previewBlob = rawBlob.type.toLowerCase().includes('webm') ? audioBufferToWav(decoded) : repairedBlob;
        if (cancelled) return;
        objectUrl = URL.createObjectURL(previewBlob);
        setSource(objectUrl);
        setDuration(decoded.duration);
      } catch {} finally {
        if (audioContext) void audioContext.close();
      }
    };

    void preparePreviewSource();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [media.dataUrl, media.duration]);

  const updateDuration = (event) => {
    const audio = event.currentTarget;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
      return;
    }

    // Some WebM recordings expose Infinity until the media is briefly seeked.
    if (audio.duration === Infinity && !durationProbeRef.current) {
      durationProbeRef.current = true;
      const restorePosition = () => {
        audio.currentTime = 0;
        audio.removeEventListener('timeupdate', restorePosition);
        durationProbeRef.current = false;
        if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
      };
      audio.addEventListener('timeupdate', restorePosition);
      try { audio.currentTime = Number.MAX_SAFE_INTEGER; } catch {}
    }
  };

  return (
    <div className="canvas-voice-preview">
      <audio
        ref={audioRef}
        className="canvas-media-audio"
        controls
        preload="metadata"
        src={source}
        onPointerDown={onPointerDown}
        onLoadedMetadata={updateDuration}
        onDurationChange={updateDuration}
      />
      {duration > 0 && <span className="canvas-voice-duration">Recorded {formatAudioDuration(duration)}</span>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Edge line — rotated div with dashed background-image
// ────────────────────────────────────────────────────────────
function MediaCardContent({ media, onRemove, compact = false }) {
  if (!media) return null;
  const kind = media.kind || MEDIA_KINDS.file;
  const isImage = kind === MEDIA_KINDS.image;
  const isAudio = kind === MEDIA_KINDS.audio || kind === MEDIA_KINDS.voice;
  const isVideo = kind === MEDIA_KINDS.video;
  const isPdf = kind === MEDIA_KINDS.pdf;
  const linkHost = media.url ? (() => { try { return new URL(media.url).hostname; } catch { return media.name || 'Web link'; } })() : '';
  const stop = (event) => event.stopPropagation();
  const openMedia = () => {
    if (media.url) {
      window.open(media.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (media.dataUrl) {
      const link = document.createElement('a');
      link.href = media.dataUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = media.name || 'attachment';
      link.click();
    }
  };

  return (
    <div className={`canvas-media-content ${compact ? 'compact' : ''} kind-${kind}`}>
      <div className="canvas-media-header" onPointerDown={stop}>
        <span className="canvas-media-icon">{mediaIconForKind(kind)}</span>
        <span className="canvas-media-name" title={media.name}>{media.name || 'Attached file'}</span>
        {media.size > 0 && <span className="canvas-media-size">{formatFileSize(media.size)}</span>}
        {onRemove && <button className="canvas-media-remove" onPointerDown={stop} onClick={(event) => { stop(event); onRemove(); }} title="Remove attachment">×</button>}
      </div>

      {isImage && media.dataUrl && <img className="canvas-media-image" src={media.dataUrl} alt={media.name || ''} draggable={false} onDragStart={stop} />}
      {isAudio && media.dataUrl && (kind === MEDIA_KINDS.voice
        ? <VoiceAudioPreview media={media} onPointerDown={stop} />
        : <audio className="canvas-media-audio" controls preload="metadata" src={media.dataUrl} onPointerDown={stop} />)}
      {isVideo && media.dataUrl && <video className="canvas-media-video" controls preload="metadata" src={media.dataUrl} onPointerDown={stop} />}
      {isPdf && media.dataUrl && !compact && <PdfPreview dataUrl={media.dataUrl} name={media.name} />}
      {kind === MEDIA_KINDS.document && media.textPreview && <pre className="canvas-media-text-preview">{media.textPreview}</pre>}
      {kind === MEDIA_KINDS.link && (
        <div className="canvas-media-link-preview">
          <div className="canvas-media-link-viewport" onPointerDown={stop} onWheel={stop} tabIndex={0}>
            <iframe
              className="canvas-media-link-iframe"
              src={media.url}
              title={`${linkHost || 'Website'} preview`}
              loading="lazy"
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              tabIndex={-1}
            />
          </div>
          <div className="canvas-media-link-details">
            <div className="canvas-media-link-host">{linkHost}</div>
            <div className="canvas-media-link-url">{media.url}</div>
          </div>
        </div>
      )}
      {(!isImage && !isAudio && !isVideo && (!isPdf || compact) && kind !== MEDIA_KINDS.link && !(kind === MEDIA_KINDS.document && media.textPreview)) && (
        <div className="canvas-media-file-placeholder">
          <span className="canvas-media-file-icon">{mediaIconForKind(kind)}</span>
          <span>{kind === MEDIA_KINDS.link ? 'Web link' : kind === MEDIA_KINDS.document ? 'Document attached' : 'File attached'}</span>
        </div>
      )}
      {(media.url || media.dataUrl) && (
        <button className="canvas-media-open" onPointerDown={stop} onClick={(event) => { stop(event); openMedia(); }}>
          {media.url ? 'Open link' : 'Open file'} <ExternalLink size={11} />
        </button>
      )}
    </div>
  );
}

function EdgeLine({ a, b, preview, onDelete }) {
  const aCenter = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  let start, end;
  if (preview) {
    start = getBorderPoint(a, b.x, b.y);
    end = { x: b.x, y: b.y };
  } else {
    const bCenter = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    start = getBorderPoint(a, bCenter.x, bCenter.y);
    end = getBorderPoint(b, aCenter.x, aCenter.y);
  }
  const GAP = 4;
  const sAngle = Math.atan2(end.y - start.y, end.x - start.x);
  const eAngle = Math.atan2(start.y - end.y, start.x - end.x);
  const sX = start.x + Math.cos(sAngle) * GAP;
  const sY = start.y + Math.sin(sAngle) * GAP;
  const eX = end.x + Math.cos(eAngle) * GAP;
  const eY = end.y + Math.sin(eAngle) * GAP;
  const dx = eX - sX, dy = eY - sY;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 1) return null;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <div
      className={`canvas-edge ${preview ? 'preview' : ''}`}
      style={{
        left: sX, top: sY, width: length,
        transform: `rotate(${angle}deg)`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (preview) return;
        e.stopPropagation();
        if (onDelete) onDelete();
      }}
      title={preview ? 'Connecting...' : 'Click to delete connection'}
    >
      <div className="canvas-edge-hit" />
      <div className="canvas-edge-line" style={{ width: length }} />
      <div className="canvas-edge-dot" style={{ left: 0, top: 0 }} />
      <div className="canvas-edge-dot" style={{ left: length, top: 0 }} />
    </div>
  );
}

function getBorderPoint(card, tx, ty) {
  const cx = card.x + card.w / 2;
  const cy = card.y + card.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const halfW = card.w / 2;
  const halfH = card.h / 2;
  const scaleX = dx === 0 ? Infinity : halfW / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : halfH / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}
