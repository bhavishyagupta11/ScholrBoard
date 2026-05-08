# ScholrBoard Client

React frontend for ScholrBoard. This app contains the student, faculty, admin, authentication, profile, portfolio, analytics, placement, upload, and verification interfaces.

For full project setup, start with the root `README.md`. Use this file when working specifically inside `client/`.

## Stack

- React 19
- Vite 7
- Tailwind CSS 4
- React Router 7
- Firebase Authentication
- Recharts
- Lucide React
- xlsx, jsPDF, html2canvas

## Setup

```bash
npm install
npm run dev
```

Vite prints the local development URL after startup.

## Environment

Copy `.env.example` to `.env` and fill in your Firebase web app values:

```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=replace_with_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=replace_with_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=replace_with_project_id
VITE_FIREBASE_STORAGE_BUCKET=replace_with_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=replace_with_sender_id
VITE_FIREBASE_APP_ID=replace_with_firebase_app_id
```

Firebase client configuration is loaded from Vite environment variables in `src/config/firebase.js`. Do not commit real `.env` files.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the app for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build |

## Source Layout

```text
src/
├── assets/        # Static assets
├── components/    # Shared UI components
├── config/        # Firebase client config
├── contexts/      # Auth and profile context providers
├── hooks/         # Custom React hooks
├── layouts/       # Student, faculty, and admin layouts
├── pages/         # Route-level pages
├── routes/        # App route definitions
├── App.jsx
└── main.jsx
```

## Main Areas

- `pages/auth/` contains role-specific login pages.
- `layouts/` contains role-specific shell layouts.
- `contexts/FirebaseAuthContext.jsx` handles Firebase auth and backend sync calls.
- `routes/AppRoutes.jsx` defines the application routes.

## Production Build

```bash
npm run build
npm run preview
```

The production build is written to `dist/`.
