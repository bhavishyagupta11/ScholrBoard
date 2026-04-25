# ScholrBoard - Client

Frontend application for ScholrBoard educational platform built with React, Vite, and Tailwind CSS.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| React 19 | UI Framework |
| Vite 7 | Build Tool |
| Tailwind CSS 4 | Styling |
| React Router 7 | Client-side Routing |
| Firebase Auth | Authentication |
| Recharts | Data Visualization |
| Lucide React | Icon Library |

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

---

## 📁 Project Structure

```
src/
├── assets/           # Static assets (images, fonts)
├── components/       # Reusable React components
│   └── auth/         # Authentication components
├── configs/          # Firebase configuration
├── contexts/         # React Context providers
│   ├── AuthContext.jsx
│   ├── FirebaseAuthContext.jsx
│   └── ProfileContext.jsx
├── hooks/            # Custom React hooks
│   └── useScrollAnimation.js
├── layouts/          # Role-based layouts
│   ├── AdminLayout.jsx
│   ├── FacultyLayout.jsx
│   └── StudentLayout.jsx
├── pages/            # Page components
│   ├── auth/        # Login pages
│   └── *.jsx        # Feature pages
├── routes/           # Application routing
│   └── AppRoutes.jsx
├── App.css          # Global styles
├── App.jsx          # Root component
├── index.css        # Tailwind imports
└── main.jsx         # Entry point
```

---

## 🔐 Authentication

The client uses Firebase Authentication with JWT tokens:

1. User signs in via Firebase Auth
2. ID token is stored in context
3. Token is sent with API requests
4. Server verifies token and extracts user role

---

## 🎨 Design System

### Colors

Configured via Tailwind CSS in `tailwind.config.js`:

- Primary brand colors
- Semantic colors (success, warning, error)
- Role-based colors (student, faculty, admin)

### Components

- **Topbar** - Navigation header
- **ScrollRevealDemo** - Animation showcase
- **Auth Forms** - Login/Signup components

---

## 📝 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint checks |
| `npm run preview` | Preview production build |

---

## 🔧 Environment Variables

Create a `.env` file in the client root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 🏭 Production Build

```bash
# Create optimized build
npm run build

# Preview the build
npm run preview
```

Build output is generated in the `dist/` directory.

---

## 📄 License

ISC License