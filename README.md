# ScholrBoard

A full-stack educational platform built with React, Node.js, Express, and Firebase. ScholrBoard provides role-based access for Students, Faculty, and Administrators with features like activity tracking, analytics, placements, and portfolio management.

---

## 📋 Project Overview

| Attribute | Details |
|-----------|---------|
| **Project Name** | ScholrBoard |
| **Type** | Full-stack Web Application |
| **Client** | React 19 + Vite + Tailwind CSS |
| **Server** | Express.js + MongoDB + Firebase Admin |
| **Authentication** | Firebase Auth (JWT-based) |
| **Roles** | Student, Faculty, Admin |

---

## 🏗️ Architecture

```
ScholrBoard/
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/      # React Context providers
│   │   ├── hooks/         # Custom React hooks
│   │   ├── layouts/       # Role-based layouts
│   │   ├── pages/         # Page components
│   │   └── routes/        # Application routes
│   └── public/            # Static assets
│
└── server/                 # Backend (Express.js)
    ├── config/            # Database & Firebase config
    ├── controllers/       # Business logic
    ├── middleware/        # Auth, role verification
    ├── models/            # Mongoose schemas
    └── routes/            # API endpoints
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18+) 
- **npm** or **yarn**
- **MongoDB** (local or Atlas)
- **Firebase Project** (for authentication)

---

### 🖥️ Frontend Setup

```bash
cd client
npm install
npm run dev
```

**Environment Variables:** Create `.env` file in `client/` (if needed).

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID |

---

### 🖥️ Backend Setup

```bash
cd server

# 1. Install dependencies
npm install

# 2. Setup environment variables
copy .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# 3. Setup Firebase credentials
copy firebase-service-account.template.json firebase-service-account.json
# Replace placeholder values with your Firebase service account credentials

# 4. Start the server
npm run server    # Development (with nodemon)
npm start         # Production
```

**Environment Variables (`.env`):**

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `FIREBASE_PROJECT_ID` | Firebase project ID |

---

## 📦 Available Scripts

### Client

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

### Server

| Command | Description |
|---------|-------------|
| `npm run server` | Start with nodemon (dev) |
| `npm start` | Start production server |

---

## 🔐 Authentication Flow

1. **Client** → Firebase Auth → Get ID Token
2. **Client** → Send Token to Server API
3. **Server** → Verify Token via Firebase Admin
4. **Server** → Check Role (Student/Faculty/Admin)
5. **Server** → Return authorized data

---

## 📚 API Endpoints

### Auth Routes
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### User Routes
- `GET /api/users` - Get all users (admin)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin)

---

## 🛠️ Tech Stack

### Frontend
- **React** 19 - UI library
- **Vite** 7 - Build tool
- **Tailwind CSS** 4 - Styling
- **React Router** 7 - Routing
- **Recharts** - Data visualization
- **Lucide React** - Icons
- **Firebase** - Authentication

### Backend
- **Express.js** 5 - Web framework
- **MongoDB** + **Mongoose** - Database
- **Firebase Admin** - Server-side auth
- **JWT** - Token-based auth
- **Bcrypt** - Password hashing
- **Multer** - File uploads
- **Cloudinary** - Image storage

---

## 🔒 Security Notes

- Never commit `.env` or `firebase-service-account.json` to version control
- Add these to `.gitignore`:
  ```
  node_modules/
  .env
  firebase-service-account.json
  dist/
  ```
- Keep Firebase credentials secure and rotate periodically

---

## 📄 License

ISC License

---

## 👥 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request