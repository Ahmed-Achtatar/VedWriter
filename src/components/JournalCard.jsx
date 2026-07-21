import React from 'react';
import { COVERS } from '../constants/covers';

export default function JournalCard({ title, coverType, entryCount = 0, dateModified, onClick }) {
  const cover = COVERS.find(c => c.id === coverType) || COVERS[0];

  const formatDate = (timestamp) => {
    if (!timestamp) return 'No entries yet';
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Updated today';
    if (diffDays === 1) return 'Updated yesterday';
    if (diffDays < 7) return `Updated ${diffDays} days ago`;
    if (diffDays < 30) return `Updated ${Math.floor(diffDays / 7)} weeks ago`;
    return `Updated ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  };

  return (
    <div className="book-card animate-scale-up" onClick={onClick} role="button" tabIndex={0}>
      <div className="book-spine" style={{ background: cover.bg }} aria-hidden="true" />
      <div className="book-cover" style={{ background: cover.bg }}>
        <div className="book-pages" aria-hidden="true" />
        <div className="book-cover-inner" style={{ color: cover.text }}>
          <span className="book-title">{title || 'Untitled'}</span>
          <span className="book-subtitle">{entryCount} {entryCount === 1 ? 'entry' : 'entries'}</span>
        </div>
      </div>
    </div>
  );
}
