import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { COVERS } from '../constants/covers';

export default function CreateJournalModal({ isOpen, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [cover, setCover] = useState(COVERS[0].id);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setCover(COVERS[0].id);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(title.trim(), cover);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Journal</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="input-group">
              <label className="input-label">Journal Title</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Research Notes"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="input-group">
              <label className="input-label">Cover Color</label>
              <div className="cover-grid">
                {COVERS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`cover-option ${cover === c.id ? 'selected' : ''}`}
                    style={{ background: c.bg }}
                    onClick={() => setCover(c.id)}
                    aria-label={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
              Create Journal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
