// Canvas helpers — pure functions, no React.
// World space ↔ Screen space transforms for the infinite 2D canvas.

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;
export const SNAP_THRESHOLD = 5; // px in screen space

export function clampZoom(z) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

export function screenToWorld(clientX, clientY, containerRect, view) {
  const sx = clientX - containerRect.left;
  const sy = clientY - containerRect.top;
  return {
    x: sx / view.zoom + view.x,
    y: sy / view.zoom + view.y,
  };
}

export function worldToScreen(wx, wy, view) {
  return {
    x: (wx - view.x) * view.zoom,
    y: (wy - view.y) * view.zoom,
  };
}

export function zoomAt(view, focalClientX, focalClientY, newZoomRaw) {
  const newZoom = clampZoom(newZoomRaw);
  const wx = focalClientX / view.zoom + view.x;
  const wy = focalClientY / view.zoom + view.y;
  return {
    zoom: newZoom,
    x: wx - focalClientX / newZoom,
    y: wy - focalClientY / newZoom,
  };
}

export function fitToView(cards, containerW, containerH, padding = 80) {
  if (!cards || cards.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of cards) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + (c.w || 200));
    maxY = Math.max(maxY, c.y + (c.h || 160));
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 0 || h <= 0) return null;
  const zoom = clampZoom(Math.min((containerW - padding * 2) / w, (containerH - padding * 2) / h));
  return {
    zoom,
    x: minX + w / 2 - containerW / 2 / zoom,
    y: minY + h / 2 - containerH / 2 / zoom,
  };
}

export function cardsCenter(cards) {
  if (!cards.length) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const c of cards) { sx += c.x + (c.w || 200) / 2; sy += c.y + (c.h || 160) / 2; }
  return { x: sx / cards.length, y: sy / cards.length };
}

// Color palette for sticky notes — light, friendly tones.
export const STICKY_COLORS = [
  { id: 'yellow', value: '#FEF3C7', border: '#FDE68A', text: '#78350F' },
  { id: 'pink',   value: '#FCE7F3', border: '#FBCFE8', text: '#831843' },
  { id: 'blue',   value: '#DBEAFE', border: '#BFDBFE', text: '#1E3A8A' },
  { id: 'green',  value: '#D1FAE5', border: '#A7F3D0', text: '#064E3B' },
  { id: 'purple', value: '#EDE9FE', border: '#DDD6FE', text: '#4C1D95' },
  { id: 'peach',  value: '#FFEDD5', border: '#FED7AA', text: '#7C2D12' },
  { id: 'white',  value: '#FFFFFF', border: '#E5E7EB', text: '#1F2937' },
];

// Soft background areas that help people orient themselves without forcing
// cards into a rigid hierarchy. Zones are intentionally independent from
// cards, so cards can sit inside, outside, or across them.
export const ZONE_COLORS = [
  { id: 'sand',  value: '#FFF8E7', border: '#F5DFA0', text: '#7C5A12' },
  { id: 'blue',  value: '#F1F7FF', border: '#C7DDF7', text: '#315A86' },
  { id: 'mint',  value: '#F1FBF6', border: '#C4E8D2', text: '#276144' },
  { id: 'rose',  value: '#FFF4F7', border: '#F2CDD8', text: '#87465A' },
  { id: 'lilac', value: '#F8F5FF', border: '#DCD2F5', text: '#614B8B' },
  { id: 'slate', value: '#F5F7F9', border: '#D6DDE5', text: '#526171' },
];

// Default dimensions per card type.
export const CARD_DIMS = {
  note:    { w: 220, h: 180 },
  text:    { w: 240, h: 120 },
  image:   { w: 240, h: 240 },
  media:   { w: 280, h: 220 },
  column:  { w: 280, h: 420 },
};

export const MEDIA_KINDS = {
  image: 'image',
  pdf: 'pdf',
  audio: 'audio',
  video: 'video',
  document: 'document',
  link: 'link',
  file: 'file',
  voice: 'voice',
};

export function mediaKindFromFile(file) {
  if (!file) return MEDIA_KINDS.file;
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(name)) return MEDIA_KINDS.image;
  if (type === 'application/pdf' || name.endsWith('.pdf')) return MEDIA_KINDS.pdf;
  if (type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac|opus|weba)$/i.test(name)) return MEDIA_KINDS.audio;
  if (type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(name)) return MEDIA_KINDS.video;
  if (type.startsWith('text/') || /\.(txt|md|markdown|csv|json|xml|html|htm|log)$/i.test(name)) return MEDIA_KINDS.document;
  if (/\.(doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|rtf)$/i.test(name)) return MEDIA_KINDS.document;
  return MEDIA_KINDS.file;
}

export function mediaIconForKind(kind) {
  return {
    image: '▧', pdf: '▤', audio: '♫', video: '▶', document: '▱',
    link: '↗', file: '◇', voice: '◉',
  }[kind] || '◇';
}

export function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

// Sticker templates — one-click starters with pre-filled text and color.
export const STICKER_TEMPLATES = [
  {
    id: 'todo',
    name: 'Todo',
    color: STICKY_COLORS[0],
    text: '☐ New task\n- [ ] First step\n- [ ] Second step',
  },
  {
    id: 'idea',
    name: 'Idea',
    color: STICKY_COLORS[3],
    text: '💡 **Idea**\n\nDescribe your idea here…',
  },
  {
    id: 'question',
    name: 'Question',
    color: STICKY_COLORS[2],
    text: '? **Question**\n\nWhat do you want to know?',
  },
  {
    id: 'problem',
    name: 'Problem',
    color: STICKY_COLORS[5],
    text: '! **Problem**\n\nWhat is the issue?',
  },
  {
    id: 'done',
    name: 'Done',
    color: STICKY_COLORS[1],
    text: '✓ **Done**\n\nWhat was completed?',
  },
];

export function makeZone(title, x, y, w = 360, h = 260, color = ZONE_COLORS[0], overrides = {}) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `z_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: title || 'Zone', x, y, w, h,
    color,
    locked: false,
    dateCreated: Date.now(),
    dateModified: Date.now(),
    ...overrides,
  };
}

export function defaultZonesForTemplate(template) {
  if (template === 'kanban') return [];
  const titles = template === 'mindmap'
    ? ['Main Idea', 'Questions', 'Branches']
    : template === 'moodboard'
      ? ['References', 'Direction', 'Selected']
      : ['Ideas', 'References', 'Draft'];
  return titles.map((title, i) => makeZone(title, -520 + i * 410, -260, 360, 280, ZONE_COLORS[i % ZONE_COLORS.length]));
}

// Hashtag → color mapping. Deterministic from the tag name.
const TAG_HUES = [40, 340, 210, 150, 270, 25, 180, 320, 90, 0];
export function tagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) & 0xffffffff;
  const hue = TAG_HUES[Math.abs(hash) % TAG_HUES.length];
  return {
    bg: `hsl(${hue} 90% 92%)`,
    border: `hsl(${hue} 80% 78%)`,
    text: `hsl(${hue} 60% 28%)`,
  };
}

// Build a starter document for a given template.
export function buildStarterDoc(template) {
  const empty = { v: 2, type: template, cards: [], edges: [], zones: defaultZonesForTemplate(template), view: { x: 0, y: 0, zoom: 1 } };
  if (template === 'kanban') {
    const col1 = makeCard('To Do', 0, 0, { type: 'column' });
    const col2 = makeCard('In Progress', 340, 0, { type: 'column' });
    const col3 = makeCard('Done', 680, 0, { type: 'column' });
    return { ...empty, cards: [col1, col2, col3] };
  }
  if (template === 'mindmap') {
    const center = makeCard('Central Idea', -110, -90, { type: 'note', color: STICKY_COLORS[3] });
    return { ...empty, cards: [center] };
  }
  return empty;
}

export function makeCard(text, x, y, overrides = {}) {
  const type = overrides.type || 'note';
  const dims = CARD_DIMS[type] || CARD_DIMS.note;
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    x, y,
    w: dims.w,
    h: dims.h,
    type,
    text: text || '',
    color: overrides.color || STICKY_COLORS[0],
    imageData: overrides.imageData || null,
    media: overrides.media || null,
    parentId: overrides.parentId || null,
    rotation: overrides.rotation ?? 0,
    collapsed: overrides.collapsed ?? false,
    template: overrides.template || null,
    groupId: overrides.groupId || null,
    linkEntryId: overrides.linkEntryId || null,
    dateCreated: overrides.dateCreated || Date.now(),
    dateModified: overrides.dateModified || Date.now(),
  };
}

export function makeEdge(from, to, label = '') {
  return {
    id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    from, to, label,
  };
}

const CARD_TYPES = new Set(Object.keys(CARD_DIMS));
const MEDIA_KIND_VALUES = new Set(Object.values(MEDIA_KINDS));

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function stableId(value, fallback, usedIds) {
  const base = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) id = `${base}_${suffix++}`;
  usedIds.add(id);
  return id;
}

function normalizeColor(value, palette, fallback) {
  if (typeof value === 'string') {
    return palette.find((color) => color.id === value || color.value === value) || fallback;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  return {
    id: typeof value.id === 'string' ? value.id : fallback.id,
    value: typeof value.value === 'string' ? value.value : fallback.value,
    border: typeof value.border === 'string' ? value.border : fallback.border,
    text: typeof value.text === 'string' ? value.text : fallback.text,
  };
}

function normalizeMedia(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const kind = MEDIA_KIND_VALUES.has(value.kind) ? value.kind : MEDIA_KINDS.file;
  const asString = (item) => typeof item === 'string' && item ? item : null;
  return {
    ...value,
    kind,
    name: typeof value.name === 'string' ? value.name : 'Attached file',
    size: Math.max(0, finiteNumber(value.size, 0)),
    mime: typeof value.mime === 'string' ? value.mime : 'application/octet-stream',
    dataUrl: asString(value.dataUrl),
    textPreview: typeof value.textPreview === 'string' ? value.textPreview : '',
    url: asString(value.url),
    duration: Math.max(0, finiteNumber(value.duration, 0)),
    dateCreated: finiteNumber(value.dateCreated, Date.now()),
  };
}

// Migrate older documents and fill in defaults for missing fields. Canvas data
// is user-authored and may come from older releases, interrupted saves, or a
// hand-edited backup, so render code should never have to trust its shape.
export function parseCanvasBody(raw, fallbackType = 'whiteboard') {
  if (!raw) return buildStarterDoc(fallbackType);
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== 'object') return buildStarterDoc(fallbackType);
    return normalizeCanvasDoc({
      v: obj.v || 1,
      type: obj.type || fallbackType,
      cards: Array.isArray(obj.cards) ? obj.cards : [],
      edges: Array.isArray(obj.edges) ? obj.edges : [],
      zones: Array.isArray(obj.zones) ? obj.zones : [],
      view: obj.view,
    }, fallbackType);
  } catch {
    return buildStarterDoc(fallbackType);
  }
}

export function normalizeCanvasDoc(raw, fallbackType = 'whiteboard') {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const cardIds = new Set();
  const cards = (Array.isArray(source.cards) ? source.cards : [])
    .map((card, index) => normalizeCard(card, index, cardIds))
    .filter(Boolean);
  const edgeIds = new Set();
  const edges = (Array.isArray(source.edges) ? source.edges : [])
    .map((edge, index) => {
      if (!edge || typeof edge !== 'object' || Array.isArray(edge)) return null;
      const from = typeof edge.from === 'string' ? edge.from : '';
      const to = typeof edge.to === 'string' ? edge.to : '';
      if (!from || !to) return null;
      return {
        ...edge,
        id: stableId(edge.id, `e_${index}`, edgeIds),
        from,
        to,
        label: typeof edge.label === 'string' ? edge.label : '',
      };
    })
    .filter(Boolean);
  const zoneIds = new Set();
  const zones = (Array.isArray(source.zones) ? source.zones : [])
    .map((zone, index) => normalizeZone(zone, index, zoneIds))
    .filter(Boolean);
  const rawView = source.view && typeof source.view === 'object' ? source.view : {};
  return {
    v: Number.isFinite(source.v) ? source.v : 2,
    type: typeof source.type === 'string' ? source.type : fallbackType,
    cards,
    edges,
    zones,
    view: {
      x: finiteNumber(rawView.x, 0),
      y: finiteNumber(rawView.y, 0),
      zoom: clampZoom(finiteNumber(rawView.zoom, 1)),
    },
  };
}

function normalizeCard(value, index, usedIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const type = CARD_TYPES.has(value.type) ? value.type : 'note';
  const dims = CARD_DIMS[type];
  return {
    ...value,
    id: stableId(value.id, `c_${index}`, usedIds),
    x: finiteNumber(value.x, 0),
    y: finiteNumber(value.y, 0),
    w: Math.max(40, finiteNumber(value.w, dims.w)),
    h: Math.max(40, finiteNumber(value.h, dims.h)),
    type,
    text: typeof value.text === 'string' ? value.text : '',
    color: normalizeColor(value.color, STICKY_COLORS, STICKY_COLORS[0]),
    rotation: finiteNumber(value.rotation, 0),
    parentId: typeof value.parentId === 'string' ? value.parentId : null,
    collapsed: !!value.collapsed,
    template: typeof value.template === 'string' ? value.template : null,
    groupId: typeof value.groupId === 'string' ? value.groupId : null,
    linkEntryId: typeof value.linkEntryId === 'string' ? value.linkEntryId : null,
    media: normalizeMedia(value.media),
    imageData: typeof value.imageData === 'string' ? value.imageData : null,
    dateCreated: finiteNumber(value.dateCreated, Date.now()),
    dateModified: finiteNumber(value.dateModified, finiteNumber(value.dateCreated, Date.now())),
  };
}

function normalizeZone(value, index, usedIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    ...value,
    id: stableId(value.id, `z_${index}`, usedIds),
    title: typeof value.title === 'string' && value.title.trim() ? value.title : 'Zone',
    x: finiteNumber(value.x, 0),
    y: finiteNumber(value.y, 0),
    w: Math.max(160, finiteNumber(value.w, 360)),
    h: Math.max(120, finiteNumber(value.h, 260)),
    color: normalizeColor(value.color, ZONE_COLORS, ZONE_COLORS[0]),
    locked: !!value.locked,
    dateCreated: finiteNumber(value.dateCreated, Date.now()),
    dateModified: finiteNumber(value.dateModified, finiteNumber(value.dateCreated, Date.now())),
  };
}

export function serializeCanvasBody(doc) {
  return JSON.stringify(normalizeCanvasDoc(doc, doc?.type || 'whiteboard'));
}

export function createStarterBody(template) {
  return serializeCanvasBody(buildStarterDoc(template));
}

// ─────────────────────────────────────────────────────────────────────
// Markdown / hashtag helpers
// ─────────────────────────────────────────────────────────────────────

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

// Parse a single line of markdown and return HTML.
function mdLine(line) {
  if (line.trim() === '') return '<div class="md-blank">&nbsp;</div>';
  // Headings (require space after #)
  let m;
  if ((m = line.match(/^### (.+)$/))) return `<h3>${mdInline(escapeHtml(m[1]))}</h3>`;
  if ((m = line.match(/^## (.+)$/)))  return `<h2>${mdInline(escapeHtml(m[1]))}</h2>`;
  if ((m = line.match(/^# (.+)$/)))   return `<h1>${mdInline(escapeHtml(m[1]))}</h1>`;
  // Checkboxes
  if ((m = line.match(/^- \[ \] (.+)$/))) {
    return `<div class="md-todo"><span class="md-checkbox"></span>${mdInline(escapeHtml(m[1]))}</div>`;
  }
  if ((m = line.match(/^- \[x\] (.+)$/i))) {
    return `<div class="md-todo md-todo-done"><span class="md-checkbox md-checkbox-checked">✓</span>${mdInline(escapeHtml(m[1]))}</div>`;
  }
  // Bullet
  if ((m = line.match(/^- (.+)$/))) {
    return `<div class="md-bullet">• ${mdInline(escapeHtml(m[1]))}</div>`;
  }
  // Numbered
  if ((m = line.match(/^(\d+)\. (.+)$/))) {
    return `<div class="md-bullet">${m[1]}. ${mdInline(escapeHtml(m[2]))}</div>`;
  }
  // Quote
  if ((m = line.match(/^> (.+)$/))) {
    return `<div class="md-quote">${mdInline(escapeHtml(m[1]))}</div>`;
  }
  // Paragraph
  return `<p>${mdInline(escapeHtml(line))}</p>`;
}

function mdInline(s) {
  // Bold first (must be before italic)
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  // Italic (single * not adjacent to another *)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  // Inline code
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  return s;
}

export function parseMarkdown(text) {
  if (!text) return '';
  return text.split('\n').map(mdLine).join('');
}

// Extract unique #hashtags from text. Matches #word (no space after #)
// so it doesn't collide with markdown headings (# heading).
export function extractHashtags(text) {
  if (!text) return [];
  const seen = new Set();
  const out = [];
  const re = /#([a-zA-Z][a-zA-Z0-9_]*)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const tag = m[1].toLowerCase();
    if (!seen.has(tag)) { seen.add(tag); out.push(tag); }
  }
  return out;
}

// Format a timestamp as a friendly relative time, e.g. "2h ago", "Mar 14".
export function formatRelativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Snap-to-edges: given a candidate card position, find the closest snap
// against all other cards. Returns the snapped position and a guide line
// descriptor { axis: 'x'|'y', value: number } or null.
export function computeSnap(candidate, otherCards, threshold = SNAP_THRESHOLD) {
  let bestX = null, bestY = null, bestDx = Infinity, bestDy = Infinity;
  const cL = candidate.x, cR = candidate.x + candidate.w;
  const cT = candidate.y, cB = candidate.y + candidate.h;
  for (const o of otherCards) {
    if (o.id === candidate.id) continue;
    const oL = o.x, oR = o.x + o.w, oT = o.y, oB = o.y + o.h;
    const tryX = [
      { other: oL, self: cL, key: 'left' },
      { other: oL, self: cR, key: 'right-to-left' },
      { other: oR, self: cL, key: 'left-to-right' },
      { other: oR, self: cR, key: 'right' },
      { other: o.x + o.w / 2, self: candidate.x + candidate.w / 2, key: 'center-x' },
    ];
    for (const c of tryX) {
      const dx = c.other - c.self;
      if (Math.abs(dx) < threshold && Math.abs(dx) < bestDx) {
        bestDx = Math.abs(dx);
        bestX = { dx, axis: 'x', value: c.other };
      }
    }
    const tryY = [
      { other: oT, self: cT, key: 'top' },
      { other: oT, self: cB, key: 'bottom-to-top' },
      { other: oB, self: cT, key: 'top-to-bottom' },
      { other: oB, self: cB, key: 'bottom' },
      { other: o.y + o.h / 2, self: candidate.y + candidate.h / 2, key: 'center-y' },
    ];
    for (const c of tryY) {
      const dy = c.other - c.self;
      if (Math.abs(dy) < threshold && Math.abs(dy) < bestDy) {
        bestDy = Math.abs(dy);
        bestY = { dy, axis: 'y', value: c.other };
      }
    }
  }
  let snapDx = 0, snapDy = 0;
  if (bestX) snapDx = bestX.dx;
  if (bestY) snapDy = bestY.dy;
  return {
    dx: snapDx,
    dy: snapDy,
    guides: {
      x: bestX ? bestX.value : null,
      y: bestY ? bestY.value : null,
    },
  };
}

// Find the card (if any) that contains a given world point.
export function findCardAtPoint(px, py, cards) {
  // Iterate in reverse so the topmost card wins.
  for (let i = cards.length - 1; i >= 0; i--) {
    const c = cards[i];
    if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) {
      return c;
    }
  }
  return null;
}

// Return a stable, content-only snapshot for canvas undo/redo. View changes
// such as panning and zooming should not clutter the history stack.
export function canvasContentSnapshot(doc) {
  return {
    v: doc.v || 2,
    type: doc.type || 'whiteboard',
    cards: doc.cards || [],
    edges: doc.edges || [],
    zones: doc.zones || [],
  };
}

export function canvasContentKey(doc) {
  return JSON.stringify(canvasContentSnapshot(doc));
}

// Remove a batch of cards as one atomic document operation. A Set keeps mass
// deletion linear even when a canvas contains thousands of cards or edges.
export function removeCardsFromCanvas(doc, ids) {
  const idSet = new Set((ids || []).filter(Boolean));
  if (!idSet.size) return doc;
  const safeDoc = normalizeCanvasDoc(doc, doc?.type || 'whiteboard');
  return {
    ...safeDoc,
    cards: safeDoc.cards.filter((card) => !idSet.has(card.id)),
    edges: safeDoc.edges.filter((edge) => !idSet.has(edge.from) && !idSet.has(edge.to)),
  };
}

function svgEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function wrapSvgText(value, maxChars = 34) {
  const words = String(value || '').split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 12);
}

// Lightweight, dependency-free visual export. SVG is the source format; the
// caller can download it directly or rasterize it to PNG in the browser.
export function buildCanvasSvg(doc, options = {}) {
  const cards = doc.cards || [];
  const zones = doc.zones || [];
  const all = [...cards, ...zones];
  if (!all.length) return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="#f8f8f6"/></svg>';
  const padding = options.padding || 80;
  const minX = Math.min(...all.map((item) => item.x));
  const minY = Math.min(...all.map((item) => item.y));
  const maxX = Math.max(...all.map((item) => item.x + item.w));
  const maxY = Math.max(...all.map((item) => item.y + item.h));
  const width = Math.max(320, Math.ceil(maxX - minX + padding * 2));
  const height = Math.max(240, Math.ceil(maxY - minY + padding * 2));
  const tx = padding - minX;
  const ty = padding - minY;
  const byId = new Map(cards.map((card) => [card.id, card]));

  const zoneMarkup = zones.map((zone) => {
    const c = zone.color || ZONE_COLORS[0];
    return `<g transform="translate(${zone.x + tx} ${zone.y + ty})"><rect width="${zone.w}" height="${zone.h}" rx="18" fill="${svgEscape(c.value)}" stroke="${svgEscape(c.border)}" stroke-width="2"/><text x="18" y="28" font-family="Inter,Arial,sans-serif" font-size="16" font-weight="600" fill="${svgEscape(c.text)}">${svgEscape(zone.title)}</text></g>`;
  }).join('');

  const edgeMarkup = (doc.edges || []).map((edge) => {
    const a = byId.get(edge.from), b = byId.get(edge.to);
    if (!a || !b) return '';
    const ax = a.x + a.w / 2 + tx, ay = a.y + a.h / 2 + ty;
    const bx = b.x + b.w / 2 + tx, by = b.y + b.h / 2 + ty;
    return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#9aa4b2" stroke-width="2" stroke-dasharray="7 6"/>`;
  }).join('');

  const cardMarkup = cards.map((card) => {
    const c = card.color || STICKY_COLORS[0];
    const x = card.x + tx, y = card.y + ty;
    const lines = wrapSvgText(card.text, Math.max(18, Math.floor(card.w / 8)));
    const text = lines.map((line, i) => `<text x="${x + 16}" y="${y + 34 + i * 20}" font-family="Inter,Arial,sans-serif" font-size="14" fill="${svgEscape(c.text)}">${svgEscape(line)}</text>`).join('');
    const imageData = card.imageData || (card.media?.kind === MEDIA_KINDS.image ? card.media.dataUrl : null);
    const image = imageData ? `<image href="${imageData}" x="${x + 8}" y="${y + 8}" width="${Math.max(20, card.w - 16)}" height="${Math.max(20, card.h - 16)}" preserveAspectRatio="xMidYMid slice" opacity="0.9"/>` : '';
    const mediaLabel = card.media && !imageData ? `<text x="${x + 16}" y="${y + 32}" font-family="Inter,Arial,sans-serif" font-size="14" font-weight="600" fill="${svgEscape(c.text)}">${svgEscape(`${mediaIconForKind(card.media.kind)} ${card.media.name || 'Attached file'}`)}</text>` : '';
    return `<g transform="rotate(${card.rotation || 0} ${x + card.w / 2} ${y + card.h / 2})"><rect x="${x}" y="${y}" width="${card.w}" height="${card.h}" rx="12" fill="${svgEscape(c.value)}" stroke="${svgEscape(c.border)}" stroke-width="2"/>${image}${imageData ? '' : (mediaLabel || text)}</g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fbfaf7"/>${zoneMarkup}${edgeMarkup}${cardMarkup}</svg>`;
}

export function canvasCardsToHtml(cards, zones = []) {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const selected = [...cards].sort((a, b) => a.y - b.y || a.x - b.x);
  const zoneByCard = zones.map((zone) => `<h2>${escape(zone.title)}</h2>`).join('');
  const body = selected.map((card) => {
    if ((card.type === 'image' && card.imageData) || (card.media?.kind === MEDIA_KINDS.image && card.media.dataUrl)) {
      return `<figure><img src="${card.imageData || card.media.dataUrl}" alt="" style="max-width:100%;" /></figure>`;
    }
    if (card.media) return `<p><strong>${escape(`${mediaIconForKind(card.media.kind)} ${card.media.name || 'Attached file'}`)}</strong>${card.media.size ? ` — ${escape(formatFileSize(card.media.size))}` : ''}</p>`;
    const lines = String(card.text || '').split(/\r?\n/).filter(Boolean);
    return lines.length ? lines.map((line) => `<p>${escape(line)}</p>`).join('') : '<p></p>';
  }).join('');
  return `${zoneByCard}${body}`;
}
