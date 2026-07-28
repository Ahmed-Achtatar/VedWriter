import React, { useState, useEffect, useRef } from 'react';
import { Zap, X, CornerDownLeft, Sparkles } from 'lucide-react';

export default function QuickCaptureModal({ isOpen, onClose, onSaveToTemporary }) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setContent('');
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSaveToTemporary(content.trim());
      setContent('');
      onClose();
    } catch (err) {
      console.error('Failed to capture note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '520px', padding: '24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 600 }}>
            <Zap size={18} />
            <span>Quick Capture</span>
            <span style={{ fontSize: '11px', background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
              Saves to "temporary"
            </span>
          </div>
          <button className="toolbar-btn" onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          className="input"
          placeholder="Jot down a quick thought, link, or note..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={5}
          style={{
            width: '100%',
            resize: 'vertical',
            fontSize: '15px',
            lineHeight: '1.6',
            padding: '12px',
            borderRadius: 'var(--radius)',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)'
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Press <kbd style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>Ctrl + Enter</kbd> to save
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CornerDownLeft size={14} />
              Save Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
