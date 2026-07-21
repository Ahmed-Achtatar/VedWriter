import React, { useState } from 'react';
import { Plus, Search, Pin, PinOff, CheckSquare, Square, LayoutTemplate, Check, ChevronDown, ChevronRight, Book } from 'lucide-react';

const TEMPLATES = [
  { id: null, name: 'Blank page' },
  { id: 'daily', name: 'Daily reflection' },
  { id: 'study', name: 'Study notes' },
  { id: 'meeting', name: 'Meeting notes' }
];

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

  const formatPreview = (html) => {
    if (!html) return 'Empty page...';
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.slice(0, 90) + (text.length > 90 ? '...' : '');
  };

  const formatDate = (ts) => ts ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

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
    return (
      <div key={entry.id}
        className={`page-item ${activeEntry?.id === entry.id && !bulkMode ? 'active' : ''} ${isSelected ? 'selected' : ''} ${draggedIndex === i ? 'dragging' : ''}`}
        draggable={!bulkMode}
        onDragStart={() => handleDragStart(i)}
        onDragOver={(e) => handleDragOver(e, i)}
        onDragEnd={handleDragEnd}
        onClick={() => handleItemClick(entry)}
      >
        {isSelected && <div className="selected-badge" aria-hidden="true"><Check size={14} /></div>}
        <Book size={16} className="page-item-icon" />
        <div className="page-item-content">
          <div className="page-item-header">
            <span className="page-item-title">{entry.title || 'Untitled Page'}</span>
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
                <div className="template-menu" onClick={() => setShowTemplateMenu(false)}>
                  {TEMPLATES.map(t => (
                    <button key={t.id || 'blank'} className="template-option"
                      onClick={() => onCreateEntry(t.id)}>
                      <span>{t.name}</span>
                    </button>
                  ))}
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
              <span className="empty-prompt" onClick={() => onCreateEntry('daily')}>Daily reflection</span>
              <span className="empty-prompt" onClick={() => onCreateEntry('study')}>Study notes</span>
              <span className="empty-prompt" onClick={() => onCreateEntry(null)}>Blank page</span>
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
