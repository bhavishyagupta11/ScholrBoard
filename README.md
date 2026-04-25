# ScholrBoard

ScholrBoard is a full-stack educational platform for students, faculty, and administrators. It provides role-based dashboards, profile and portfolio management, activity tracking, approvals, analytics, placements, resume import, and verification workflows.

## Repository Structure

This repository is organized as a small monorepo:

```text
ScholrBoard/
├── client/      # React + Vite frontend
└── server/      # Express + MongoDB backend
```

Keep this root README as the main project overview and onboarding guide. The `client/README.md` and `server/README.md` files are kept for app-specific setup, scripts, and implementation notes.

## Tech Stack

| Area | Tools |
| --- | --- |
| Frontend | React 19, Vite 7, Tailwind CSS 4, React Router 7 |
| Backend | Node.js, Express 5, MongoDB, Mongoose |
| Authentication | Firebase Authentication, Firebase Admin, JWT |
| UI and data | Lucide React, Recharts, xlsx, jsPDF, html2canvas |
| File and media support | Multer, Cloudinary |

## Prerequisites

- Node.js 18 or newer
- npm
- MongoDB database, either local or Atlas
- Firebase project with Authentication enabled
- Firebase Admin service account for the backend

## Quick Start

Install and run the backend:

```bash
cd server
npm install
copy firebase-service-account.template.json firebase-service-account.json
npm run server
```

Install and run the frontend in a second terminal:

```bash
cd client
npm install
npm run dev
```

By default, the backend listens on `http://localhost:5000`. Vite prints the frontend URL when `npm run dev` starts.

## Environment Configuration

### Server

Create `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/scholrboard
JWT_SECRET=replace_with_a_strong_secret
NODE_ENV=development
```

Copy `server/firebase-service-account.template.json` to `server/firebase-service-account.json` and replace the placeholder values with a Firebase Admin service account.

### Client

Create `client/.env` if the frontend needs to call a local or deployed API:

```env
VITE_API_URL=http://localhost:5000/api
```

The current Firebase client configuration lives in `client/src/config/firebase.js`.

## Available Scripts

| Location | Command | Description |
| --- | --- | --- |
| `client/` | `npm run dev` | Start the Vite development server |
| `client/` | `npm run build` | Build the frontend for production |
| `client/` | `npm run lint` | Run ESLint |
| `client/` | `npm run preview` | Preview the production build |
| `server/` | `npm run server` | Start the API with nodemon |
| `server/` | `npm start` | Start the API with Node |

## Application Areas

- Student dashboard, activity tracking, profile, portfolio, coding, resume import, and uploads
- Faculty dashboard, approvals, student listing, and 360-degree student view
- Admin dashboard, analytics, events, placements, and verification
- Firebase-backed login flows for students, faculty, and admins

## API Overview

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register or complete a user profile after Firebase authentication |
| `POST` | `/api/auth/sync` | Sync Firebase authenticated user data with MongoDB |
| `GET` | `/api/auth/profile` | Get the authenticated user's profile |
| `GET` | `/api/users` | Get users |
| `GET` | `/api/users/:id` | Get a user by ID |
| `PUT` | `/api/users/:id` | Update a user by ID |

## Security Notes

- Do not commit `.env` files.
- Do not commit `server/firebase-service-account.json`.
- Use a strong `JWT_SECRET` outside local development.
- Restrict Firebase and database credentials by environment.
- Rotate service account keys and secrets if they are ever exposed.

## Documentation Policy

The project should keep:

- `README.md` for the complete product overview, setup path, and shared conventions.
- `client/README.md` for frontend-only details.
- `server/README.md` for backend-only details.

This avoids one oversized root README while still giving each app a useful local guide.

## License

ISC
