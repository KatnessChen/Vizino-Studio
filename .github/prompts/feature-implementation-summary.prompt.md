# Feature Implementation Summary Prompt

Generate a clear, structured feature implementation summary for JIRA/Kanban boards.

## Your Task

Create documentation following this exact structure. Fill in each section with concrete details from the feature context provided by the user.

---

### 📋 Feature Objective

- **Summary**: 1-2 sentence overview
- **Problem**: What gap/pain does this solve?
- **User Value**: Benefits to users
- **Acceptance Criteria**: [ ] Checkbox list of done conditions

---

### 🔧 Solution Overview

- **Approach**: High-level strategy
- **Key Components**: List main parts and their roles
- **Dependencies**: External APIs, internal services, schema changes
- **Trade-offs**: Why this approach? What are the costs?

---

### ⚙️ Implementation Details

**Frontend**

- Components: [New/modified components]
- State: [Redux changes, local state]
- Hooks/Utils: [Custom hooks, helpers]
- Styling: [Tailwind, CSS changes]

**Backend**

- Firestore: [Schema/collection changes]
- API Integrations: [Gemini, Firebase services]
- Auth: [Permission changes]

**Testing**

- Unit tests: [What to test]
- Component tests: [UI behavior]
- Integration: [How parts connect]

**Data Migration** (if needed)

- Path: How to migrate existing data?
- Rollback: How to revert if needed?

**Deployment**

- Steps: How to roll out?
- Rollback: How to recover?
- Monitoring: What to watch?

---

### 📌 Additional Notes

- **Effort**: Small (1-2d) / Medium (3-5d) / Large (1w+)
- **Related**: Links to related PRs/issues
- **Future**: What comes next?
- **Limitations**: What won't this do?

---

_Last Updated: February 2026 | Interior Painting Designer_
