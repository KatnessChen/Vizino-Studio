# Copilot Instructions for Interior Painting Designer

## Language Requirements

1. **If user asks in Traditional Chinese, respond in Traditional Chinese**

2. **If user asks in English, respond in English**

3. **If user uses mixed languages, determine response language based on primary language**

4. **For code and comments, Always use English**

## Copilot UI/UX Guidelines (English)

When generating UI designs, components, or front-end specifications, follow modern UI/UX principles that are implementable and accessible:

- **User-centered**: Focus on the user's primary goals and reduce unnecessary options. Each screen should have one primary task. 💡
- **Clear information hierarchy**: Use clear visual hierarchy (heading > subheading > content > actions) and consistent navigation and naming. 🔍
- **Consistency & componentization**: Use design tokens (colors, spacing, typography, radii) and reusable components (buttons, inputs, cards). Provide component API examples (props/events). ♻️
- **Accessibility (WCAG 2.1 AA)**: Ensure color contrast, keyboard operability, semantic HTML, ARIA attributes, and screen reader support. Include an accessibility checklist for interactive components. ♿
- **Feedback & states**: Provide clear visual and textual feedback for success, error, loading, and empty states; use predictable microcopy. 📝
- **Responsive & performance-conscious**: Provide layout variants for common breakpoints (mobile/tablet/desktop) and optimize initial render and image loading strategies. 📱💻
- **Deliverables that are testable**: Output a components list, component API (props/events), visual specs (spacing/color/typography), responsive breakpoints, interaction flow diagrams, and acceptance criteria. ✅
- **Design rationale**: For key decisions, provide a 1–2 sentence rationale linking the choice to user pain points. 🔧
- **Internationalization & text flexibility**: Allow space for longer strings, support LTR/RTL, and localizability considerations. 🌍

Output format example:

1. Short design summary; 2) Components list (each component includes props, states, ARIA); 3) Visual tokens (colors/typography/spacing); 4) Responsive layouts and acceptance criteria; 5) Test checklist including accessibility checks.

If requested, also provide React + TypeScript component templates and Tailwind/CSS tokens, and include unit test cases and accessibility verification steps. ✨

## Project Overview

**Interior Painting Designer** is a React/TypeScript web app that allows users to upload room photos and visualize different paint colors, textures, and furnishings using Google's Gemini API. The app uses Firebase for authentication and storage, Redux for state management, and Tailwind CSS for styling.

## Architecture Essentials

### Data Flow & Core Concepts

- **Projects → Spaces → Images**: Hierarchical data model. Users create projects (e.g., "House Renovations"), which contain spaces (e.g., "Living Room"), which contain images that are processed.
- **Image Evolution Chain**: Each generated image stores a `parentImageId` and `ImageOperation` record tracking what transformation was applied (e.g., "recolor_wall" with color #a7b3aa). This enables undo/redo and image versioning.
- **Gemini Tasks**: Four core operations defined in `services/gemini/geminiTasks.ts`:
  - `RECOLOR_WALL`: Change wall color (requires color selection)
  - `ADD_TEXTURE`: Add texture patterns (requires texture selection)
  - `ADD_HOME_ITEM`: Add furniture/objects (requires item selection)
  - `CUSTOM_PROMPT`: User-defined AI prompts
- **Soft Deletes**: Images have `isDeleted` flag and `deletedAt` timestamp; not permanently removed from Firestore.

### Technology Stack

- **Frontend**: React 19, TypeScript, Vite dev server (port 3000)
- **State Management**: Redux Toolkit with slices for `project`, `image`, `customAssets`, `task`
- **Auth**: Google OAuth via `@react-oauth/google` + Firebase Authentication
- **Backend Services**: Firebase Firestore (database), Storage (image hosting), Gemini API (image generation)
- **UI**: Material-UI, Ant Design, Tailwind CSS v4 with `@tailwindcss/vite`
- **Testing**: Vitest with UI runner (`npm run test:ui`)

### Key File Structure

- `stores/*.ts`: Redux slices managing app state
- `services/gemini/`: Gemini API integration, prompt templates, error handling
- `services/firestore*.ts`: Database CRUD operations, large file (~1500 lines)
- `hooks/use*.ts`: Custom hooks like `useImageProcessing`, `useAppInit` for initialization logic
- `components/`: Organized by type (button, layout, modal, select, ui)
- `types.ts`: TypeScript interfaces (ImageData, ImageOperation, Project, Space, Color, etc.)
- `utils/`: Helper functions including `FirestoreDataHandler` for data serialization

## Developer Workflows

### Common Commands

```bash
npm run dev          # Start Vite dev server (http://localhost:3000)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run type-check   # TypeScript validation
npm run test         # Run Vitest
npm run test:ui      # Vitest UI dashboard
```

### Debugging Firestore Timestamps

Redux middleware is configured to allow Firestore `Timestamp` objects in state (see `stores/store.ts`). Never try to serialize/deserialize Timestamps naively—use Firebase utilities.

### Environment Variables (Vite)

All env vars prefixed with `VITE_` are available at runtime. Key ones:

- `VITE_GOOGLE_CLIENT_ID`: OAuth
- `VITE_GEMINI_API_KEY` (or `GEMINI_API_KEY`): Google Gemini API
- `VITE_FIREBASE_*`: Firebase config credentials
- `VITE_ADMIN_EMAILS`: Comma-separated list for admin panel access

### Routing Strategy

Routes use slug-id format: `/project/{name-slug}-{shortId}/space/{name-slug}-{shortId}`. The `useAppInit` hook extracts shortIds from URL params and loads data. Always regenerate URLs with `generateRoute()` when creating links.

## Code Patterns & Conventions

### Image Processing Flow

1. User selects task, color/texture, and image
2. `useImageProcessing` hook converts the image to base64 from Firebase Storage
3. Calls `geminiService.generateRecoloredImage()` (or similar)
4. Returns base64 string; UI converts to blob and uploads to Firebase Storage
5. `ImageOperation` record is appended to image's `evolutionChain`

### Component Organization

- **Modal components**: Handle user input/confirmation; usually dispatch Redux actions on submit
- **Select components**: Wrapper around Ant Design dropdowns; manage selection state
- **Layout components**: Header, Footer, Aside panels; some consume auth context
- **UI components**: Cards, empty states, tooltips; reusable presentation logic

### Redux Usage

- Use `useSelector` and `useDispatch` from `react-redux`
- All reducers are in `stores/` directory; avoid spreading Redux across components
- When fetching data (projects, images), dispatch to Redux _and_ store locally if needed
- Example: `dispatch(setProjects(fetchedProjects))` centralizes app state

### Error Handling in Gemini Service

- Custom error messages defined in `services/gemini/geminiApiErrors.ts`
- Always catch errors in image processing and display user-friendly messages
- Log detailed errors to console for debugging; users see sanitized messages

### Custom Colors, Textures, Items

Users can upload custom versions. These are stored in Firestore and pulled into Redux state via `customAssetsReducer`. Always check both preset (from `constants/constants.ts`) and custom versions when building dropdowns.

## Styles & Formatting

- **CSS**: Tailwind v4 (utility-first) in `main.css`, component-specific styles in `variables.css`
- **Styling Priority**: Prioritize Tailwind CSS utility classes over inline styles for consistency and maintainability
- **Component Props**: Use TypeScript interfaces; avoid `any` type
- **Imports**: Alias `@` resolves to workspace root (set in `vite.config.ts`)

## Testing

- Unit tests in `__tests__/` folders (e.g., `utils/__tests__/stringUtils.test.ts`)
- Mock Firestore and Firebase Storage in tests; use `jsdom` for DOM testing
- No E2E tests configured yet; focus on unit and component tests

## Important Gotchas

1. **Firebase CORS**: Must configure CORS on Firebase Storage bucket using `cors.json` and `gsutil` (documented in README)
2. **Gemini Model**: Hardcoded to `'gemini-3-pro-image-preview'`; marked as TODO for user-selectable models
3. **Soft Deletes**: Check `isDeleted` flag when querying images; deleted images still exist in Firestore
4. **Image Caching**: `imageCache.ts` provides memoization for base64 conversions to avoid re-fetching
5. **Admin Panel**: Only users in `VITE_ADMIN_EMAILS` can access `/admin-setting`

## Extending the Codebase

- **Adding a new Gemini task**: Define in `geminiTasks.ts`, add prompt template in `prompts.ts`, add processing function in `geminiService.ts`, add hook logic in `useImageProcessing.ts`
- **Adding UI for new color options**: Update preset colors in `constants.ts` or integrate with custom assets in Redux
- **Modifying Firestore schema**: Update `types.ts` interfaces and use `FirestoreDataHandler` for serialization
- **New pages**: Create in `pages/` and add route to `routes.ts`; use `useAuth()` to check permissions

## File Deprecation & Cleanup

**When adding new features that replace or supersede existing code:**

1. Identify all files that are no longer needed (dead code, replaced functionality)
2. Search for all references to deprecated files across the codebase
3. Update imports in dependent files or provide migration path
4. Delete deprecated files in the same commit as the new feature
5. Update this `copilot-instructions.md` and `IMAGE_REORDERING_FEATURE.md` to document deprecated files
6. If migration required for existing data, create migration scripts in `utils/migrationScripts.ts` (for manual/admin use only)
7. Do NOT expose migration UI in user-facing components; migrations should be manual/documented processes
