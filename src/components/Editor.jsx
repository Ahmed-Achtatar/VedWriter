import React, { useRef, useEffect, useState } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, FileDown, Trash2, Calendar, BookOpen, Tag,
  Undo2, Redo2, Maximize2, Minimize2, ListTree, Search, X,
  Plus, Minus, Target, ChevronUp, ChevronDown, Paperclip, Layers
} from 'lucide-react';

import DraftSheetCanvas from './DraftSheetCanvas';



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

  // Slash menu state
  const [slashMenu, setSlashMenu] = useState({ show: false, query: '', selectedIndex: 0 });
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        insertAttachmentCard(file, dataUrl);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };



  const [showGoalInput, setShowGoalInput] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  const editorRef = useRef(null);
  const lastBodyRef = useRef('');
  const lastEntryIdRef = useRef(null);
  const saveTimerRef = useRef(null);
  const historyRef = useRef({ stack: [], index: -1, maxSize: 100 });

  // Draft sheets state (stacked behind page)
  const [drafts, setDrafts] = useState([]);
  const [activeDraftIndex, setActiveDraftIndex] = useState(null);
  const [isDraftOpen, setIsDraftOpen] = useState(false);

  const createNewDraft = () => {
    const newDrafts = [...drafts, ''];
    setDrafts(newDrafts);
    setActiveDraftIndex(newDrafts.length - 1);
    setIsDraftOpen(true);
    handleSaveImmediate({ drafts: newDrafts });
  };

  const openDraft = (index) => {
    setActiveDraftIndex(index);
    setIsDraftOpen(true);
  };

  const handleSaveDraft = (index, draftData) => {
    const idx = index !== undefined && index !== null ? index : activeDraftIndex;
    if (idx === null || idx < 0) return;
    const updated = [...drafts];
    updated[idx] = draftData;
    setDrafts(updated);
    handleSaveImmediate({ drafts: updated });
  };


  const handleDeleteDraft = (indexToDelete) => {
    const updated = drafts.filter((_, idx) => idx !== indexToDelete);
    setDrafts(updated);
    setActiveDraftIndex(null);
    setIsDraftOpen(false);
    handleSaveImmediate({ drafts: updated });
  };

  const handleInsertDraftToEditor = (dataUrl, filename) => {
    insertAttachmentCard({ name: filename, type: 'image/png', size: 0 }, dataUrl);
  };

  // Sync from props only when switching entries
  useEffect(() => {
    if (!entry) {
      setTitle('');
      setTags([]);
      setDrafts([]);
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
      setDrafts(entry.drafts || []);
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
    drafts,
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

  // Slash commands catalog
  const SLASH_COMMANDS = [
    { id: 'h1', name: 'Heading 1', desc: 'Large title heading', icon: 'H1', action: 'h1' },
    { id: 'h2', name: 'Heading 2', desc: 'Medium section heading', icon: 'H2', action: 'h2' },
    { id: 'h3', name: 'Heading 3', desc: 'Small section heading', icon: 'H3', action: 'h3' },
    { id: 'ul', name: 'Bullet List', desc: 'Create a bulleted list', icon: '•', action: 'insertUnorderedList' },
    { id: 'ol', name: 'Numbered List', desc: 'Create a numbered list', icon: '1.', action: 'insertOrderedList' },
    { id: 'quote', name: 'Quote Block', desc: 'Capture a quote block', icon: '"', action: 'blockquote' },
    { id: 'code', name: 'Code Block', desc: 'Monospaced code area', icon: '</>', action: 'pre' },
    { id: 'divider', name: 'Divider', desc: 'Horizontal rule line', icon: '―', action: 'insertHorizontalRule' },
    { id: 'today', name: "Today's Date", desc: 'Insert formatted date', icon: '📅', action: 'date' },
    { id: 'todo', name: 'Todo Checklist', desc: 'Insert interactive checkbox', icon: '☑️', action: 'todo' }
  ];

  const checkSlashCommand = () => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3) {
      setSlashMenu({ show: false, query: '', selectedIndex: 0 });
      return;
    }

    const text = node.textContent;
    const offset = sel.anchorOffset;
    const lastSlash = text.lastIndexOf('/', offset);

    if (lastSlash !== -1 && (lastSlash === 0 || /\s/.test(text[lastSlash - 1]))) {
      const query = text.substring(lastSlash + 1, offset);
      if (!query.includes(' ')) {
        setSlashMenu({ show: true, query: query.toLowerCase(), selectedIndex: 0 });
        return;
      }
    }
    setSlashMenu({ show: false, query: '', selectedIndex: 0 });
  };

  const executeSlashCommand = (cmd) => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const node = sel.anchorNode;
    if (node && node.nodeType === 3) {
      const text = node.textContent;
      const offset = sel.anchorOffset;
      const lastSlash = text.lastIndexOf('/', offset);
      if (lastSlash !== -1) {
        node.textContent = text.substring(0, lastSlash) + text.substring(offset);
      }
    }

    setSlashMenu({ show: false, query: '', selectedIndex: 0 });

    if (['h1', 'h2', 'h3', 'blockquote', 'pre'].includes(cmd.action)) {
      document.execCommand('formatBlock', false, `<${cmd.action}>`);
    } else if (cmd.action === 'insertUnorderedList' || cmd.action === 'insertOrderedList' || cmd.action === 'insertHorizontalRule') {
      document.execCommand(cmd.action, false, null);
    } else if (cmd.action === 'date') {
      const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      document.execCommand('insertText', false, todayStr);
    } else if (cmd.action === 'todo') {
      document.execCommand('insertText', false, '- [ ] ');
    }
    handleEditorInput();
  };

  // Smart Auto-link on Paste
  const handlePaste = (e) => {
    const pasteText = e.clipboardData?.getData('text/plain');
    if (!pasteText) return;

    const isUrl = /^https?:\/\/[^\s]+$/i.test(pasteText.trim());
    if (isUrl) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
        const selectedText = sel.toString();
        if (selectedText.trim() && !/^https?:\/\//i.test(selectedText.trim())) {
          e.preventDefault();
          const a = document.createElement('a');
          a.href = pasteText.trim();
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = selectedText;
          a.style.color = 'var(--accent)';
          a.style.textDecoration = 'underline';

          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(a);

          range.setStartAfter(a);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);

          handleEditorInput();
          return;
        }
      }
    }
  };

  // Drag & Drop for Unified Attachment Block
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types?.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDraggingFile(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        insertAttachmentCard(file, dataUrl);
      };
      reader.readAsDataURL(file);
    });
  };


  const insertAttachmentCard = (file, dataUrl) => {
    if (!editorRef.current) return;

    const card = document.createElement('div');
    card.className = 'unified-attachment-card';
    card.setAttribute('contenteditable', 'false');

    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');

    const iconStr = isImage ? '📷' : isAudio ? '🎵' : '📄';

    let bodyHtml = '';
    if (isImage) {
      bodyHtml = `<img src="${dataUrl}" alt="${file.name}" class="unified-card-img" />`;
    } else if (isAudio) {
      bodyHtml = `<audio controls src="${dataUrl}" class="unified-card-audio"></audio>`;
    } else {
      bodyHtml = `<div class="unified-card-doc-preview"><span>📄 Document attached</span><a href="${dataUrl}" download="${file.name}" style="color: var(--accent); font-weight: 600;">Download ${file.name}</a></div>`;
    }

    card.innerHTML = `
      <div class="unified-card-header">
        <span class="unified-card-info">
          <span class="unified-card-icon">${iconStr}</span>
          <span class="unified-card-name">${file.name}</span>
          <span class="unified-card-size">(${formatFileSize(file.size)})</span>
        </span>
        <div class="unified-card-actions">
          <button type="button" class="delete-card-btn" title="Remove attachment">✕</button>
        </div>
      </div>
      <div class="unified-card-body">
        ${bodyHtml}
      </div>
    `;

    // Attach remove handler
    card.querySelector('.delete-card-btn')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      card.remove();
      handleEditorInput();
    });

    const sel = window.getSelection();
    if (sel && sel.rangeCount && editorRef.current.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.insertNode(card);
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      card.after(p);
      range.setStartAfter(p);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editorRef.current.appendChild(card);
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      editorRef.current.appendChild(p);
    }
    handleEditorInput();
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

  // Combined input handler: snippets + auto-detect + slash menu
  const handleInput = () => {
    handleEditorInput();
    checkForSnippets();
    checkSlashCommand();
  };

  // Combined keydown: shortcuts + markdown + auto-pair + slash menu nav
  const handleCombinedKeyDown = (e) => {
    if (slashMenu.show) {
      const filtered = SLASH_COMMANDS.filter(c => c.name.toLowerCase().includes(slashMenu.query) || c.id.toLowerCase().includes(slashMenu.query));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashMenu(prev => ({ ...prev, selectedIndex: (prev.selectedIndex + 1) % (filtered.length || 1) }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashMenu(prev => ({ ...prev, selectedIndex: (prev.selectedIndex - 1 + (filtered.length || 1)) % (filtered.length || 1) }));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[slashMenu.selectedIndex]) {
          executeSlashCommand(filtered[slashMenu.selectedIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenu({ show: false, query: '', selectedIndex: 0 });
        return;
      }
    }
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
          <div className="toolbar-divider" />
          <button className="toolbar-btn" onMouseDown={toolbarMouseDown} onClick={() => fileInputRef.current?.click()} title="Attach file or image">
            <Paperclip size={16} />
          </button>
          <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
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

      {/* Paper Stack Container */}
      <div className="paper-stack-container">
        {/* Pointed Yellow Triangle Tabs Stacked Behind the Right Edge */}
        {drafts.map((d, i) => {
          const topOffset = 50 + i * 85;
          const dTitle = typeof d === 'object' && d?.title ? d.title : `Draft #${i + 1}`;
          return (
            <div
              key={i}
              className="paper-triangular-flap"
              onClick={() => openDraft(i)}
              title={`Open ${dTitle}`}
              style={{
                top: `${topOffset}px`
              }}
            >
              <div className="paper-triangular-label">
                <Layers size={12} style={{ color: '#713F12', flexShrink: 0 }} />
                <span>{dTitle}</span>
              </div>
            </div>
          );
        })}

        <button
          className="stacked-paper-add"
          onClick={createNewDraft}
          title="Add draft paper sheet behind page"
        >
          <Plus size={13} />
          <span>+ Draft Sheet</span>
        </button>

        {/* Main Front Paper Card */}
        <div
          className={`paper ${isDraggingFile ? 'drop-active' : ''}`}
          onKeyDown={handleCombinedKeyDown}
          onKeyUp={handleKeyUp}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{ position: 'relative', zIndex: 10 }}
        >
          {/* Freehand Draft Canvas Overlay Modal */}
          <DraftSheetCanvas
            isOpen={isDraftOpen}
            onClose={() => setIsDraftOpen(false)}
            initialDataUrl={typeof drafts[activeDraftIndex] === 'object' ? drafts[activeDraftIndex]?.dataUrl || '' : (drafts[activeDraftIndex] || '')}
            initialTitle={typeof drafts[activeDraftIndex] === 'object' ? drafts[activeDraftIndex]?.title || '' : `Draft #${(activeDraftIndex !== null ? activeDraftIndex : 0) + 1}`}
            onSaveDraft={handleSaveDraft}
            onDeleteDraft={handleDeleteDraft}
            onInsertToEditor={handleInsertDraftToEditor}
            sheetIndex={activeDraftIndex !== null ? activeDraftIndex : 0}
          />


        {isDraggingFile && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 100,
              background: 'rgba(247, 245, 240, 0.92)',
              border: '2px dashed var(--accent)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              color: 'var(--accent)',
              fontWeight: 600,
              pointerEvents: 'none',
              backdropFilter: 'blur(4px)'
            }}
          >
            <div style={{ fontSize: '36px' }}>📥</div>
            <div style={{ fontSize: '16px' }}>Drop files or images here to attach</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>Supports images, audio, PDFs & documents</div>
          </div>
        )}

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

        <div style={{ position: 'relative' }}>
          <div
            ref={editorRef}
            className={`paper-body font-${fontSize}`}
            contentEditable
            onInput={handleInput}
            onBlur={() => { handleEditorInput(); setTimeout(() => setSlashMenu({ show: false, query: '', selectedIndex: 0 }), 200); }}
            onPaste={handlePaste}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            data-placeholder={isNewEntry ? prompt : 'Start writing privately... (type / for commands)'}
            style={{ outline: 'none' }}
          />

          {slashMenu.show && (
            <div className="slash-menu" style={{ top: '24px', left: '16px' }}>
              {SLASH_COMMANDS.filter(c => c.name.toLowerCase().includes(slashMenu.query) || c.id.toLowerCase().includes(slashMenu.query)).map((cmd, idx) => (
                <div
                  key={cmd.id}
                  className={`slash-menu-item ${idx === slashMenu.selectedIndex ? 'selected' : ''}`}
                  onClick={() => executeSlashCommand(cmd)}
                  onMouseDown={(ev) => ev.preventDefault()}
                >
                  <span className="slash-menu-icon" style={{ fontSize: '14px', width: '20px', textAlign: 'center' }}>{cmd.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{cmd.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cmd.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


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
    </div>
  </main>
);
}





