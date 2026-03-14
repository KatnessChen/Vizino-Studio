# Vizino Studio

**Precise AI Design for Interior Visualization**

Upload room photos and instantly preview different paint colors, textures, and furnishings with pixel-perfect accuracy—powered by advanced AI that understands your exact vision.

---

## The Problem with Generic AI Chat Interfaces

Traditional generative AI chat tools fail interior designers and homeowners in critical ways:

- ❌ **Context Loss**: Long conversations cause AI hallucinations and inconsistent results
- ❌ **Image Inconsistency**: Generated images vary wildly between iterations, breaking design coherence
- ❌ **Chaotic Management**: Images, materials, and prompts get buried in endless chat history
- ❌ **Imprecise Results**: Pure text descriptions produce vague, unpredictable outcomes
- ❌ **No Reusability**: Successful prompts are lost once the chat ends

**Result:** Wasted time, frustration, and designs that don't match your vision.

---

## Our Philosophy: Precise AI Design

Vizino Studio reimagines AI-powered design with **precision, control, and organization** at its core.

### 🎯 Project-Based Workflow

Organize designs by projects and spaces—not scattered across chat threads. Every image, color, texture, and prompt stays exactly where you need it.

### 🖼️ Visual-First Approach

Upload your actual room photos and custom materials (colors, textures, furniture). AI works with your real assets—not generic text descriptions—delivering results that match your exact vision.

### 📚 Prompt Library & Reusability

Access pre-built prompt templates or save your own. Never start from scratch again. Reuse successful prompts across multiple projects for consistent, professional results.

### 🤖 "Help Me Write" AI Assistant

Describe your vision in simple terms, and our AI analyzes your images and materials to generate powerful, advanced prompts automatically. No prompt engineering expertise required.

### 🍌 Powered by Nano Banana Model

Combined with the world's most advanced reasoning AI model, Vizino Studio produces **precise, stunning visualizations** that traditional chat interfaces simply cannot achieve.

---

## Core Features

### 🗂️ Structured Material Library

Create projects → Add spaces → Upload images. Every design element is organized, versioned, and instantly accessible—no more digging through chat history.

### 🎨 Custom Material Upload

Upload your own paint colors, texture swatches, and furniture items. AI integrates them seamlessly with your room photos for pixel-perfect previews.

### 🔄 Iterative Design with Consistency

Generate variations while maintaining visual coherence. Each iteration builds on the previous one—images stay consistent, not random.

### 💬 Smart Prompt Assistance

Use prompt templates, save successful prompts, or let "Help Me Write" craft expert-level prompts from your simple descriptions and uploaded materials.

### ✅ No Design Background Needed

Communicate your vision clearly to contractors and designers with professional-quality previews—even if you've never touched design software before.

---

## Tech Stack

**Frontend:**  
React 19 · TypeScript · Vite · Tailwind CSS v4 · Ant Design

**State Management:**  
Redux Toolkit

**Backend Services:**  
Firebase (Auth, Firestore, Storage) · Google Gemini API

**Development:**  
ESLint · Vitest · Husky

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Firebase project with Storage enabled
- Google Gemini API key

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Add your Firebase credentials and Gemini API key

# Start development server
pnpm dev
```

### Environment Variables

Create a `.env` file with the following:

```env
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_ADMIN_EMAILS=admin@example.com
```

---

## Development

```bash
# Run dev server (http://localhost:3000)
pnpm dev

# Type checking
pnpm type-check

# Linting
pnpm lint

# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Build for production
pnpm build
```

---

## Firebase Storage CORS Configuration

To enable image access from Firebase Storage:

1. Install [Google Cloud SDK](https://cloud.google.com/storage/docs/gsutil_install)
2. Get your bucket name from [Firebase Console](https://console.firebase.google.com/) → Storage
3. Apply CORS settings:

```bash
gsutil cors set cors.json gs://YOUR_BUCKET_NAME
```

The included `cors.json` allows GET requests from localhost and your production domains.

---

## Code Quality

This project uses Husky pre-push hooks to enforce:

- ESLint checks (`pnpm lint`)
- TypeScript type checking (`pnpm type-check`)

To bypass (not recommended): `git push --no-verify`

---

## License

© 2026 Vizino Studio. All rights reserved.
