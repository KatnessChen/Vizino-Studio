# Design Tokens — Interior Painting Designer

Tokens actually defined in `styles/variables.css` and used across the project.
Tailwind CSS v4 utility classes are the primary styling mechanism; these CSS variables extend it.

## Layout Dimensions

| Token | Value | Usage |
|-------|-------|-------|
| `--header-height` | `52px` | App header; use `calc(100vh - var(--header-height))` for full-height panels |
| `--footer-height` | `54px` | App footer |

## Brand Colors

| Token | Value | Tailwind equivalent | Usage |
|-------|-------|---------------------|-------|
| `--brand-indigo` | `#4f46e5` | `indigo-600` | Primary actions, Generate button text |
| `--brand-violet` | `#7c3aed` | `violet-600` | Gradient accent |
| `--brand-purple` | `#9333ea` | `purple-600` | Gradient accent |
| `--brand-accent-light` | `#f5f3ff` | `violet-50` | Selected item backgrounds |
| `--brand-accent-ring` | `rgba(124,58,237,0.18)` | — | Focus rings on brand elements |

## Tailwind Color Palette (commonly used in this project)

| Category | Tailwind class | Hex | Usage |
|----------|---------------|-----|-------|
| Background | `bg-white` | `#ffffff` | Cards, modals |
| Background | `bg-gray-50` | `#f9fafb` | Page backgrounds |
| Background | `bg-gray-100` | `#f3f4f6` | Input backgrounds, empty states |
| Border | `border-gray-200` | `#e5e7eb` | Default borders |
| Text primary | `text-slate-900` | `#0f172a` | Headings, primary labels |
| Text secondary | `text-slate-700` | `#334155` | Body text |
| Text muted | `text-gray-500` | `#6b7280` | Placeholder, helper text |
| Text disabled | `text-gray-400` | `#9ca3af` | Disabled state |
| Primary action | `bg-indigo-600` | `#4f46e5` | Primary buttons |
| Primary hover | `hover:bg-indigo-700` | `#4338ca` | Button hover |
| Error | `text-red-500` | `#ef4444` | Error messages |
| Success | `text-green-500` | `#22c55e` | Success messages |
| Warning | `text-yellow-500` | `#eab308` | Warning messages |
| Info | `text-blue-500` | `#3b82f6` | Info messages |

## Spacing Scale (Tailwind)

| Token | Value | Usage |
|-------|-------|-------|
| `p-2` / `gap-2` | `8px` | Tight internal padding |
| `p-3` / `gap-3` | `12px` | Card internal padding |
| `p-4` / `gap-4` | `16px` | Section padding |
| `p-6` / `gap-6` | `24px` | Panel padding (standard for aside/gallery) |
| `p-8` / `gap-8` | `32px` | Large section spacing |

## Typography

| Element | Tailwind classes | Notes |
|---------|-----------------|-------|
| Page heading (h1) | `text-2xl font-bold text-slate-900` | Use Ant Design `Typography.Title level={2}` |
| Section heading (h4/h5) | `text-base font-semibold text-slate-900` | Use `Typography.Title level={4/5}` |
| Body text | `text-sm text-slate-700` | Default prose |
| Caption / helper | `text-xs text-gray-500` | Below inputs, image metadata |
| Monospace / code | `font-mono text-sm` | Prompt text, hex values |

## Border Radius

| Tailwind class | Value | Usage |
|---------------|-------|-------|
| `rounded` | `4px` | Tags, small badges |
| `rounded-md` | `6px` | Buttons, inputs, cards |
| `rounded-lg` | `8px` | Modals, panels |
| `rounded-xl` | `12px` | Large gallery cards |
| `rounded-full` | `9999px` | Avatars, pill badges |

## Shadows

| Tailwind class | Usage |
|---------------|-------|
| `shadow-sm` | Cards, buttons (subtle elevation) |
| `shadow-md` | Dropdowns, active cards |
| `shadow-lg` | Modals, popovers |

## Component-Specific Utility Classes

Defined in `styles/variables.css` — use these class names directly:

| Class | Usage |
|-------|-------|
| `.btn-generate` | Generate button gradient (light indigo→violet) |
| `.btn-disabled` | Disabled state for Generate button |

## How to Add New Tokens

1. Add CSS custom property to `styles/variables.css`:
   ```css
   :root {
     --my-new-token: value;
   }
   ```
2. Update this file with the new token.
3. If a Tailwind utility class is needed, extend via `@theme` in `styles/main.css` (Tailwind v4 syntax):
   ```css
   @theme {
     --color-brand: var(--my-new-token);
   }
   ```
   Then use `bg-brand`, `text-brand`, etc. in Tailwind classes.
