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

Create `client/.env` when the app needs an API URL:

```env
VITE_API_URL=http://localhost:5000/api
```

The current Firebase client configuration is defined in `src/config/firebase.js`.

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
