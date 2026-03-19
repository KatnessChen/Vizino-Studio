---
name: ui-ux-designer
description: "UI/UX design skill for React + TypeScript components. Use when: designing new components, generating component specs, defining design tokens, planning responsive layouts, auditing accessibility (WCAG 2.1 AA), or creating visual specs. Creates structured design deliverables including component API (props/events), visual tokens, responsive breakpoints, and acceptance criteria."
argument-hint: "component name or design task (e.g. 'ImageCard component' or 'color picker responsive layout')"
---

# UI/UX Designer Skill

## When to Use

Invoke this skill when the request involves:
- Designing a **new UI component** (structure, props, states, interactions)
- Generating a **component spec document** (API, visual tokens, acceptance criteria)
- Defining or updating **design system tokens** (colors, spacing, typography)
- Planning **responsive layouts** for mobile / tablet / desktop
- **Accessibility auditing** or adding ARIA roles to existing components
- Reviewing existing UI for design consistency

## Procedure

### 1. Clarify Scope

Identify what the user needs:
- New component → follow [Component Design](#component-design-workflow)
- Design tokens → follow [Token Definition](#token-definition-workflow)
- Responsive layout → follow [Responsive Planning](#responsive-planning-workflow)
- Accessibility audit → follow [A11y Audit](#a11y-audit-workflow)

### 2. Explore Codebase Context

Before designing, gather:
- Existing similar components in `components/` to avoid duplication
- Current Tailwind tokens in `styles/variables.css` and `styles/main.css`
- Ant Design components already in use (preferred UI library)
- Brand colors and spacing conventions from `constants/constants.ts`

### 3. Produce Deliverables

Follow the appropriate workflow below and produce the required output sections.

---

## Component Design Workflow

Output these sections in order:

### Design Summary (2–3 sentences)
State the component's purpose, primary user goal, and key design decision rationale.

### Component API

```tsx
interface ComponentNameProps {
  // List every prop with its type, whether required, and a brief description
  propName: type;       // required — description
  optionalProp?: type;  // optional — description, default: value
}
```

Also list emitted events / callbacks:

| Event | Signature | Description |
|-------|-----------|-------------|
| `onChange` | `(value: T) => void` | Fired when … |

### States & Variants

| State | Visual | Notes |
|-------|--------|-------|
| Default | … | … |
| Hover | … | … |
| Focus | … | … |
| Loading | … | … |
| Error | … | … |
| Empty | … | … |
| Disabled | … | … |

### Visual Tokens

Reference [design-tokens.md](./references/design-tokens.md) for available tokens.
List only the tokens this component uses:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#6366f1` | CTA button background |
| `--spacing-4` | `16px` | Internal padding |

### Responsive Layout

| Breakpoint | Layout | Notes |
|------------|--------|-------|
| Mobile `< 640px` | … | … |
| Tablet `640–1024px` | … | … |
| Desktop `> 1024px` | … | … |

### Accessibility Checklist

Reference [a11y-checklist.md](./references/a11y-checklist.md) for full list.
Confirm these for every interactive component:

- [ ] Color contrast ≥ 4.5:1 (text) / 3:1 (UI elements) — WCAG 1.4.3 / 1.4.11
- [ ] Keyboard operable (Tab, Enter, Space, Arrow keys as appropriate)
- [ ] Focusable with visible focus ring
- [ ] Correct semantic HTML element (`<button>`, `<input>`, `<nav>`, etc.)
- [ ] ARIA attributes where native semantics are insufficient
- [ ] Screen reader label (`aria-label` / `aria-labelledby` / `aria-describedby`)
- [ ] No content conveyed by color alone

### Acceptance Criteria

Write as testable Given/When/Then statements:
- **Given** [context], **When** [action], **Then** [expected result]
- Include: happy path, error state, loading state, keyboard navigation, screen reader behavior

### React + TypeScript Template

Provide a starter implementation using:
- Ant Design components as first choice
- Tailwind CSS utility classes for layout and spacing (no inline styles unless dynamic)
- `React.FC<Props>` with exported interface

---

## Token Definition Workflow

1. Review existing tokens in `styles/variables.css`
2. Check Tailwind config / `main.css` for overrides
3. Produce a token table:

| Token name | Value | Category | Usage |
|------------|-------|----------|-------|
| `--color-brand-primary` | `#6366f1` | Color | Primary actions |

4. Show CSS variable declaration block ready to paste into `styles/variables.css`
5. Show Tailwind extension pattern if a utility class is needed

---

## Responsive Planning Workflow

Breakpoints used in this project (Tailwind default):

| Name | Min width | Tailwind prefix |
|------|-----------|-----------------|
| sm | 640px | `sm:` |
| md | 768px | `md:` |
| lg | 1024px | `lg:` |
| xl | 1280px | `xl:` |
| 2xl | 1536px | `2xl:` |

Output:
1. Layout diagram (text art or Mermaid) for each breakpoint
2. Tailwind class list for the layout container
3. Any content that is hidden / shown per breakpoint (`hidden sm:block` etc.)

---

## A11y Audit Workflow

1. Identify all interactive elements in the component
2. Check each against the full [a11y checklist](./references/a11y-checklist.md)
3. Report findings as a table:

| Element | Issue | WCAG Criterion | Fix |
|---------|-------|----------------|-----|
| `<div onClick>` | Non-semantic click target | 4.1.2 | Replace with `<button>` |

4. Provide corrected code snippets inline

---

## Project Conventions

- **UI library**: Ant Design (preferred). MUI deprecated — migrate if touched.
- **Styling**: Tailwind CSS utility classes. Inline styles only for dynamic runtime values.
- **TypeScript**: Strict — no `any`. Use proper interfaces.
- **File location**: New components go in `components/` subdirectory matching type (button/, modal/, layout/, ui/, select/).
- **Reuse over create**: Search `components/` before creating a new component.
- See full conventions in `.github/copilot-instructions.md`.
