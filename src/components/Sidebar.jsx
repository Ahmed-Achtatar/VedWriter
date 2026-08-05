import React, { useState } from 'react';
import { Plus, Search, Pin, PinOff, CheckSquare, Square, LayoutTemplate, Check, ChevronDown, ChevronRight, Book, StickyNote, GitBranch, Columns3, Image as ImageIcon, Pencil, Network } from 'lucide-react';

const PAGE_TEMPLATES = [
  { id: null, name: 'Blank page', icon: 'file' },
  { id: 'daily', name: 'Daily reflection', icon: 'sun' },
  { id: 'study', name: 'Study notes', icon: 'book' },
  { id: 'meeting', name: 'Meeting notes', icon: 'users' }
];

const CANVAS_TEMPLATES = [
  { id: 'sticky', name: 'Sticky Notes', desc: 'Brainstorm on a 2D board', icon: 'sticky' },
  { id: 'mindmap', name: 'Mind Map', desc: 'Connected ideas & branches', icon: 'mindmap' },
  { id: 'kanban', name: 'Kanban Board', desc: 'Columns of cards to organize', icon: 'kanban' },
  { id: 'moodboard', name: 'Moodboard', desc: 'Visual collection of cards', icon: 'moodboard' },
  { id: 'whiteboard', name: 'Whiteboard', desc: 'Freeform blank canvas', icon: 'whiteboard' }
];

const TEMPLATE_ICONS = {
  sticky: StickyNote,
  mindmap: GitBranch,
  kanban: Columns3,
  moodboard: ImageIcon,
  whiteboard: Pencil
};

const isToday = (ts) => {
  if (!ts) return false;
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

const isThisWeek = (ts) => {
  if (!ts) return false;
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff < 7;
};

export default function Sidebar({
  entries,
  activeEntry,
  searchQuery,
  onSearchChange,
  onSelectEntry,
  onCreateEntry,
  mobileOpen = false,
  pinnedEntries = [],
  onTogglePin,
  onReorderEntries,
  onBulkDelete,
  loading = false
}) {
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [groupsOpen, setGroupsOpen] = useState({ pinned: true, today: true, week: true });

  // Group entries
  const grouped = React.useMemo(() => {
    const pinned = [];
    const today = [];
    const week = [];
    const older = [];
    entries.forEach((e) => {
      if (pinnedEntries.includes(e.id)) pinned.push(e);
      else if (isToday(e.dateModified || e.dateCreated)) today.push(e);
      else if (isThisWeek(e.dateModified || e.dateCreated)) week.push(e);
      else older.push(e);
    });
    return { pinned, today, week, older };
  }, [entries, pinnedEntries]);

  const flatGrouped = [
    ...grouped.pinned,
    ...grouped.today,
    ...grouped.week,
    ...grouped.older,
  ];

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    setSelectedIds([]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === flatGrouped.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(flatGrouped.map(e => e.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} page(s)? This cannot be undone.`)) return;
    if (onBulkDelete) onBulkDelete(selectedIds);
    setBulkMode(false);
    setSelectedIds([]);
  };

  // Drag-drop
  const handleDragStart = (index) => { setDraggedIndex(index); };
  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const reordered = [...flatGrouped];
    const [item] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, item);
    onReorderEntries(reordered);
    setDraggedIndex(index);
  };
  const handleDragEnd = () => { setDraggedIndex(null); };

  const handleItemClick = (entry) => {
    if (bulkMode) toggleSelect(entry.id);
    else onSelectEntry(entry);
  };

  const renderItem = (entry, i) => {
    const isSelected = selectedIds.includes(entry.id);
    const isCanvas = entry.entryType === 'canvas';
    const canvasTpl = isCanvas ? entry.canvasTemplate : null;
    const CanvasIcon = canvasTpl && TEMPLATE_ICONS[canvasTpl] ? TEMPLATE_ICONS[canvasTpl] : Network;
    return (
      <div key={entry.id}
        className={`page-item ${activeEntry?.id === entry.id && !bulkMode ? 'active' : ''} ${isSelected ? 'selected' : ''} ${draggedIndex === i ? 'dragging' : ''} ${isCanvas ? 'is-canvas' : ''}`}
        draggable={!bulkMode}
        onDragStart={() => handleDragStart(i)}
        onDragOver={(e) => handleDragOver(e, i)}
        onDragEnd={handleDragEnd}
        onClick={() => handleItemClick(entry)}
      >
        {isSelected && <div className="selected-badge" aria-hidden="true"><Check size={14} /></div>}
        {isCanvas
          ? <CanvasIcon size={16} className="page-item-icon" style={{ color: 'var(--accent)' }} />
          : <Book size={16} className="page-item-icon" />
        }
        <div className="page-item-content">
          <div className="page-item-header">
            <span className="page-item-title">{entry.title || (isCanvas ? 'Untitled Canvas' : 'Untitled Page')}</span>
            {isCanvas && <span className="canvas-badge" title={`Canvas · ${canvasTpl || 'whiteboard'}`}>{canvasTpl || 'canvas'}</span>}
            {!bulkMode && onTogglePin && (
              <button className="pin-btn" onClick={(e) => { e.stopPropagation(); onTogglePin(entry.id); }}
                title={pinnedEntries.includes(entry.id) ? 'Unpin' : 'Pin'}>
                {pinnedEntries.includes(entry.id)
                  ? <Pin size={12} style={{ color: 'var(--accent)' }} />
                  : <PinOff size={12} style={{ color: 'var(--text-muted)' }} />}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGroup = (label, list, groupKey) => {
    if (list.length === 0) return null;
    const isOpen = groupsOpen[groupKey];
    return (
      <div className="sidebar-group">
        <div className="sidebar-group-header" onClick={() => setGroupsOpen({ ...groupsOpen, [groupKey]: !isOpen })}>
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span>{label} ({list.length})</span>
        </div>
        {isOpen && <div className="sidebar-group-items">{list.map((entry) => renderItem(entry, flatGrouped.indexOf(entry)))}</div>}
      </div>
    );
  };

  return (
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h3>Pages ({entries.length})</h3>
        <div style={{ display: 'flex', gap: '6px' }}>
          {entries.length > 0 && (
            <button className={`btn btn-ghost btn-sm ${bulkMode ? 'active' : ''}`} onClick={toggleBulkMode} title="Bulk select">
              {bulkMode ? <CheckSquare size={14} /> : <Square size={14} />}
            </button>
          )}
          {bulkMode ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={handleSelectAll} title="Select all">
                {selectedIds.length === flatGrouped.length ? 'None' : 'All'}
              </button>
              {selectedIds.length > 0 && (
                <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
                  Delete ({selectedIds.length})
                </button>
              )}
            </>
          ) : (
            <div style={{ position: 'relative' }}>
              <button className="btn btn-primary btn-sm"
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                style={{ gap: '4px' }}
              >
                <Plus size={14} />
                <LayoutTemplate size={12} />
              </button>
              {showTemplateMenu && (
                <div className="template-menu" onClick={() => setShowTemplateMenu(false)} style={{ minWidth: '240px' }}>
                  <div className="template-section-label">Pages</div>
                  {PAGE_TEMPLATES.map(t => (
                    <button key={'p-' + (t.id || 'blank')} className="template-option"
                      onClick={() => onCreateEntry({ entryType: 'page', templateId: t.id })}>
                      <span className="template-option-name">{t.name}</span>
                    </button>
                  ))}
                  <div className="template-divider" />
                  <div className="template-section-label">Canvas</div>
                  {CANVAS_TEMPLATES.map(t => {
                    const Icon = TEMPLATE_ICONS[t.id];
                    return (
                      <button key={'c-' + t.id} className="template-option template-option-canvas"
                        onClick={() => onCreateEntry({ entryType: 'canvas', canvasTemplate: t.id })}>
                        <Icon size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px' }}>
                          <span className="template-option-name">{t.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input type="text" className="input" placeholder="Search pages... (Ctrl+K for journals)"
          value={searchQuery} onChange={e => onSearchChange(e.target.value)}
          style={{ paddingLeft: '34px', fontSize: '13px', paddingTop: '10px', paddingBottom: '10px' }} />
      </div>

      <div className="page-list">
        {loading ? (
          <div className="sidebar-skeleton">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-item">
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-text" />
                <div className="skeleton-line skeleton-meta" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-sidebar">
            <p style={{ fontSize: '13px', marginBottom: '4px' }}>No pages yet.</p>
            <p style={{ fontSize: '12px' }}>
              <span className="empty-prompt" onClick={() => onCreateEntry({ entryType: 'page', templateId: 'daily' })}>Daily</span>
              <span className="empty-prompt" onClick={() => onCreateEntry({ entryType: 'page', templateId: 'study' })}>Study</span>
              <span className="empty-prompt" onClick={() => onCreateEntry({ entryType: 'page', templateId: null })}>Blank</span>
              <span className="empty-prompt" onClick={() => onCreateEntry({ entryType: 'canvas', canvasTemplate: 'sticky' })}>Sticky</span>
              <span className="empty-prompt" onClick={() => onCreateEntry({ entryType: 'canvas', canvasTemplate: 'mindmap' })}>Mind Map</span>
            </p>
          </div>
        ) : (
          <>
            {renderGroup('📌 Pinned', grouped.pinned, 'pinned')}
            {renderGroup('📅 Today', grouped.today, 'today')}
            {renderGroup('📆 This week', grouped.week, 'week')}
            {renderGroup('Older', grouped.older, 'older')}
          </>
        )}
      </div>
    </aside>
  );
}
