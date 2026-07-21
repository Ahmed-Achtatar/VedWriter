import React, { useRef, useEffect, useState } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, FileDown, Trash2, Calendar, BookOpen, Tag,
  Undo2, Redo2, Maximize2, Minimize2, ListTree, Search, X,
  Plus, Minus, Target, ChevronUp, ChevronDown
} from 'lucide-react';

// Writing prompts for blank pages
const WRITING_PROMPTS = [
  'What did you learn today?',
  'Something I want to remember...',
  'Three things I\'m grateful for.',
  'What challenged me today?',
  'Ideas worth exploring...',
  'How am I feeling right now?',
  'One thing I\'d change about today.',
  'A conversation that made me think.',
  'What I\'m working towards.',
  'Notes from what I read today...'
];

// Auto-pair characters: opening -> closing
const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`', '*': '*', '_': '_' };

// Built-in snippets: trigger -> expansion
const SNIPPETS = {
  ';date': () => new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  ';shortdate': () => new Date().toLocaleDateString(),
  ';time': () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  ';now': () => new Date().toString(),
  ';todo': () => '- [ ] ',
  ';signature': () => '\n\n— ',
};

export default function Editor({
  entry,
  onSave,
  onDelete,
  onExport
}) {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [, setCharCount] = useState(0);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showFocusHint, setShowFocusHint] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [showToc, setShowToc] = useState(false);
  const [headings, setHeadings] = useState([]);

  // font size, find/replace, word goal
  const [fontSize, setFontSize] = useState('medium'); // small | medium | large
  const [showFind, setShowFind] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findIndex, setFindIndex] = useState(0);
  const [findCount, setFindCount] = useState(0);
  const [replaceValue, setReplaceValue] = useState('');
  const [wordGoal, setWordGoal] = useState(0);
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  const editorRef = useRef(null);
  const lastBodyRef = useRef('');
  const lastEntryIdRef = useRef(null);
  const saveTimerRef = useRef(null);
  const historyRef = useRef({ stack: [], index: -1, maxSize: 100 });

  // Sync from props only when switching entries
  useEffect(() => {
    if (!entry) {
      setTitle('');
      setTags([]);
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
        lastBodyRef.current = '';
      }
      setWordCount(0);
      setCharCount(0);
      lastEntryIdRef.current = null;
      setLastSavedAt(null);
      setIsFocusMode(false);
      setWordGoal(0);
      return;
    }

    if (entry.id !== lastEntryIdRef.current) {
      setTitle(entry.title || '');
      setTags(entry.tags || []);
      const newBody = entry.body || '';
      if (editorRef.current) {
        editorRef.current.innerHTML = newBody;
        lastBodyRef.current = newBody;
      }
      lastEntryIdRef.current = entry.id;
      calculateCounts(newBody);
      updateHeadings();
      setLastSavedAt(null);
      setIsFocusMode(false);
      setWordGoal(entry.wordGoal || 0);
    }
  }, [entry]);

  useEffect(() => {
    if (isFocusMode) {
      document.body.classList.add('focus-mode-active');
    } else {
      document.body.classList.remove('focus-mode-active');
    }
    return () => document.body.classList.remove('focus-mode-active');
  }, [isFocusMode]);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateCounts = (html) => {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ').length : 0;
    setWordCount(words);
    setCharCount(text.length);
  };

  const updateHeadings = () => {
    if (!editorRef.current) return;
    const hTags = editorRef.current.querySelectorAll('h1, h2, h3, h4');
    const hs = [];
    hTags.forEach((h, i) => {
      hs.push({
        id: `toc-${i}`,
        level: parseInt(h.tagName.slice(1)),
        text: h.textContent.slice(0, 50)
      });
    });
    setHeadings(hs);
  };

  const buildUpdatedEntry = (overrides = {}) => ({
    ...entry,
    title,
    tags,
    body: editorRef.current ? editorRef.current.innerHTML : '',
    wordGoal,
    dateModified: Date.now(),
    ...overrides
  });

  const handleSave = (overrides = {}) => {
    if (!entry) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const updated = buildUpdatedEntry(overrides);
      onSave(updated);
      setLastSavedAt(Date.now());
    }, 800);
  };

  const handleSaveImmediate = (overrides = {}) => {
    if (!entry) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const updated = buildUpdatedEntry(overrides);
    onSave(updated);
    setLastSavedAt(Date.now());
  };

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    handleSave({ title: newTitle });
  };

  // Handle input: auto-pair, snippets, and regular text
  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    lastBodyRef.current = html;
    calculateCounts(html);
    handleSave({ body: html });
    const { stack, index } = historyRef.current;
    const last = index >= 0 ? stack[index] : '';
    if (html !== last) pushHistory();
    updateHeadings();
  };

  // Detect auto-pair on key press (before the character is inserted)
  const handleKeyDownForPairs = (e) => {
    // Auto-pair: if user types opening bracket/quote, insert closing after cursor
    if (PAIRS[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
        // Don't auto-pair if there's a selection (user is selecting text)
        if (sel.isCollapsed) {
          e.preventDefault();
          const opening = e.key;
          const closing = PAIRS[opening];
          document.execCommand('insertText', false, opening + closing);
          // Move cursor between the pair
          const sel2 = window.getSelection();
          if (sel2.rangeCount) {
            const range = sel2.getRangeAt(0);
            range.setStart(range.startContainer, range.startOffset - 1);
            range.collapse(true);
            sel2.removeAllRanges();
            sel2.addRange(range);
          }
          return;
        }
      }
    }

    // Skip-over: if cursor is between a pair and user types the closing char, just move past it
    if (Object.values(PAIRS).includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        const offset = range.startOffset;
        if (node.nodeType === 3 && offset < node.textContent.length) {
          const nextChar = node.textContent[offset];
          if (nextChar === e.key) {
            e.preventDefault();
            range.setStart(node, offset + 1);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
          }
        }
      }
    }
  };

  // Detect snippets: check if user just typed a snippet trigger
  const checkForSnippets = () => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3) return;

    const text = node.textContent;
    const offset = sel.anchorOffset;

    // Find the start of the current word
    let wordStart = offset;
    while (wordStart > 0 && /[a-zA-Z0-9;]/.test(text[wordStart - 1])) {
      wordStart--;
    }
    const typed = text.substring(wordStart, offset);

    for (const [trigger, expand] of Object.entries(SNIPPETS)) {
      if (typed === trigger || typed.endsWith(trigger)) {
        // Replace the trigger with the expansion
        const value = expand();
        const before = text.substring(0, wordStart);
        const after = text.substring(offset);
        node.textContent = before + value + after;
        // Place cursor after the expansion
        const newOffset = before.length + value.length;
        const range = document.createRange();
        range.setStart(node, newOffset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        handleEditorInput();
        return;
      }
    }
  };

  const pushHistory = () => {
    if (!editorRef.current) return;
    const { stack, index, maxSize } = historyRef.current;
    const html = editorRef.current.innerHTML;
    const newStack = stack.slice(0, index + 1);
    newStack.push(html);
    if (newStack.length > maxSize) newStack.shift();
    historyRef.current = { stack: newStack, index: newStack.length - 1, maxSize };
  };

  const handleUndo = () => {
    if (!editorRef.current) return;
    const { stack, index } = historyRef.current;
    if (index < 0) return;
    const target = index - 1;
    const html = target >= 0 ? stack[target] : '';
    editorRef.current.innerHTML = html;
    historyRef.current = { ...historyRef.current, index: Math.max(-1, target) };
    lastBodyRef.current = html;
    handleSaveImmediate({ body: html });
    updateHeadings();
  };

  const handleRedo = () => {
    if (!editorRef.current) return;
    const { stack, index } = historyRef.current;
    if (index >= stack.length - 1) return;
    const target = index + 1;
    editorRef.current.innerHTML = stack[target];
    historyRef.current = { ...historyRef.current, index: target };
    lastBodyRef.current = stack[target];
    handleSaveImmediate({ body: stack[target] });
    updateHeadings();
  };

  // Markdown block detection (existing logic)
  const BLOCK_TAGS = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'LI', 'PRE']);

  const MD_PATTERNS = [
    { re: /^###[ \u00A0]$/, tag: 'h3' },
    { re: /^##[ \u00A0]$/, tag: 'h2' },
    { re: /^#[ \u00A0]$/, tag: 'h1' },
    { re: /^-[ \u00A0]$/, tag: 'ul' },
    { re: /^\*[ \u00A0]$/, tag: 'ul' },
    { re: /^>[ \u00A0]$/, tag: 'blockquote' },
    { re: /^\d+\.[ \u00A0]$/, tag: 'ol' },
  ];

  const handleMarkdownDetection = () => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const node = sel.anchorNode;
      if (node && editorRef.current.contains(node)) {
        let block = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
        while (block && block !== editorRef.current && !BLOCK_TAGS.has(block.nodeName)) {
          block = block.parentNode;
        }
        if (block === editorRef.current && node.nodeType === Node.TEXT_NODE) {
          const wrapper = document.createElement('div');
          node.replaceWith(wrapper);
          wrapper.appendChild(node);
          block = wrapper;
          const r = document.createRange();
          r.selectNodeContents(node);
          r.collapse(false);
          sel.removeAllRanges();
          sel.addRange(r);
        }
        if (block && block !== editorRef.current) {
          const text = block.textContent;
          for (const { re, tag } of MD_PATTERNS) {
            if (re.test(text)) {
              const range = document.createRange();
              range.selectNodeContents(block);
              sel.removeAllRanges();
              sel.addRange(range);
              document.execCommand('delete', false, null);
              if (tag === 'ul' || tag === 'ol') {
                document.execCommand(tag === 'ul' ? 'insertUnorderedList' : 'insertOrderedList', false, null);
              } else {
                document.execCommand('formatBlock', false, `<${tag}>`);
              }
              handleEditorInput();
              return;
            }
          }
        }
      }
    }
    handleEditorInput();
  };

  // Find & Replace
  const performFind = (direction = 1) => {
    if (!editorRef.current || !findQuery) return;
    const body = editorRef.current.innerText;
    const matches = [];
    let idx = body.toLowerCase().indexOf(findQuery.toLowerCase());
    while (idx !== -1) {
      matches.push(idx);
      idx = body.toLowerCase().indexOf(findQuery.toLowerCase(), idx + 1);
    }
    setFindCount(matches.length);
    if (matches.length === 0) {
      setFindIndex(0);
      return;
    }
    let next = findIndex + direction;
    if (next < 0) next = matches.length - 1;
    if (next >= matches.length) next = 0;
    setFindIndex(next);

    // Select the match in the editor
    const range = document.createRange();
    const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
    let charCount = 0;
    let startNode, endNode, startOffset, endOffset;
    let targetStart = matches[next];
    let targetEnd = matches[next] + findQuery.length;
    let found = false;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const len = node.textContent.length;
      if (!found && charCount + len >= targetStart) {
        startNode = node;
        startOffset = targetStart - charCount;
        found = true;
      }
      if (found && charCount + len >= targetEnd) {
        endNode = node;
        endOffset = targetEnd - charCount;
        break;
      }
      charCount += len;
    }
    if (startNode && endNode) {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      // Scroll into view
      startNode.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const handleReplace = () => {
    if (!editorRef.current || !findQuery) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const selectedText = range.toString();
      if (selectedText.toLowerCase() === findQuery.toLowerCase()) {
        // Replace the selected text
        range.deleteContents();
        const textNode = document.createTextNode(replaceValue);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        handleEditorInput();
      }
    }
    // Find next
    setTimeout(() => performFind(1), 50);
  };

  const handleReplaceAll = () => {
    if (!editorRef.current || !findQuery) return;
    const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    let total = 0;
    textNodes.forEach(node => {
      const regex = new RegExp(escapeRegex(findQuery), 'gi');
      const matches = node.textContent.match(regex);
      if (matches) {
        total += matches.length;
        node.textContent = node.textContent.replace(regex, replaceValue);
      }
    });
    handleEditorInput();
    setFindCount(0);
    setFindIndex(0);
    if (total > 0) {
      // Could show toast here
    }
  };

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Format button click (prevents focus loss)
  const handleFormat = (command, value = null) => {
    if (editorRef.current) editorRef.current.focus();
    document.execCommand(command, false, value);
    pushHistory();
    handleEditorInput();
  };

  const toolbarMouseDown = (e) => { e.preventDefault(); };

  // Keyboard shortcuts
  const handleEditorKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;

    // Markdown: intercept Space at start of block
    if (e.key === ' ' && !mod) {
      // ... markdown detection logic (unchanged)
    }

    if (mod) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); handleFormat('bold'); return;
        case 'i': e.preventDefault(); handleFormat('italic'); return;
        case 'u': e.preventDefault(); handleFormat('underline'); return;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) handleRedo(); else handleUndo();
          return;
        case 'y': e.preventDefault(); handleRedo(); return;
        case 's': e.preventDefault(); handleSaveImmediate(); return;
        case 'h': e.preventDefault(); setShowFind(!showFind); return;
        default: break;
      }
    }

    if (e.key === 'Escape' && isFocusMode) {
      setIsFocusMode(false);
      setShowFocusHint(false);
    }
  };

  const handleKeyUp = (e) => {
    if (e.key === ' ' || e.key === 'Spacebar') {
      handleMarkdownDetection();
    }
  };

  // Combined input handler: snippets + auto-detect
  const handleInput = () => {
    handleEditorInput();
    checkForSnippets();
  };

  // Combined keydown: shortcuts + markdown + auto-pair
  const handleCombinedKeyDown = (e) => {
    handleKeyDownForPairs(e);
    handleEditorKeyDown(e);
  };

  // Tags
  const handleTagAdd = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        const updatedTags = [...tags, newTag];
        setTags(updatedTags);
        handleSaveImmediate({ tags: updatedTags });
      }
      setTagInput('');
    }
  };

  const handleTagRemove = (tagToRemove) => {
    const updatedTags = tags.filter((t) => t !== tagToRemove);
    setTags(updatedTags);
    handleSaveImmediate({ tags: updatedTags });
  };

  const toggleFocusMode = () => {
    if (!isFocusMode) {
      setIsFocusMode(true);
      setShowFocusHint(true);
      setTimeout(() => setShowFocusHint(false), 3500);
    } else {
      setIsFocusMode(false);
      setShowFocusHint(false);
    }
  };

  const getTimeAgo = () => {
    if (!lastSavedAt) return null;
    const diff = Math.floor((Date.now() - lastSavedAt) / 1000);
    if (diff < 2) return 'Saved just now';
    if (diff < 5) return `Saved ${diff}s ago`;
    return `Saved ${Math.floor(diff / 5) * 5}s ago`;
  };

  const scrollToHeading = (headingEl) => {
    const hs = editorRef.current.querySelectorAll('h1, h2, h3, h4');
    const idx = headings.indexOf(headingEl);
    if (idx >= 0 && idx < hs.length) {
      hs[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Word goal
  const handleSetGoal = () => {
    const n = parseInt(goalInput, 10);
    if (!isNaN(n) && n >= 0) {
      setWordGoal(n);
      handleSaveImmediate({ wordGoal: n });
    }
    setShowGoalInput(false);
    setGoalInput('');
  };

  if (!entry) {
    return (
      <main className="editor-area">
        <div className="no-entry">
          <div style={{ textAlign: 'center' }}>
            <BookOpen size={48} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No page selected</h3>
            <p style={{ fontSize: '14px' }}>Select a page from the sidebar or create a new one to start writing.</p>
          </div>
        </div>
      </main>
    );
  }

  const isNewEntry = !entry.title || (entry.title === 'Untitled Page' && !entry.body && entry.tags?.length === 0);
  const prompt = WRITING_PROMPTS[Math.floor(Math.random() * WRITING_PROMPTS.length)];

  return (
    <main className={`editor-area ${isFocusMode ? 'focus-mode' : ''}`} tabIndex={-1}>
      {/* Focus mode escape hint */}
      {isFocusMode && (
        <div className={`focus-hint ${showFocusHint ? 'visible' : ''}`}>
          <kbd className="kbd">Esc</kbd>
          <span>to exit focus mode</span>
        </div>
      )}

      {/* Find & Replace panel */}
      {showFind && (
        <div className="find-replace-panel">
          <div className="find-replace-row">
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              placeholder="Find in page..."
              value={findQuery}
              onChange={(e) => { setFindQuery(e.target.value); setFindIndex(0); }}
              onKeyDown={(e) => { if (e.key === 'Enter') performFind(e.shiftKey ? -1 : 1); }}
              style={{ padding: '6px 10px', fontSize: '13px' }}
              autoFocus
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '60px' }}>
              {findQuery ? `${findCount > 0 ? findIndex + 1 : 0}/${findCount}` : ''}
            </span>
            <button className="toolbar-btn" onClick={() => performFind(-1)} title="Previous (Shift+Enter)">
              <ChevronUp size={14} />
            </button>
            <button className="toolbar-btn" onClick={() => performFind(1)} title="Next (Enter)">
              <ChevronDown size={14} />
            </button>
            <button className="toolbar-btn" onClick={() => { setShowFind(false); setFindQuery(''); editorRef.current?.focus(); }} title="Close (Esc)">
              <X size={14} />
            </button>
          </div>
          <div className="find-replace-row">
            <input
              type="text"
              className="input"
              placeholder="Replace with..."
              value={replaceValue}
              onChange={(e) => setReplaceValue(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px' }}
            />
            <button className="btn btn-secondary btn-sm" onClick={handleReplace} disabled={!findQuery}>Replace</button>
            <button className="btn btn-secondary btn-sm" onClick={handleReplaceAll} disabled={!findQuery}>All</button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button className="toolbar-btn" onMouseDown={toolbarMouseDown} onClick={handleUndo} title="Undo (Ctrl+Z)">
            <Undo2 size={16} />
          </button>
          <button className="toolbar-btn" onMouseDown={toolbarMouseDown} onClick={handleRedo} title="Redo (Ctrl+Y)">
            <Redo2 size={16} />
          </button>
          <div className="toolbar-divider" />
          <button className="toolbar-btn" onMouseDown={toolbarMouseDown} onClick={() => handleFormat('bold')} title="Bold (Ctrl+B)">
            <Bold size={16} />
          </button>
          <button className="toolbar-btn" onMouseDown={toolbarMouseDown} onClick={() => handleFormat('italic')} title="Italic (Ctrl+I)">
            <Italic size={16} />
          </button>
          <button className="toolbar-btn" onMouseDown={toolbarMouseDown} onClick={() => handleFormat('underline')} title="Underline (Ctrl+U)">
            <Underline size={16} />
          </button>
          <div className="toolbar-divider" />
          <button className="toolbar-btn" onMouseDown={toolbarMouseDown} onClick={() => handleFormat('justifyLeft')} title="Align left">
            <AlignLeft size={16} />
          </button>
          <button className="toolbar-btn" onMouseDown={toolbarMouseDown} onClick={() => handleFormat('justifyCenter')} title="Align center">
            <AlignCenter size={16} />
          </button>
          <button className="toolbar-btn" onMouseDown={toolbarMouseDown} onClick={() => handleFormat('justifyRight')} title="Align right">
            <AlignRight size={16} />
          </button>
          <div className="toolbar-divider" />
          <button className="toolbar-btn" onMouseDown={toolbarMouseDown} onClick={() => handleFormat('insertUnorderedList')} title="Bullet list">
            <List size={16} />
          </button>
          <button className="toolbar-btn" onMouseDown={toolbarMouseDown} onClick={() => handleFormat('insertOrderedList')} title="Numbered list">
            <ListOrdered size={16} />
          </button>
        </div>

        <div className="toolbar-group">
          {/* Font size */}
          <div className="font-size-control">
            <button className="toolbar-btn" onClick={() => setFontSize('small')} title="Small text" style={{ opacity: fontSize === 'small' ? 1 : 0.5 }}>
              <Minus size={14} />
            </button>
            <button className="toolbar-btn" onClick={() => setFontSize('medium')} title="Medium text" style={{ opacity: fontSize === 'medium' ? 1 : 0.5 }}>
              <span style={{ fontSize: '11px', fontWeight: 600 }}>A</span>
            </button>
            <button className="toolbar-btn" onClick={() => setFontSize('large')} title="Large text" style={{ opacity: fontSize === 'large' ? 1 : 0.5 }}>
              <Plus size={14} />
            </button>
          </div>
          <div className="toolbar-divider" />

          {/* Find */}
          <button className={`toolbar-btn ${showFind ? 'active' : ''}`} onClick={() => { setShowFind(!showFind); setTimeout(() => performFind(1), 100); }} title="Find & Replace (Ctrl+H)">
            <Search size={16} />
          </button>

          {headings.length > 0 && (
            <>
              <button className={`toolbar-btn ${showToc ? 'active' : ''}`} onClick={() => setShowToc(!showToc)} title="Table of contents">
                <ListTree size={16} />
              </button>
              <div className="toolbar-divider" />
            </>
          )}

          <button className="toolbar-btn" onClick={toggleFocusMode} title={isFocusMode ? 'Exit focus mode (Esc)' : 'Focus mode'}>
            {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button className="toolbar-btn" onClick={onExport} title="Export options">
            <FileDown size={16} />
          </button>
          <button className="toolbar-btn" style={{ color: '#ef4444' }} onClick={() => onDelete(entry.id)} title="Delete this page">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* TOC panel */}
      {showToc && headings.length > 0 && (
        <div className="toc-panel">
          <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            On this page
          </h4>
          {headings.map((h, i) => (
            <div key={h.id || i} className="toc-item" style={{ paddingLeft: `${(h.level - 1) * 12}px` }} onClick={() => scrollToHeading(h)}>
              {h.text || `Heading ${i + 1}`}
            </div>
          ))}
        </div>
      )}

      {/* Paper */}
      <div className="paper" onKeyDown={handleCombinedKeyDown} onKeyUp={handleKeyUp}>
        <input
          type="text"
          className="paper-title"
          placeholder="Title this page..."
          value={title}
          onChange={handleTitleChange}
        />

        <div className="paper-meta">
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={13} />
            {formatDate(entry.dateCreated)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Word count with goal progress */}
            <span style={{ cursor: 'pointer' }} onClick={() => { setShowGoalInput(!showGoalInput); setGoalInput(String(wordGoal || '')); }} title="Click to set word goal">
              {wordCount} words {wordGoal > 0 && (
                <span style={{ color: wordCount >= wordGoal ? '#10b981' : 'var(--text-muted)', marginLeft: '4px' }}>
                  / {wordGoal} {wordCount >= wordGoal && '✓'}
                </span>
              )}
            </span>
            {lastSavedAt && (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{getTimeAgo()}</span>
            )}
          </span>
        </div>

        {/* Word goal input */}
        {showGoalInput && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
            <Target size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              type="number"
              className="input"
              placeholder="Word goal (e.g. 500)"
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSetGoal(); }}
              style={{ padding: '6px 10px', fontSize: '13px', width: '160px' }}
              autoFocus
              min="0"
            />
            <button className="btn btn-secondary btn-sm" onClick={handleSetGoal}>Set</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowGoalInput(false)}>Cancel</button>
          </div>
        )}

        <div
          ref={editorRef}
          className={`paper-body font-${fontSize}`}
          contentEditable
          onInput={handleInput}
          onBlur={handleEditorInput}
          data-placeholder={isNewEntry ? prompt : 'Start writing privately...'}
          style={{ outline: 'none' }}
        />

        <div className="tags-container">
          <Tag size={14} style={{ color: 'var(--text-muted)' }} />
          {tags.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
              <button className="tag-remove" onClick={() => handleTagRemove(tag)}>×</button>
            </span>
          ))}
          <input
            type="text"
            className="tag-input"
            placeholder="+ add tag (try ;date, ;time)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagAdd}
          />
        </div>
      </div>
    </main>
  );
}
