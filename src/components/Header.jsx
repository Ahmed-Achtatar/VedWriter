import React, { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronLeft, Palette, Menu, PanelRightOpen, X, MessageCircle } from 'lucide-react';
import { THEMES, loadTheme, setTheme } from '../theme';

export default function Header({
  variant = 'dashboard',
  onBack,
  journalTitle,
  onBackup,
  onLock,
  onDeleteJournal,
  mobileMenuOpen,
  onToggleMobileMenu,
  showBackup = true,
  onToggleEdgeWidget,
  onContactDeveloper
}) {
  const [currentTheme, setCurrentTheme] = useState(loadTheme());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleThemeChange = (themeId) => {
    setTheme(themeId);
    setCurrentTheme(themeId);
    setMenuOpen(false);
  };

  const themeInfo = THEMES[currentTheme] || THEMES.paper;

  return (
    <header className="header">
      <div className="header-left">
        {variant === 'workspace' && onBack && (
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            <ChevronLeft size={16} />
            Back
          </button>
        )}

        {variant === 'dashboard' ? (
          <div className="logo">VedWriter</div>
        ) : (
          <div className="header-title">
            <small>Journal</small>
            <span>{journalTitle || 'Untitled Journal'}</span>
          </div>
        )}
      </div>

      <div className="header-right">
        {variant === 'workspace' && onToggleMobileMenu && (
          <button
            className="btn btn-ghost btn-sm mobile-menu-toggle"
            onClick={onToggleMobileMenu}
            aria-label="Toggle page list"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        )}

        {onToggleEdgeWidget && (
          <button
            className="btn btn-secondary btn-sm header-edge-widget"
            onClick={onToggleEdgeWidget}
            title="Open side panel"
            aria-label="Open side panel"
          >
            <PanelRightOpen size={15} />
            <span>Side panel</span>
          </button>
        )}

        <div className="theme-picker" ref={menuRef}>
          <button
            className="theme-trigger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Change theme"
          >
            <Palette size={14} />
            <span className="theme-dot" style={{ background: themeInfo.dot }} />
            <span style={{ fontSize: '13px' }}>{themeInfo.name}</span>
          </button>

          {menuOpen && (
            <div className="theme-menu">
              {Object.entries(THEMES).map(([id, theme]) => (
                <button
                  key={id}
                  className={`theme-option ${currentTheme === id ? 'active' : ''}`}
                  onClick={() => handleThemeChange(id)}
                  type="button"
                  aria-pressed={currentTheme === id}
                >
                  <span className="theme-dot" style={{ background: theme.dot }} />
                  <span>{theme.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {showBackup && onBackup && (
          <button className="btn btn-secondary btn-sm header-backup" onClick={onBackup} aria-label="Backup and restore">
            Backup / Restore
          </button>
        )}

        {onContactDeveloper && (
          <button
            className="btn btn-secondary btn-sm header-contact-developer"
            onClick={onContactDeveloper}
            title="Contact developer"
            aria-label="Contact developer"
          >
            <MessageCircle size={15} />
            <span>Contact developer</span>
          </button>
        )}


        {variant === 'workspace' && onDeleteJournal && (
            <button className="btn btn-danger btn-sm header-delete" onClick={onDeleteJournal} title="Delete this journal and all its pages">
            Delete Journal
          </button>
        )}

        <button className="btn btn-secondary btn-sm header-lock" onClick={onLock} title="Lock app" aria-label="Lock app">
          <LogOut size={16} />
          Lock
        </button>
      </div>
    </header>
  );
}
