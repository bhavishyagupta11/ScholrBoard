# ScholrBoard Server

Express backend for ScholrBoard. The API handles MongoDB persistence, Firebase token verification, user profile synchronization, JWT-based middleware, and role-aware server-side access patterns.

For full project setup, start with the root `README.md`. Use this file when working specifically inside `server/`.

## Stack

- Node.js
- Express 5
- MongoDB and Mongoose
- Firebase Admin
- JSON Web Tokens
- bcrypt
- multer
- Cloudinary

## Setup

```bash
npm install
copy firebase-service-account.template.json firebase-service-account.json
npm run server
```

The API defaults to `http://localhost:5000`.

## Environment

Create `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/scholrboard
JWT_SECRET=replace_with_a_strong_secret
NODE_ENV=development
```

Copy `firebase-service-account.template.json` to `firebase-service-account.json`, then replace the placeholder values with credentials from Firebase Console.

Do not commit `.env` or `firebase-service-account.json`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run server` | Start the API with nodemon |
| `npm start` | Start the API with Node |

## Source Layout

```text
server/
├── config/         # MongoDB and Firebase Admin setup
├── controllers/    # Request handlers and business logic
├── middleware/     # Auth, role, and error middleware
├── models/         # Mongoose models
├── routes/         # Express route modules
├── firebase-service-account.template.json
├── package.json
└── server.js
```

## API Routes

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register or complete a user profile after Firebase authentication |
| `POST` | `/api/auth/sync` | Sync Firebase authenticated user data with MongoDB |
| `GET` | `/api/auth/profile` | Get the authenticated user's profile |
| `GET` | `/api/users` | Get users |
| `GET` | `/api/users/:id` | Get a user by ID |
| `PUT` | `/api/users/:id` | Update a user by ID |

## Authentication Flow

1. The client signs in with Firebase Authentication.
2. The client sends the Firebase ID token to the API.
3. `verifyFirebaseToken` validates the token with Firebase Admin.
4. Auth controllers sync or return user data from MongoDB.
5. JWT middleware is available for routes that use app-issued tokens.

## Security Notes

- Keep `firebase-service-account.json` local and private.
- Keep `.env` local and private.
- Use a strong `JWT_SECRET` in every non-local environment.
- Rotate Firebase service account keys if they are exposed.
- Use environment-specific credentials for development, staging, and production.
