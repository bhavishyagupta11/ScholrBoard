# ScholrBoard - Server

Backend API for ScholrBoard educational platform built with Express.js, MongoDB, and Firebase Admin.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| Express.js 5 | Web Framework |
| MongoDB + Mongoose | Database |
| Firebase Admin | Server-side Auth |
| JWT | Token-based Auth |
| Bcrypt | Password Hashing |
| Multer | File Uploads |
| Cloudinary | Image Storage |

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- MongoDB (local or Atlas)
- Firebase Project

### Installation

```bash
# Install dependencies
npm install
```

### Environment Setup

1. **Create `.env` file:**

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/scholrboard
JWT_SECRET=your_super_secret_jwt_key
FIREBASE_PROJECT_ID=your_firebase_project_id
```

2. **Setup Firebase credentials:**

```bash
copy firebase-service-account.template.json firebase-service-account.json
```

Replace placeholder values in `firebase-service-account.json` with your actual Firebase service account credentials.

### Start the Server

```bash
# Development (with nodemon)
npm run server

# Production
npm start
```

---

## 📁 Project Structure

```
server/
├── config/
│   ├── db.js              # MongoDB connection
│   └── firebase-admin.js  # Firebase admin initialization
├── controllers/
│   └── authController.js  # Authentication logic
├── middleware/
│   ├── auth.js            # JWT verification
│   ├── error.js           # Error handling
│   ├── firebaseAuth.js    # Firebase token verification
│   ├── roleAuth.js        # Role-based access control
│   └── verifyFirebaseToken.js
├── models/
│   └── User.js            # Mongoose user schema
├── routes/
│   ├── auth.js            # Auth API routes
│   └── users.js           # User API routes
├── firebase-service-account.template.json
├── package.json
└── server.js              # Entry point
```

---

## 🔐 Authentication Flow

1. **Client** → Firebase Auth → Get ID Token
2. **Client** → Send Token in Authorization header
3. **Server** → `verifyFirebaseToken` middleware
4. **Server** → `firebaseAdmin.auth().verifyIdToken()`
5. **Server** → Extract user role from token
6. **Server** → `roleAuth` middleware checks permissions
7. **Server** → Return authorized response

---

## 📝 API Endpoints

### Auth Routes

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/register` | Register new user | Public |
| POST | `/api/auth/login` | User login | Public |
| POST | `/api/auth/logout` | User logout | Auth |

### User Routes

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/users` | Get all users | Admin |
| GET | `/api/users/:id` | Get user by ID | Auth |
| PUT | `/api/users/:id` | Update user | Owner/Admin |
| DELETE | `/api/users/:id` | Delete user | Admin |

---

## 🔒 Security Middleware

### auth.js
Verifies JWT token from Authorization header.

### firebaseAuth.js
Verifies Firebase ID token from client.

### roleAuth.js
Role-based access control:
- `student` - Basic access
- `faculty` - Extended access
- `admin` - Full access

### verifyFirebaseToken.js
Central Firebase token verification middleware.

---

## 📦 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run server` | Start with nodemon (dev) |
| `npm start` | Start production server |

---

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | Yes |
| `MONGO_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Yes |

---

## ⚠️ Security Notes

- **Never** commit `.env` or `firebase-service-account.json` to version control
- Add to `.gitignore`:
  ```
  node_modules/
  .env
  firebase-service-account.json
  dist/
  ```
- Keep Firebase credentials secure
- Rotate JWT secret periodically
- Use HTTPS in production

---

## 📄 License

ISC License