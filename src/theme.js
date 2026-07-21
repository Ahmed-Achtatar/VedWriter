// VedWriter Theme Engine
// Six calm, focus-first themes for the user to choose from.

export const THEMES = {
  paper: {
    name: 'Paper',
    dot: '#8B6F47',
    vars: {
      '--bg-primary': '#F7F5F0',
      '--bg-secondary': '#FFFFFF',
      '--bg-tertiary': '#F0EDE6',
      '--text-primary': '#1A1A1A',
      '--text-secondary': '#6B6B6B',
      '--text-muted': '#9A9A9A',
      '--accent': '#8B6F47',
      '--accent-soft': '#E8E0D4',
      '--accent-hover': '#6B5332',
      '--border': '#E5E1D8',
      '--border-strong': '#D4CFC4',
      '--shadow': '0 1px 3px rgba(0,0,0,0.04)',
      '--shadow-md': '0 4px 12px rgba(0,0,0,0.06)',
      '--shadow-lg': '0 12px 32px rgba(0,0,0,0.08)',
    }
  },
  cloud: {
    name: 'Cloud',
    dot: '#475569',
    vars: {
      '--bg-primary': '#F8FAFC',
      '--bg-secondary': '#FFFFFF',
      '--bg-tertiary': '#F1F5F9',
      '--text-primary': '#0F172A',
      '--text-secondary': '#64748B',
      '--text-muted': '#94A3B8',
      '--accent': '#475569',
      '--accent-soft': '#E2E8F0',
      '--accent-hover': '#334155',
      '--border': '#E2E8F0',
      '--border-strong': '#CBD5E1',
      '--shadow': '0 1px 3px rgba(15,23,42,0.04)',
      '--shadow-md': '0 4px 12px rgba(15,23,42,0.06)',
      '--shadow-lg': '0 12px 32px rgba(15,23,42,0.08)',
    }
  },
  sage: {
    name: 'Sage',
    dot: '#556B52',
    vars: {
      '--bg-primary': '#F5F7F4',
      '--bg-secondary': '#FFFFFF',
      '--bg-tertiary': '#EDF1EA',
      '--text-primary': '#1C241B',
      '--text-secondary': '#5C6B58',
      '--text-muted': '#8B9A86',
      '--accent': '#556B52',
      '--accent-soft': '#DDE6D9',
      '--accent-hover': '#3F4F3D',
      '--border': '#DDE6D9',
      '--border-strong': '#C5D3C0',
      '--shadow': '0 1px 3px rgba(28,36,27,0.04)',
      '--shadow-md': '0 4px 12px rgba(28,36,27,0.06)',
      '--shadow-lg': '0 12px 32px rgba(28,36,27,0.08)',
    }
  },
  ink: {
    name: 'Ink',
    dot: '#D4D4D8',
    vars: {
      '--bg-primary': '#0F0F12',
      '--bg-secondary': '#18181B',
      '--bg-tertiary': '#232329',
      '--text-primary': '#F4F4F5',
      '--text-secondary': '#A1A1AA',
      '--text-muted': '#71717A',
      '--accent': '#D4D4D8',
      '--accent-soft': '#27272A',
      '--accent-hover': '#FFFFFF',
      '--border': '#27272A',
      '--border-strong': '#3F3F46',
      '--shadow': '0 1px 3px rgba(0,0,0,0.25)',
      '--shadow-md': '0 4px 12px rgba(0,0,0,0.35)',
      '--shadow-lg': '0 12px 32px rgba(0,0,0,0.45)',
    }
  },
  obsidian: {
    name: 'Obsidian',
    dot: '#E5E7EB',
    vars: {
      '--bg-primary': '#111827',
      '--bg-secondary': '#1F2937',
      '--bg-tertiary': '#374151',
      '--text-primary': '#F9FAFB',
      '--text-secondary': '#9CA3AF',
      '--text-muted': '#6B7280',
      '--accent': '#E5E7EB',
      '--accent-soft': '#374151',
      '--accent-hover': '#FFFFFF',
      '--border': '#374151',
      '--border-strong': '#4B5563',
      '--shadow': '0 1px 3px rgba(0,0,0,0.25)',
      '--shadow-md': '0 4px 12px rgba(0,0,0,0.35)',
      '--shadow-lg': '0 12px 32px rgba(0,0,0,0.45)',
    }
  },
  'olive-dark': {
    name: 'Olive Dark',
    dot: '#B9C4A9',
    vars: {
      '--bg-primary': '#161713',
      '--bg-secondary': '#1F211D',
      '--bg-tertiary': '#2A2D27',
      '--text-primary': '#E8E8E3',
      '--text-secondary': '#9BA092',
      '--text-muted': '#6F7667',
      '--accent': '#B9C4A9',
      '--accent-soft': '#2F332B',
      '--accent-hover': '#D4DDC8',
      '--border': '#2F332B',
      '--border-strong': '#444A3F',
      '--shadow': '0 1px 3px rgba(0,0,0,0.25)',
      '--shadow-md': '0 4px 12px rgba(0,0,0,0.35)',
      '--shadow-lg': '0 12px 32px rgba(0,0,0,0.45)',
    }
  },
  sepia: {
    name: 'Sepia',
    dot: '#A0826D',
    vars: {
      '--bg-primary': '#F4ECD8',
      '--bg-secondary': '#FBF5E5',
      '--bg-tertiary': '#EBE0C8',
      '--text-primary': '#3C2E17',
      '--text-secondary': '#6B5A42',
      '--text-muted': '#8B7A62',
      '--accent': '#8B6F47',
      '--accent-soft': '#E8DCC4',
      '--accent-hover': '#5C4B37',
      '--border': '#D4C4A8',
      '--border-strong': '#B8A888',
      '--shadow': '0 1px 3px rgba(60,46,23,0.06)',
      '--shadow-md': '0 4px 12px rgba(60,46,23,0.08)',
      '--shadow-lg': '0 12px 32px rgba(60,46,23,0.1)',
    }
  },
  'high-contrast': {
    name: 'High Contrast',
    dot: '#0000EE',
    vars: {
      '--bg-primary': '#FFFFFF',
      '--bg-secondary': '#FFFFFF',
      '--bg-tertiary': '#F0F0F0',
      '--text-primary': '#000000',
      '--text-secondary': '#1A1A1A',
      '--text-muted': '#444444',
      '--accent': '#0000EE',
      '--accent-soft': '#E0E0FF',
      '--accent-hover': '#0000AA',
      '--border': '#000000',
      '--border-strong': '#000000',
      '--shadow': '0 0 0 1px rgba(0,0,0,0.2)',
      '--shadow-md': '0 0 0 2px rgba(0,0,0,0.25)',
      '--shadow-lg': '0 0 0 3px rgba(0,0,0,0.3)',
    }
  }
};

const STORAGE_KEY = 'vedwriter-theme';
const DEFAULT_THEME = 'paper';

/**
 * Apply a theme's CSS variables to the document root.
 */
export function applyTheme(themeId) {
  const theme = THEMES[themeId] || THEMES[DEFAULT_THEME];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  root.setAttribute('data-theme', themeId);
}

/**
 * Save theme preference to localStorage.
 */
export function saveTheme(themeId) {
  try {
    localStorage.setItem(STORAGE_KEY, themeId);
  } catch {
    // Ignore storage errors in private browsing
  }
}

/**
 * Load theme preference from localStorage.
 */
export function loadTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Set and persist a theme.
 */
export function setTheme(themeId) {
  const valid = THEMES[themeId] ? themeId : DEFAULT_THEME;
  applyTheme(valid);
  saveTheme(valid);
}

/**
 * Initialize theme before first paint. Call this as early as possible.
 */
export function initTheme() {
  applyTheme(loadTheme());
}
