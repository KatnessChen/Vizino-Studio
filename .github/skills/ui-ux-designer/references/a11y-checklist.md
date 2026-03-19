# Accessibility Checklist (WCAG 2.1 AA)

Use this checklist for every interactive component.

## Perceivable

- [ ] **1.1.1 Non-text Content** — Images have meaningful `alt` text; decorative images use `alt=""`
- [ ] **1.3.1 Info and Relationships** — Structure conveyed via semantic HTML (headings, lists, landmarks)
- [ ] **1.3.3 Sensory Characteristics** — Instructions don't rely solely on shape, size, color, or location
- [ ] **1.4.1 Use of Color** — Color is not the only means of conveying information
- [ ] **1.4.3 Contrast (Minimum)** — Text contrast ≥ 4.5:1 (normal), ≥ 3:1 (large text ≥ 18pt/14pt bold)
- [ ] **1.4.4 Resize Text** — Text resizable to 200% without loss of content or functionality
- [ ] **1.4.11 Non-text Contrast** — UI components and focus indicators have ≥ 3:1 contrast against adjacent colors
- [ ] **1.4.13 Content on Hover/Focus** — Hoverable/focusable tooltip content is dismissible, hoverable, and persistent

## Operable

- [ ] **2.1.1 Keyboard** — All functionality available via keyboard; no keyboard traps
- [ ] **2.1.2 No Keyboard Trap** — Focus can be moved away from any component via keyboard
- [ ] **2.4.3 Focus Order** — Focus moves in a logical, meaningful sequence
- [ ] **2.4.4 Link Purpose** — Link/button text is descriptive enough to understand out of context
- [ ] **2.4.7 Focus Visible** — Keyboard focus indicator is always visible
- [ ] **2.5.3 Label in Name** — Visible label text is included in the accessible name

## Understandable

- [ ] **3.2.1 On Focus** — Receiving focus doesn't trigger unexpected context changes
- [ ] **3.2.2 On Input** — Changing a setting doesn't cause unexpected context changes without prior notice
- [ ] **3.3.1 Error Identification** — Errors are described in text and clearly associated with the field
- [ ] **3.3.2 Labels or Instructions** — Labels or instructions provided for user input

## Robust

- [ ] **4.1.2 Name, Role, Value** — All UI components have accessible name, role, and value; state changes are programmatically determinable
- [ ] **4.1.3 Status Messages** — Status messages (success, error, loading) are announced via `role="status"` or `aria-live`

## Common ARIA Patterns

| Use case | Pattern |
|----------|---------|
| Icon-only button | `<button aria-label="Close dialog">` |
| Toggle button | `<button aria-pressed="true/false">` |
| Modal dialog | `role="dialog" aria-modal="true" aria-labelledby="title-id"` |
| Alert / error | `role="alert"` or `aria-live="assertive"` |
| Live region (status) | `aria-live="polite" role="status"` |
| Loading state | `aria-busy="true"` on the container |
| Hidden from AT | `aria-hidden="true"` (decorative icons, etc.) |
| Expandable section | `aria-expanded="true/false"` on the trigger |
| Selected item | `aria-selected="true/false"` |
| Required field | `aria-required="true"` |
| Invalid field | `aria-invalid="true" aria-describedby="error-id"` |

## React Patterns

```tsx
// Accessible icon button
<button
  type="button"
  aria-label="Delete image"
  onClick={handleDelete}
>
  <DeleteOutlined aria-hidden="true" />
</button>

// Live region for async status
<div role="status" aria-live="polite" className="sr-only">
  {statusMessage}
</div>

// Modal focus trap (Ant Design handles this automatically)
<Modal
  title="Edit Name"
  open={isOpen}
  // Ant Design Modal is role="dialog" aria-modal by default
/>
```
