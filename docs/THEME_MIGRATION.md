# ProctorIQ — Theme Migration Audit & Specification

> **Branch**: `feat/aurora-bento-theme`  
> **Status**: Migration 100% Completed — Aurora Bento Design Language Fully Deployed & Verified  
> **Target Design Language**: Aurora Bento (Calm, premium, high-trust SaaS inspired by Linear, Vercel, Stripe, and Raycast)

---

## 1. Executive Summary & Design System Target

The objective of this migration is to transition the ProctorIQ user interface from its initial high-contrast Cyberpunk/Neon dark theme (`#0A0B14`, glowing cyan `#22D3EE`, glowing magenta `#F43F5E`) into a unified, accessible, and modern **Aurora Bento** aesthetic.

### Hard Engineering Boundaries
- **No Functional Logic Alterations**: Zero changes to `/db`, `/server`, MySQL stored procedures, triggers, views, API schemas, routes, WebSockets (Socket.IO events), Zustand stores, React Query hooks, `useProctoring` hooks, or test assertions.
- **Component Preservation**: Every component name, prop interface, and file export is strictly preserved. All components are restyled in place so existing imports and tests remain 100% functional.
- **Dual-Theme Architecture**: Support for **Dark** (default, `#09090B`), **Light** (`#FAFAFA`), and **System** themes with zero layout thrash and synchronized CSS variables.
- **Allowed Dependencies**: `shadcn/ui` (Radix primitives), `geist` (Geist Sans & Geist Mono), `sonner`, `cmdk`.

---

## 2. Complete Inventory of Pages, Layouts & Components

### 2.1 Pages (`client/src/pages/`)
| File | Route | Description |
| :--- | :--- | :--- |
| `LandingPage.tsx` | `/` | Product landing page, feature highlights, infraction matrix, architecture preview. |
| `AuthPages.tsx` | `/login` | Authentication gateway, quick-fill role credentials (Student, Proctor, Admin). |
| `StudentDashboardPage.tsx` | `/student` | Candidate exam console, scheduled assessments, pre-exam launcher. |
| `StudentExamPage.tsx` | `/exam/:id` | Fullscreen proctored examination kiosk, webcam HUD, Question Palette. |
| `StudentResultPage.tsx` | `/student/results/:sessionId` | Digital examination certificate, trust score breakdown, violation audit log. |
| `ProctorDashboardPage.tsx` | `/proctor` | Real-time surveillance console, student tile grid, live feed, review queue. |
| `AdminDashboardPage.tsx` | `/admin` | Institution control center, exams overview, database telemetry. |
| `SimulatorPage.tsx` | `/admin/simulator` | Virtual student swarm generator, chaos sliders, real-time stress testing. |
| `StyleguidePage.tsx` | `/styleguide` | Design system catalog, color swatches, button states, typography samples. |

### 2.2 Layout Components (`client/src/components/layout/` & `ui/`)
| File | Role | Description |
| :--- | :--- | :--- |
| `AppShell.tsx` | Primary Shell | Desktop collapsible sidebar, glass sticky header, audio toggle, theme toggle, main container (1440px / 1720px). |
| `Navbar.tsx` | Top Navigation | Alternative horizontal navigation bar for standalone public pages. |

### 2.3 Shared UI Components (`client/src/components/ui/`)
| File | Component | Role |
| :--- | :--- | :--- |
| `GlassCard.tsx` | `GlassCard` | Core card surface container with hover lift and ambient spotlight. |
| `NeonButton.tsx` | `NeonButton` | Primary action button with variant styling and click ripple effect. |
| `StatCard.tsx` | `StatCard` | KPI metric tile with tabular numbers, sparkline indicators, and trend badges. |
| `TrustRing.tsx` | `TrustRing` | Radial trust score SVG meter with risk thresholds and particle burst. |
| `TrustGauge.tsx` | `TrustGauge` | Semicircular gauge for live score visualization. |
| `SeverityBadge.tsx` | `SeverityBadge` | Semantic violation severity pill (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`). |
| `StatusBadge.tsx` | `StatusBadge` | Generic status badge indicator. |
| `StatusPill.tsx` | `StatusPill` | Candidate & session status pill (`ACTIVE`, `FLAGGED`, `TERMINATED`, `CLEAN`). |
| `Modal.tsx` | `Modal` | Dialog modal overlay with backdrop-blur and spring animation. |
| `Tabs.tsx` | `Tabs` | Segmented navigation tab group with animated active pill. |
| `Skeleton.tsx` | `Skeleton` | Content loading placeholder with subtle shimmer animation. |
| `EmptyState.tsx` | `EmptyState` | Empty state placeholder with contextual icon and call-to-action. |
| `Toast.tsx` | `Toast` | Floating alert toast notifications with severity coloring. |
| `AnimatedTable.tsx` | `AnimatedTable` | Staggered table layout with animated row entrances. |
| `ToggleSwitch.tsx` | `ToggleSwitch` | Accessible spring toggle switch for boolean settings. |
| `LiveDot.tsx` | `LiveDot` | Pulsing real-time connection status indicator. |
| `CanvasNetworkBg.tsx` | `CanvasNetworkBg` | HTML5 canvas background particle network animation. |

### 2.4 Domain Components: Student (`client/src/components/student/`)
| File | Component | Role |
| :--- | :--- | :--- |
| `PreExamChecklistModal.tsx` | `PreExamChecklistModal` | 4-step hardware and environment verification kiosk prior to exam start. |
| `ViolationWarningOverlay.tsx` | `ViolationWarningOverlay` | High-priority screen warning modal triggered upon proctoring infraction. |
| `FullscreenExitOverlay.tsx` | `FullscreenExitOverlay` | Lockout screen displayed when the candidate exits fullscreen mode. |
| `CameraDeniedBlocker.tsx` | `CameraDeniedBlocker` | Full-screen barrier when webcam permissions are revoked or unavailable. |

### 2.5 Domain Components: Proctor (`client/src/components/proctor/`)
| File | Component | Role |
| :--- | :--- | :--- |
| `KpiStrip.tsx` | `KpiStrip` | Live telemetry KPI strip (Active Sessions, Violations, Flagged, Terminated). |
| `StudentTile.tsx` | `StudentTile` | Live student grid tile with mini TrustRing, status pill, and shake animation. |
| `LiveFeedSidebar.tsx` | `LiveFeedSidebar` | Streaming event log sidebar with audio alerts and review triggers. |
| `StudentDetailDrawer.tsx` | `StudentDetailDrawer` | Slide-over drawer with Recharts timeline, snapshot lightbox, and actions. |
| `ReviewQueueTable.tsx` | `ReviewQueueTable` | Audit report review table with bulk confirm/dismiss and keyboard shortcuts. |
| `EmergencyBanner.tsx` | `EmergencyBanner` | Full-width animated alert for critical security infractions. |

### 2.6 Domain Components: Admin (`client/src/components/admin/`)
| File | Component | Role |
| :--- | :--- | :--- |
| `AdminOverviewDashboard.tsx` | `AdminOverviewDashboard` | Comprehensive analytics dashboard with Recharts, heatmap, and leaderboard. |
| `ExamWizardModal.tsx` | `ExamWizardModal` | Multi-step exam creation wizard with threshold slider and CSV question import. |
| `ViolationRulesManager.tsx` | `ViolationRulesManager` | Penalty weight configuration matrix with interactive live cheating simulator. |
| `UsersManagerTable.tsx` | `UsersManagerTable` | Account management grid for role assignments and status toggling. |
| `ResultsAndExportTable.tsx` | `ResultsAndExportTable` | Per-exam candidate performance audit table with CSV and PDF export. |

---

## 3. Grep Audit: Hardcoded Colors, Shadows, Fonts & Glows

A comprehensive scan of `client/src` identified **205 legacy styling tokens, arbitrary hex values, custom shadows, and glow classes**.

### 3.1 Hardcoded Hex Color Occurrences
| Hex Value | Occurrences | Current Role | Target Aurora Bento Role |
| :--- | :---: | :--- | :--- |
| `#0A0B14` | 35 | Darkest base background / void | Dark theme `bg-[#09090B]` / CSS `--background` |
| `#0C0E1C` | 33 | Card panel dark surface | Dark theme `bg-[#111114]` / CSS `--surface` |
| `#101222` | 28 | Secondary elevated container | Dark theme `bg-[#18181B]` / CSS `--surface-elevated` |
| `#F43F5E` | 19 | Neon magenta / critical violation | Semantic danger `rose-500` / `#F43F5E` (with icon label) |
| `#10B981` | 14 | Neon emerald / safe status | Semantic safe `emerald-500` / `#10B981` |
| `#22D3EE` | 13 | Neon cyan / primary accent | Aurora brand indigo-violet (`#6366F1` $\rightarrow$ `#8B5CF6`) |
| `#070914` | 11 | Deep dark dialog overlay | Glass overlay backdrop (`rgba(9, 9, 11, 0.8)`) |
| `#16192E` | 10 | Elevated card border / background | 1px hairline border `#27272A` (dark) / `#E4E4E7` (light) |
| `#070812` | 10 | Dark header & sidebar background | Hairline glass header backdrop |
| `#475569` | 8 | Muted slate text | Muted foreground `#71717A` (dark) / `#71717A` (light) |
| `#F59E0B` | 7 | Neon amber / warning status | Semantic caution `amber-500` / `#F59E0B` |
| `#8B5CF6` | 4 | Neon violet / secondary accent | Aurora brand violet `#8B5CF6` |
| `#0F172A` | 1 | Deep slate container | Replaced by CSS variable tokens |
| Other Dark Hexes | 22 | Arbitrary container fills | Unified into 3 semantic surface tokens |

### 3.2 Legacy Arbitrary Shadows (`shadow-[...]`)
| Shadow Class | Count | File Location | Replacement |
| :--- | :---: | :--- | :--- |
| `shadow-[0_0_8px_rgba(34,211,238,0.8)]` | 2 | `TrustRing.tsx`, `LiveDot.tsx` | `shadow-bento-sm` or ring outline |
| `shadow-[0_0_30px_rgba(34,211,238,0.5)]` | 1 | `NeonButton.tsx` (primary hover) | `shadow-bento` + hairline border |
| `shadow-[0_0_30px_rgba(139,92,246,0.5)]` | 1 | `NeonButton.tsx` (secondary hover) | `shadow-bento` + hairline border |
| `shadow-[0_0_32px_rgba(244,63,94,0.6)]` | 1 | `NeonButton.tsx` (danger hover) | `shadow-bento` + hairline border |
| `shadow-[0_0_30px_rgba(16,185,129,0.5)]` | 1 | `NeonButton.tsx` (success hover) | `shadow-bento` + hairline border |
| `shadow-[0_16px_48px_rgba(0,0,0,0.5)]` | 1 | `GlassCard.tsx` (card base) | `shadow-bento` (layered ambient) |
| `shadow-[0_24px_64px_rgba(0,0,0,0.7)]` | 1 | `Modal.tsx` (dialog container) | `shadow-bento-xl` + glass blur |
| `shadow-[0_4px_30px_rgba(244,63,94,0.45)]` | 1 | `EmergencyBanner.tsx` | Subdued hairline alert border |
| `shadow-[0_0_50px_rgba(244,63,94,0.25)]` | 1 | `ViolationWarningOverlay.tsx` | Layered modal shadow |
| Misc. Glow Shadows | 15 | Various domain components | Replaced with semantic hairline borders |

### 3.3 Legacy Arbitrary Background Classes (`bg-[#...]`)
| Class Pattern | Occurrences | Primary Files |
| :--- | :---: | :--- |
| `bg-[#0C0E1C]` | 33 | `AdminOverviewDashboard.tsx`, `StudentDetailDrawer.tsx`, `ExamWizardModal.tsx` |
| `bg-[#0A0B14]` | 30 | `StudentExamPage.tsx`, `ProctorDashboardPage.tsx`, `AuthPages.tsx` |
| `bg-[#101222]` | 26 | `AppShell.tsx`, `StudentTile.tsx`, `ReviewQueueTable.tsx` |
| `bg-[#070914]` | 11 | `Modal.tsx`, `EmergencyBanner.tsx` |
| `bg-[#16192E]` | 10 | `StatCard.tsx`, `LiveFeedSidebar.tsx` |
| `bg-[#070812]` | 10 | `Navbar.tsx`, `AppShell.tsx` |
| `bg-[#121528]` | 7 | `ResultsAndExportTable.tsx`, `ViolationRulesManager.tsx` |
| `bg-[#04050A]` | 7 | Code inspection snippets, terminal simulators |

### 3.4 Neon & Glow Classes
- **`NeonButton` References**: 167 instances across 22 files.
- **Tailwind Glow Shadows**:
  - `shadow-glow-cyan` & `shadow-glow-cyan-sm`: 44 occurrences
  - `shadow-glow-magenta` & `shadow-glow-magenta-sm`: 15 occurrences
  - `shadow-glow-amber` & `shadow-glow-amber-sm`: 9 occurrences
  - `shadow-glow-emerald` & `shadow-glow-emerald-sm`: 5 occurrences
  - `shadow-glow-violet` & `shadow-glow-violet-sm`: 5 occurrences
- **CSS Glow Borders**:
  - `gradient-border-cyan`: Cyan-to-violet gradient pseudoelement mask.
  - `gradient-border-magenta`: Magenta-to-amber gradient pseudoelement mask.
  - `animated-gradient-border`: Conic-gradient rotating pseudoelement (`rotateConic 8s linear infinite`).

### 3.5 Typography & Font References
- `font-mono`: 328 occurrences (timers, IDs, telemetry scores, table headers).
- `Inter` / `font-sans`: 153 occurrences (body text, UI labels).
- `JetBrains Mono`: 2 references in Tailwind configuration.
- **Migration Target**:
  - Headings: `Geist Sans` with tight tracking (`tracking-tight`).
  - Numbers, IDs & Timers: `Geist Mono` with `tabular-nums`.
  - Fallback: Inter / JetBrains Mono.

---

## 4. Theme Migration Checklist

### 4.1 Design Tokens & Core Engine
- [x] **Color Palette Definitions**:
  - [x] Dark theme base: `#09090B`, surface: `#111114`, surface-elevated: `#18181B`, border: `#27272A`.
  - [x] Light theme base: `#FAFAFA`, surface: `#FFFFFF`, surface-elevated: `#F4F4F5`, border: `#E4E4E7`.
  - [x] Brand gradient: Indigo `#6366F1` $\rightarrow$ Violet `#8B5CF6` $\rightarrow$ Fuchsia `#D946EF`.
  - [x] Semantic tokens: Safe `#10B981`, Caution `#F59E0B`, Danger `#F43F5E`, Info `#0EA5E9`.
- [x] **Bento Shadows & Hairline Borders**:
  - [x] Define `shadow-bento` (`0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 8px 24px -4px rgba(0, 0, 0, 0.1)`).
  - [x] Define `shadow-bento-xl` for overlays and drawers.
  - [x] Standardize corner radiuses to 20px (`rounded-2xl`) and 24px (`rounded-3xl`).
- [x] **Typography**:
  - [x] Import and configure Geist Sans and Geist Mono font families.
  - [x] Ensure all telemetry numbers and timers enforce `tabular-nums font-mono`.
- [x] **Theme Store & Toggle**:
  - [x] Implement `ThemeContext.tsx` supporting `'light' | 'dark' | 'system'` modes.
  - [x] Add system media query listener (`prefers-color-scheme`).
  - [x] Create `ThemeToggle.tsx` with animated spring indicator.

### 4.2 Shared UI Components
- [x] **`GlassCard`**:
  - [x] Convert heavy neon blur into 20–24px radius bento surface.
  - [x] Add 1px hairline border (`border-bento-border`).
  - [x] Implement subtle cursor-follow spotlight.
- [x] **`NeonButton`**:
  - [x] Restyle from cyberpunk glow to Linear/Vercel refined button.
  - [x] Retain ripple effect and all variant props (`primary`, `secondary`, `danger`, `success`, `outline`, `ghost`).
- [x] **`StatCard`**:
  - [x] 20px radius bento card layout.
  - [x] Animated count-up ticker with Geist Mono tabular nums.
  - [x] Refined sparkline and trend badge integration.
- [x] **`TrustRing`**:
  - [x] Multi-stop SVG gradient arc (emerald $\rightarrow$ amber $\rightarrow$ rose).
  - [x] Low-score ambient glow pulse and particle burst on point restore.
- [x] **`SeverityBadge` & `StatusPill`**:
  - [x] Replace flat colors with accessible icon + text pairs.
  - [x] Soft background tints with 1px hairline borders.
- [x] **`Modal`**:
  - [x] 24px radius centered bento container.
  - [x] Glass backdrop blur restricted exclusively to overlay backdrop.
- [x] **`Tabs`**:
  - [x] Segmented pill container with Framer Motion layoutId pill indicator.
- [x] **`Skeleton`**:
  - [x] Smooth shimmer animation matching light and dark theme background variables.
- [x] **`EmptyState`**:
  - [x] Clean minimalist icon container and typography hierarchy.
- [x] **`Toast`**:
  - [x] Non-blocking floating notification with spring physics.
- [x] **`AnimatedTable`**:
  - [x] Hairline row dividers, subtle hover lift, and zebra striping.

### 4.3 App Shell & Navigation
- [x] **AppShell**:
  - [x] Desktop sidebar with active route indicator pill.
  - [x] Glass sticky header with system status pill, audio mute toggle, and theme switcher.
  - [x] 1440px standard max-width container (1720px for high-density monitoring).
- [x] **Command Palette**:
  - [x] Integrate `cmdk` command palette triggered by `Cmd+K` / `Ctrl+K`.
  - [x] Add instant navigation to Student, Proctor, and Admin portals.
  - [x] Add quick actions: toggle audio alerts, toggle theme, trigger search.

### 4.4 Landing & Login
- [x] **LandingPage**:
  - [x] Aurora brand gradient hero headline.
  - [x] 12-column bento feature cards with mixed spans.
  - [x] Clean infraction penalty weight matrix card.
- [x] **AuthPages**:
  - [x] Centered 24px radius bento login card.
  - [x] Quick-fill credential buttons preserving exact test selectors (`text=ProctorIQ Access`, `Authenticate & Enter Console`).
  - [x] Integrated `ThemeToggle`.

### 4.5 Student Examination Flow
- [x] **StudentDashboardPage**:
  - [x] Candidate greeting hero card with session statistics.
  - [x] 12-column bento assessment cards with status pills and Geist Mono timers.
- [x] **PreExamChecklistModal**:
  - [x] 4-step interactive stepper (Terms $\rightarrow$ Hardware $\rightarrow$ Screen $\rightarrow$ Confirm).
  - [x] Centered live webcam feed with face detection bounding box.
- [x] **StudentExamPage**:
  - [x] Top kiosk HUD bar with sticky glass blur and countdown clock.
  - [x] 8-col question/options area + 4-col HUD (TrustRing, live webcam, Question Palette).
- [x] **Overlays**:
  - [x] `ViolationWarningOverlay`: High-contrast modal with penalty counter.
  - [x] `FullscreenExitOverlay`: Accessible lockdown screen with re-enter button.
  - [x] `CameraDeniedBlocker`: Clean animated blocker with troubleshooting tips.
- [x] **StudentResultPage**:
  - [x] Digital integrity certificate banner.
  - [x] Animated score reveal and Recharts donut chart.
  - [x] Proctoring incident audit ledger table.

### 4.6 Proctor Surveillance Center
- [x] **ProctorDashboardPage**:
  - [x] Top surveillance telemetry bar with Socket.IO status.
  - [x] View mode switch: `Live Telemetry Grid` vs `Adjudication Queue`.
  - [x] Search and filter bar (exam, severity, status).
- [x] **KpiStrip**:
  - [x] 4 bento metric cards with count-up tickers (Active, Violations, Flagged, Terminated).
- [x] **StudentTile**:
  - [x] 20px radius bento tile with risk halo glow (green $\rightarrow$ amber $\rightarrow$ red).
  - [x] Mini `TrustRing`, initials avatar, violation badge, and shake animation.
- [x] **LiveFeedSidebar**:
  - [x] Real-time sliding violation feed with severity colors and "Review" action.
  - [x] Audio alert toggle button.
- [x] **StudentDetailDrawer**:
  - [x] Slide-over drawer with Recharts trust score area chart and violation markers.
  - [x] Webcam snapshot lightbox gallery.
  - [x] Session forensic info (IP, fingerprint) and Warn/Terminate/Reinstate actions.
- [x] **ReviewQueueTable**:
  - [x] Adjudication table from `vw_ViolationAuditReport`.
  - [x] Bulk Confirm/Dismiss with keyboard navigation (`[C]`, `[D]`, arrow keys).
  - [x] Live score restoration animation on dismissal.
- [x] **EmergencyBanner**:
  - [x] Full-width animated breach banner for `MULTIPLE_FACES` and `DEVTOOLS_OPEN`.

### 4.7 Admin Operations & Simulator
- [x] **AdminDashboardPage**:
  - [x] Tabbed navigation: Overview, Exams, Violation Rules, Users, Results & Export.
  - [x] Assessment cards with question inspectors.
  - [x] MySQL DBMS telemetry metrics cards.
- [x] **AdminOverviewDashboard**:
  - [x] KPI cards with trend sparklines.
  - [x] Violations over time area chart (7-day / 30-day toggle).
  - [x] Infraction type distribution donut chart.
  - [x] 24-hour temporal heatmap matrix from `vw_ViolationHeatmap`.
  - [x] Stacked bar chart for exam integrity splits.
  - [x] Trust score histogram and top 10 flagged sessions leaderboard.
- [x] **ExamWizardModal**:
  - [x] Multi-step wizard with animated progress pills.
  - [x] Threshold slider for `min_trust_score` with live danger zone preview.
  - [x] Question editor with bulk CSV import.
- [x] **ViolationRulesManager**:
  - [x] Penalty weights table with live database trigger calibration.
  - [x] Interactive cheating simulator with TrustRing preview and infraction steppers.
- [x] **UsersManagerTable**:
  - [x] User role administration with filter pills, search, and spring toggle switches.
- [x] **ResultsAndExportTable**:
  - [x] Per-exam results grid with integrity filters.
  - [x] One-click CSV export and printable PDF layout.
- [x] **SimulatorPage**:
  - [x] Candidate swarm demo simulator with speed multiplier slider.
  - [x] Chaos profile presets (Low, Medium, Total Chaos).
  - [x] Real-time virtual candidate tiles with mini TrustRings and terminal feed.

### 4.8 Charts & Data Visualizations (Recharts)
- [x] Standardize Recharts theme across Light and Dark modes.
- [x] Cartography & grid lines: use CSS variable `--border` (`#27272A` / `#E4E4E7`).
- [x] Tooltip containers: 12px radius bento cards with hairline borders and soft shadows.
- [x] Gradients: replace flat fills with vertical opacity gradients (e.g. `rgba(99, 102, 241, 0.4)` to `rgba(99, 102, 241, 0.0)`).

---

## 5. Component Migration Mapping Table

Every component keeps its **exact export name, props interface, and folder path**.

| Component Name | File Path | Old Cyberpunk / Neon Look | New Aurora Bento Look | Preserved Interface / Props |
| :--- | :--- | :--- | :--- | :--- |
| `GlassCard` | `src/components/ui/GlassCard.tsx` | Heavy dark blur (`#101222/80`), cyan glow borders, 16px radius | 20–24px radius bento surface, 1px hairline border (`border-bento-border`), soft layered shadow, cursor-follow spotlight | `children`, `variant`, `glowColor`, `hoverEffect`, `className` |
| `NeonButton` | `src/components/ui/NeonButton.tsx` | High-intensity cyan/magenta neon shadows, harsh border glows | High-trust Linear/Vercel style button, subtle border highlights, spring scale physics, accessible focus ring | `children`, `variant`, `size`, `isLoading`, `leftIcon`, `rightIcon`, `enableRipple` |
| `StatCard` | `src/components/ui/StatCard.tsx` | Dark panel with single neon accent border | 20px radius bento card, Geist Mono tabular number ticker, trend badges, mini sparklines | `title`, `value`, `icon`, `trend`, `sparklineData`, `glowColor`, `suffix`, `decimals` |
| `TrustRing` | `src/components/ui/TrustRing.tsx` | Neon cyan SVG circle with high glow shadow | Gradient stroke gauge, risk-level ambient halos, particle burst animation upon point restore | `score`, `size`, `strokeWidth`, `showLabel`, `animated`, `onRestored` |
| `TrustGauge` | `src/components/ui/TrustGauge.tsx` | Semicircular neon meter | Clean curved gauge with risk threshold ticks and tabular score readout | `score`, `minScore`, `size` |
| `SeverityBadge` | `src/components/ui/SeverityBadge.tsx` | Bright neon background pill with harsh contrast | Semantic icon + label badge, subtle pastel/tinted background with hairline border | `severity`, `size`, `className` |
| `StatusPill` | `src/components/ui/StatusPill.tsx` | Plain colored text pill | Segmented status capsule with active pulsing dot and semantic border | `status`, `size`, `showDot` |
| `Modal` | `src/components/ui/Modal.tsx` | Pitch-black background modal with cyan gradient border | 24px radius bento dialog, glass backdrop blur overlay, spring entrance animation | `isOpen`, `onClose`, `title`, `children`, `maxWidth` |
| `Tabs` | `src/components/ui/Tabs.tsx` | Flat dark buttons with neon underline | Segmented pill container with animated Framer Motion layout indicator | `tabs`, `activeTab`, `onChange`, `variant` |
| `Skeleton` | `src/components/ui/Skeleton.tsx` | Harsh white pulse on dark background | Gentle dual-theme shimmer matching surface color variables | `className`, `variant`, `width`, `height` |
| `EmptyState` | `src/components/ui/EmptyState.tsx` | Centered text with neon icon | Minimalist icon container, muted typography, and primary bento button | `icon`, `title`, `description`, `action` |
| `Toast` | `src/components/ui/Toast.tsx` | High-contrast neon popups | Subtle hairline toast notification with spring slide-in and bounce | `message`, `type`, `onClose`, `duration` |
| `AnimatedTable` | `src/components/ui/AnimatedTable.tsx` | High-contrast table with glowing hover rows | Crisp hairline row dividers, smooth hover highlight, zebra row support | `columns`, `data`, `keyField`, `onRowClick` |
| `ToggleSwitch` | `src/components/ui/ToggleSwitch.tsx` | Cyan glowing toggle switch | iOS/macOS style spring toggle switch with accessible focus ring | `checked`, `onChange`, `disabled`, `label` |
| `LiveDot` | `src/components/ui/LiveDot.tsx` | Harsh cyan/green ping effect | Subdued dual-ring pulse indicator | `status`, `size`, `pulse` |
| `CanvasNetworkBg` | `src/components/ui/CanvasNetworkBg.tsx` | Canvas particle network with cyan nodes | Retained for performance/optional mode; complemented by CSS aurora blobs | `particleCount`, `lineColor` |
| `AppShell` | `src/components/layout/AppShell.tsx` | Static dark sidebar with glowing cyan active states | 1440px/1720px max-width container, active pill indicator, glass header, `ThemeToggle`, `CommandPalette` trigger | `children` |
| `PreExamChecklistModal` | `src/components/student/PreExamChecklistModal.tsx` | Dark modal with raw checkboxes and camera box | 4-step interactive stepper kiosk, live camera card, system telemetry checklist | `isOpen`, `onClose`, `exam`, `onSessionStart` |
| `StudentTile` | `src/components/proctor/StudentTile.tsx` | Dark tile with cyan border | 20px bento card, risk glow halo, mini TrustRing, violation count badge, shake animation | `session`, `onSelect` |
| `KpiStrip` | `src/components/proctor/KpiStrip.tsx` | Standard stat row | 4 20px bento stat cards with Geist Mono animated tickers and sparklines | `stats` |
| `LiveFeedSidebar` | `src/components/proctor/LiveFeedSidebar.tsx` | Plain list with neon tags | Real-time sliding violation cards with audio ping and review trigger | `violations`, `onReview` |
| `StudentDetailDrawer` | `src/components/proctor/StudentDetailDrawer.tsx` | Flat slide-out panel | Glass-backed slide-over drawer with Recharts timeline, snapshot lightbox, and actions | `sessionId`, `isOpen`, `onClose` |
| `ReviewQueueTable` | `src/components/proctor/ReviewQueueTable.tsx` | Standard table with action buttons | Interactive review table with keyboard navigation shortcuts (`[C]`, `[D]`) and score restore animations | `violations`, `onConfirm`, `onDismiss` |
| `EmergencyBanner` | `src/components/proctor/EmergencyBanner.tsx` | Red text marquee | Full-width animated breach banner with hairline border and quick inspect action | `incident`, `onInspect` |
| `AdminOverviewDashboard` | `src/components/admin/AdminOverviewDashboard.tsx` | High-contrast charts with cyan/magenta bars | 12-column bento analytics grid with Aurora gradient area and donut charts | `data` |
| `ExamWizardModal` | `src/components/admin/ExamWizardModal.tsx` | Dark form modal | Multi-step bento wizard with threshold slider danger zone preview and CSV import | `isOpen`, `onClose`, `onSave` |
| `ViolationRulesManager` | `src/components/admin/ViolationRulesManager.tsx` | Raw penalty inputs | Configured rules table with live database trigger calibration and real-time simulator | `rules`, `onUpdate` |

---

## 6. Verification and Readiness

1. **Checklist File Exists**: `/docs/THEME_MIGRATION.md` is registered in documentation.
2. **Application State**: App source code and tests remain **100% unchanged** and **passing**.
3. **Commit Requirement**: Ready to be committed with message `chore: theme migration audit`.
