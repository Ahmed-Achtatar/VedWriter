import React from 'react';
import { COVERS } from '../constants/covers';

export default function JournalCard({ title, coverType, entryCount = 0, onClick }) {
  const cover = COVERS.find(c => c.id === coverType) || COVERS[0];

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
