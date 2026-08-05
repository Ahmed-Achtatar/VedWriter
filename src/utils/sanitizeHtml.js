const ALLOWED_TAGS = new Set([
  'a', 'audio', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4',
  'button', 'img', 'li', 'ol', 'p', 'pre', 's', 'source', 'span', 'strong', 'u', 'ul', 'video'
]);

const GLOBAL_ATTRIBUTES = new Set(['alt', 'aria-label', 'class', 'contenteditable', 'download', 'draggable', 'spellcheck', 'title', 'type']);
const URL_ATTRIBUTES = new Set(['href', 'src']);
const SAFE_SCHEMES = /^(https?:|mailto:)/i;
const SAFE_DATA_URL = /^data:(image|audio|video|application\/pdf|text\/plain);/i;

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function isSafeUrl(value, allowData = false) {
  const url = String(value || '').trim();
  if (!url) return false;
  if (allowData && SAFE_DATA_URL.test(url)) return true;
  return SAFE_SCHEMES.test(url);
}

// Sanitize user-authored editor HTML at every trust boundary. This intentionally
// removes embeds and inline event handlers; attachments are represented by safe
// media tags and links only.
export function sanitizeHtml(html) {
  if (typeof document === 'undefined') return '';
  const parser = new DOMParser();
  const parsed = parser.parseFromString(String(html || ''), 'text/html');
  const walker = document.createTreeWalker(parsed.body, NodeFilter.SHOW_ELEMENT);
  const elements = [];
  let current = walker.nextNode();
  while (current) {
    elements.push(current);
    current = walker.nextNode();
  }

  elements.forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      const isUrl = URL_ATTRIBUTES.has(name);
      const allowData = URL_ATTRIBUTES.has(name);
      if (name.startsWith('on') || name === 'style' || name === 'srcdoc' || (!GLOBAL_ATTRIBUTES.has(name) && !isUrl)) {
        element.removeAttribute(attribute.name);
      } else if (isUrl && !isSafeUrl(value, allowData)) {
        element.removeAttribute(attribute.name);
      }
    });

    if (tag === 'a') {
      element.setAttribute('rel', 'noopener noreferrer');
      element.setAttribute('target', '_blank');
    }
    if (tag === 'audio' || tag === 'video') {
      element.setAttribute('controls', '');
      element.setAttribute('preload', 'metadata');
    }
  });

  return parsed.body.innerHTML;
}
