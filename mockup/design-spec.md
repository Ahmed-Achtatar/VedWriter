# VedWriter — Premium Spatial Design Mockup v1.0

> Focus-first journal for learning, studying, and deep thinking.

---

## 1. Design Philosophy

**VedWriter is a thinking tool first, an app second.**

The new UI strips away visual noise so the user can focus on writing, reviewing, and organizing knowledge. The design language is:

- **Calm & neutral** — no competing colors, no harsh gradients, no ornamental 3D book covers.
- **Generously spaced** — every screen has room to breathe; density matches the task (dashboard is scannable, editor is expansive).
- **Predictable** — repeated patterns, clear hierarchy, consistent actions in consistent places.
- **Flat modern** — subtle borders, soft shadows, rounded corners, no skeuomorphism.
- **Personalizable** — the user picks a theme, but the app stays quiet and unobtrusive.

---

## 2. Layout Structure

VedWriter has **three primary screens**:

1. **Lock Screen** — account setup / unlock / restore.
2. **Dashboard** — list of journals, create new journal.
3. **Workspace** — journal pages list (sidebar) + rich editor (main canvas).

### Global Navigation

- **No persistent left sidebar.**
- Primary navigation is a **top header bar** on the Dashboard and Workspace.
- The **Workspace uses a right-side collapsible sidebar** for the journal's page list.
- Mobile: bottom sheet or drawer for the page list.

---

## 3. Spacing System (Spatial Grid)

We use a **4px base grid** with semantic spacing tokens.

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Inline icon/text gaps, tiny separations |
| `space-2` | 8px | Tight groups (toolbar buttons, meta text) |
| `space-3` | 12px | Small card padding, input gaps |
| `space-4` | 16px | Default padding inside cards and buttons |
| `space-5` | 24px | Section gaps, modal padding |
| `space-6` | 32px | Major section separations |
| `space-7` | 48px | Page-level vertical rhythm |
| `space-8` | 64px | Hero/empty state spacing |

### Layout Containers

- **Max content width:** `1200px` (Dashboard), `1400px` (Workspace).
- **Page horizontal padding:** `32px` desktop, `16px` mobile.
- **Card gap:** `16px` (tight grid), `24px` (loose grid).
- **Header height:** `64px`.
- **Sidebar width:** `320px` (desktop), collapsible on mobile.

---

## 4. Typography

**Font families:**

- **UI / Sans:** `Inter` — clean, highly legible, neutral.
- **Editor / Serif:** `Merriweather` or `Lora` — comfortable for long-form reading.
- **Headings / Display:** `Inter` (semi-bold, tight tracking) — no ornamental serif logo.

**Type scale:**

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display` | 28px | 600 | 1.2 | Screen titles (e.g. "My Journals") |
| `heading` | 20px | 600 | 1.3 | Card titles, section headers |
| `body` | 15px | 400 | 1.6 | Body text, descriptions |
| `body-sm` | 13px | 400 | 1.5 | Meta text, timestamps, captions |
| `label` | 12px | 600 | 1.4 | Uppercase labels, badge text |
| `editor-title` | 26px | 600 | 1.25 | Entry title input |
| `editor-body` | 16px | 400 | 1.8 | Writing canvas |

---

## 5. Themes (6 User-Selectable)

Each theme is a **complete color system**. The UI is designed to look calm and focused in every theme.

### 5.1 Light themes

#### **Paper** (default — warm, studying)
```
--bg-primary: #F7F5F0
--bg-secondary: #FFFFFF
--bg-tertiary: #F0EDE6
--text-primary: #1A1A1A
--text-secondary: #6B6B6B
--text-muted: #9A9A9A
--accent: #8B6F47
--accent-soft: #E8E0D4
--accent-hover: #6B5332
--border: #E5E1D8
--border-strong: #D4CFC4
--shadow: 0 1px 3px rgba(0,0,0,0.04)
--shadow-md: 0 4px 12px rgba(0,0,0,0.06)
```

#### **Cloud** (cool, clinical)
```
--bg-primary: #F8FAFC
--bg-secondary: #FFFFFF
--bg-tertiary: #F1F5F9
--text-primary: #0F172A
--text-secondary: #64748B
--text-muted: #94A3B8
--accent: #475569
--accent-soft: #E2E8F0
--accent-hover: #334155
--border: #E2E8F0
--border-strong: #CBD5E1
--shadow: 0 1px 3px rgba(15,23,42,0.04)
--shadow-md: 0 4px 12px rgba(15,23,42,0.06)
```

#### **Sage** (nature, relaxed)
```
--bg-primary: #F5F7F4
--bg-secondary: #FFFFFF
--bg-tertiary: #EDF1EA
--text-primary: #1C241B
--text-secondary: #5C6B58
--text-muted: #8B9A86
--accent: #556B52
--accent-soft: #DDE6D9
--accent-hover: #3F4F3D
--border: #DDE6D9
--border-strong: #C5D3C0
--shadow: 0 1px 3px rgba(28,36,27,0.04)
--shadow-md: 0 4px 12px rgba(28,36,27,0.06)
```

### 5.2 Dark themes

#### **Ink** (deep, nighttime writing)
```
--bg-primary: #0F0F12
--bg-secondary: #18181B
--bg-tertiary: #232329
--text-primary: #F4F4F5
--text-secondary: #A1A1AA
--text-muted: #71717A
--accent: #D4D4D8
--accent-soft: #27272A
--accent-hover: #FFFFFF
--border: #27272A
--border-strong: #3F3F46
--shadow: 0 1px 3px rgba(0,0,0,0.25)
--shadow-md: 0 4px 12px rgba(0,0,0,0.35)
```

#### **Obsidian** (slate, professional)
```
--bg-primary: #111827
--bg-secondary: #1F2937
--bg-tertiary: #374151
--text-primary: #F9FAFB
--text-secondary: #9CA3AF
--text-muted: #6B7280
--accent: #E5E7EB
--accent-soft: #374151
--accent-hover: #FFFFFF
--border: #374151
--border-strong: #4B5563
--shadow: 0 1px 3px rgba(0,0,0,0.25)
--shadow-md: 0 4px 12px rgba(0,0,0,0.35)
```

#### **Olive Dark** (soft dark, easy on eyes)
```
--bg-primary: #161713
--bg-secondary: #1F211D
--bg-tertiary: #2A2D27
--text-primary: #E8E8E3
--text-secondary: #9BA092
--text-muted: #6F7667
--accent: #B9C4A9
--accent-soft: #2F332B
--accent-hover: #D4DDC8
--border: #2F332B
--border-strong: #444A3F
--shadow: 0 1px 3px rgba(0,0,0,0.25)
--shadow-md: 0 4px 12px rgba(0,0,0,0.35)
```

### Theme Switching Rules

- Theme selector is a **persistent icon button** in the top header.
- Theme is saved to `localStorage` (encrypted settings if possible, or plain localStorage).
- Color tokens are applied to the `:root` element at runtime.
- No flash on load — theme is set before paint.

---

## 6. Components

### 6.1 Header (Global)

```
┌─────────────────────────────────────────────────────────────┐
│  VedWriter                      [Theme] [Backup] [Lock]  │
└─────────────────────────────────────────────────────────────┘
```

- **Height:** 64px.
- **Background:** `--bg-secondary` with 1px bottom border.
- **Left:** Logo wordmark only (no icon clutter).
- **Right:** Theme toggle, Backup/Restore button, Lock button.
- **No breadcrumbs on dashboard.** Workspace shows a subtle back button + journal title.

### 6.2 Buttons

| Variant | Background | Border | Text | Usage |
|---------|------------|--------|------|-------|
| Primary | `--accent` | none | `--bg-primary` | Main CTA (Create journal, New page) |
| Secondary | `--bg-secondary` | `--border-strong` | `--text-primary` | Header actions, cancel |
| Ghost | transparent | transparent | `--text-secondary` | Low-priority actions |
| Danger | transparent | `--accent-red` | `--accent-red` | Delete |

**Button shape:** `10px` radius, `10px 16px` padding, `14px` icon size.

### 6.3 Cards (Flat Modern)

```
┌──────────────────────────────┐
│  ▓▓▓ cover swatch            │
│  Journal Title               │
│  12 entries • Updated 2d ago │
└──────────────────────────────┘
```

- **Background:** `--bg-secondary`.
- **Border:** 1px `--border`.
- **Radius:** 14px.
- **Padding:** 20px.
- **Hover:** subtle shadow, border darkens, translateY(-2px).
- **Cover swatch:** simple top color band (40px tall, rounded 10px) instead of 3D book.
- **Selected state:** 2px `--accent` border.

### 6.4 Inputs

- **Background:** `--bg-secondary`.
- **Border:** 1px `--border-strong`.
- **Radius:** 10px.
- **Focus:** 2px `--accent` outline.
- **Padding:** 12px 14px.

### 6.5 Sidebar (Workspace)

```
┌─────────────────┐ ┌─────────────────────────────────────────┐
│ Pages (24)      │ │                                         │
│ ─────────────── │ │                                         │
│ + New page      │ │   Writing canvas                        │
│                 │ │                                         │
│ Search pages... │ │                                         │
│                 │ │                                         │
│ ▶ Page title 1  │ │                                         │
│   Page title 2  │ │                                         │
│   Page title 3  │ │                                         │
│                 │ │                                         │
└─────────────────┘ └─────────────────────────────────────────┘
```

- **Position:** left side of Workspace.
- **Width:** 320px.
- **Background:** `--bg-secondary`.
- **Border:** 1px right border `--border`.
- **Header:** page count + compact New Page button.
- **Search:** full-width input below header.
- **Page list:** vertical stack, 8px gap.
- **Active page:** `--accent-soft` background, `--accent` left border indicator.
- **Mobile:** collapsible drawer (hamburger icon or swipe).

### 6.6 Editor Canvas

The editor is intentionally **minimal**.

- **Toolbar:** floating pill above the paper, centered, 48px height.
- **Paper:** full-width container, max `820px` centered, `--bg-secondary` background.
- **Shadow:** `--shadow-md` to lift paper off the page.
- **Title:** large serif-style input, placeholder "Title this page...".
- **Body:** contentEditable, comfortable line-height, focus ring only.
- **Tags:** inline below the body, subtle pill badges.
- **Stats:** word count, character count, last saved — bottom-right of paper.

### 6.7 Modals

- **Overlay:** `--bg-primary` at 70% opacity, backdrop blur 8px.
- **Modal card:** `--bg-secondary`, 18px radius, max 520px.
- **Header:** title + close button, bottom border separator.
- **Body:** generous padding (24px–32px).
- **Footer:** action buttons right-aligned.

### 6.8 Toast Notifications

- **Position:** bottom-right, stacked.
- **Radius:** 12px.
- **Left border accent:** green for success, red for error.
- **Animation:** slide up + fade in.

### 6.9 Empty States

- Centered illustration + headline + helper text + primary CTA.
- Use a simple line-art icon (book, pen, lock) in `--text-muted`.

---

## 7. Screen-by-Screen Specifications

### 7.1 Lock Screen

**Layout:** centered card, max 420px.

**Elements:**
- Wordmark "VedWriter" (large, centered).
- Subtitle: "Your private, offline journal."
- Master password input(s).
- Warning box (for setup): clear, calm, not alarmist.
- Primary CTA button.
- Secondary links: "Restore from backup", "Factory reset".

**Spacing:** generous vertical rhythm, card padding 40px.

### 7.2 Dashboard

**Layout:**
- Header.
- Page title row: "My Journals" + "New Journal" button.
- Empty state or grid of journal cards.

**Grid:**
- Desktop: 3 columns (minmax 280px, 1fr).
- Tablet: 2 columns.
- Mobile: 1 column.

**Card content:**
- Cover color swatch.
- Title (heading).
- Entry count + last modified date.
- Hover shows subtle "Open" hint.

### 7.3 Workspace

**Layout:**
- Header with back button, journal title, actions (share, delete, lock).
- Sidebar + main canvas.

**Header:**
- Left: back arrow + journal title + page count.
- Right: share, delete, lock.

**Sidebar:**
- Collapsible on mobile.
- Search + page list.
- "New page" button at top.

**Canvas:**
- Toolbar pill (formatting, theme paper, export, delete).
- Paper sheet.
- Tags.
- Word count / last saved.

---

## 8. Interactions & Motion

- **Micro-interactions:**
  - Buttons: `transform: translateY(-1px)` on hover, `0.15s ease`.
  - Cards: `translateY(-2px)` + shadow increase on hover, `0.2s ease`.
  - Inputs: border color transition on focus, `0.15s ease`.
  - Active page indicator: instant left border + background change.

- **Screen transitions:**
  - Fade-in (200ms) when switching screens.
  - No jarring layout shifts.

- **Skeleton / loading:**
  - Pulse blocks in `--bg-tertiary` for journal cards during initial load.

---

## 9. Accessibility

- Minimum contrast ratio: 4.5:1 for normal text.
- Focus indicators: visible 2px outline on all interactive elements.
- Keyboard navigation: tab order follows visual layout; Enter/Space activate buttons.
- Screen reader: semantic headings, labels for icon-only buttons, `aria-live` for toasts.

---

## 10. Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| ≥1200px | Dashboard 3 columns, sidebar fixed open |
| ≥900px | Dashboard 2–3 columns, sidebar fixed open |
| ≥600px | Dashboard 1–2 columns, sidebar collapsible |
| <600px | Dashboard 1 column, sidebar becomes bottom drawer |

---

## 11. File Plan for Implementation

After approval, the code changes will be:

1. **Theme engine:** `src/theme.js` — load/save theme, apply CSS variables.
2. **Global styles:** rewrite `src/index.css` with new tokens and component classes.
3. **App layout:** refactor `src/App.jsx` into Header + screen router.
4. **Components:**
   - `Header.jsx` — global top bar with theme switcher.
   - `JournalCard.jsx` — flat modern card (replaces `JournalCover.jsx`).
   - `Sidebar.jsx` — workspace page list.
   - `Editor.jsx` — minimal toolbar + paper (evolution of `RichEditor.jsx`).
   - `Modal.jsx` — base modal shell.
   - `CreateJournalModal.jsx`, `ShareBackupModal.jsx`, `ThemePicker.jsx`.
5. **Remove:** unused 3D book CSS and heavy glassmorphism.

---

## 12. Approval Checklist

- [ ] 6 themes approved (or theme count adjusted).
- [ ] Flat modern cards approved (no 3D book covers).
- [ ] Header-only navigation approved (no left sidebar).
- [ ] Workspace sidebar position approved (left, collapsible).
- [ ] Typography and spacing feel approved.
- [ ] Ready to proceed to React implementation.

---

*Next step: open `mockup/index.html` in a browser to interact with the visual mockup.*
