# ScholrBoard

> **A Production-Ready Full-Stack Academic & Portfolio Management Platform**

[![Tech Stack: MERN](https://img.shields.io/badge/Tech%20Stack-MERN%20%2B%20Firebase-0052CC?style=flat-square&logo=react)](https://github.com)
[![Frontend: React 19](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%207-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Backend: Express 5](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%205-339933?style=flat-square&logo=nodedotjs)](https://expressjs.com)
[![Database: MongoDB](https://img.shields.io/badge/Database-MongoDB%20%7C%20Mongoose-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com)
[![Auth: Firebase](https://img.shields.io/badge/Auth-Firebase%20%7C%20JWT-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue?style=flat-square)](LICENSE)

---

## 📖 Overview

**ScholrBoard** is a specialized full-stack educational operations and portfolio management web application designed to bridge the operational gaps between **Students**, **Faculty Mentors**, and **Administrators**. 

### The Problem
In standard academic environments, student progress tracking, extra-curricular verifications, coding profiles, and placement preparations are often scattered across isolated Google Forms, fragmented spreadsheets, and physical printouts. This leads to manual verification bottlenecks, outdated resumes, and high-latency compliance reporting.

### The Solution
ScholrBoard provides unified, secure, role-based workflows operating from a shared source of truth. It implements structured extra-curricular activity capture, one-click faculty verification queues, automated portfolio assembly, cross-platform coding statistics tracking, and audit-ready institutional report generation (NAAC, NIRF).

---

## ✨ Features & Capabilities

### 🧑‍🎓 Student Portal
* **Centralized Academic Workspace**: Track cumulative GPA, semester attendance metrics, and priority-ranked smart suggestions based on profile gaps.
* **Evidence-Backed Activity Log**: Submit hackathon achievements, certifications, volunteer work, and projects with proof URLs for immediate faculty review.
* **Dynamic Portfolio Assembly**: Instantly generate digital web portfolios featuring interactive skill sets, project repositories, and downloadable PDF versions via `jsPDF` / `html2canvas`.
* **Cross-Platform Coding Aggregator**: Track automated or manual synchronizations of competitive programming statistics across platforms like **LeetCode**, **CodeChef**, **Codeforces**, and **HackerRank**.
* **Placement & Event Discovery**: Explore internal placement opportunities, apply directly, and track registration schedules for upcoming technical symposiums.

### 👨‍🏫 Faculty Portal
* **Verification Queues**: Streamlined dashboard to review, approve, or reject student activity submissions with one-click updates to keep institutional records tamper-proof.
* **Student 360° View**: Deep-dive analytics into assigned mentees detailing academic history, assignment progress bars, live portfolio grades, and granular cross-platform programming ratings.
* **Mentorship Outreach**: Direct review mechanisms to contact students and guide technical and extra-curricular paths.

### 🏢 Administrator Portal
* **Institutional Analytics**: High-level statistical visualizations powered by `Recharts`, evaluating department-wise distributions, activity type ratios, and overall placement success rates.
* **Compliance Report Generators**: Dedicated workflows for instant, data-backed **NAAC** and **NIRF** compliance file structures, alongside one-click global data exports to `.xlsx` Excel spreadsheets.
* **Opportunity Engine**: Full CRUD interfaces to manage new campus placement drives, internships, and cross-departmental technical events.

---

## 🛠️ Technical Stack

### **Frontend Architecture**
* **Core**: React 19, Vite 7
* **Routing**: React Router v7 (Implementing optimized `lazy` chunk loading and nested layouts)
* **Styling**: Tailwind CSS v4 alongside Vanilla CSS custom properties (`index.css`) optimized for high-performance GPU acceleration and native CSS Glassmorphism.
* **Data Visualization**: Recharts v3.2 for interactive SVG charts.
* **Document Processing**: `xlsx` for Excel parsing/exports, `jspdf` & `html2canvas` for responsive client-side PDF document generation.
* **Icons**: `lucide-react` for clean, professional iconography.

### **Backend Architecture**
* **Runtime & Framework**: Node.js v18+, Express v5.1
* **Database & ORM**: MongoDB, Mongoose v8.18 for schema definitions, relational multi-role indexing, and lifecycle validations.
* **Authentication Pipeline**: Dual-layer authentication utilizing **Firebase Authentication** client tokens validated downstream via **Firebase Admin SDK** (`verifyIdToken`), securely synced with server-issued JSON Web Tokens (**JWT**).
* **Security & Utilities**: `bcrypt` for local cryptographic processing, `cors`, `dotenv` for localized multi-environment configs.
* **Media Handling**: Native `multer` parsing coupled with `cloudinary` integration for persistent static assets and user document proofs.

---

## 🏛️ System Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
|                                   CLIENT LAYER                                    |
|   +-------------------+     +-------------------------+     +-----------------+   |
|   |  React 19 / Vite  | --> |  FirebaseAuthContext    | --> | ProfileContext  |   |
|   +-------------------+     +-------------------------+     +-----------------+   |
+-----------------------------------------------------------------------------------+
          |                                |
    REST API Calls                 Firebase ID Token
          |                                |
          v                                v
+-----------------------------------------------------------------------------------+
|                                   SERVER LAYER                                    |
|   +---------------------------------------------------------------------------+   |
|   | Middleware: verifyFirebaseToken (Firebase Admin Auth Verification)        |   |
|   +---------------------------------------------------------------------------+   |
|                                          |                                        |
|                                          v                                        |
|   +-------------------+     +-------------------------+     +-----------------+   |
|   | authController.js | --> | User Schema Validation  | --> | MongoDB Storage |   |
|   +-------------------+     +-------------------------+     +-----------------+   |
+-----------------------------------------------------------------------------------+
```

### **Authentication & Session Workflow**
1. **Client Auth Initialization**: The user authenticates against Firebase Auth (Email/Password).
2. **Token Resolution**: Upon successful login/registration, the client requests an active OpenID Connect compatible `IdToken`.
3. **Backend Handshake**: The token is transmitted securely via the `Authorization: Bearer <token>` header to the `/api/auth/sync` or `/api/auth/register` endpoints.
4. **Middleware Verification**: The custom `verifyFirebaseToken` middleware validates payload integrity, signature, and audience (`aud`) against the backend's initialized `firebase-admin` instance.
5. **Database Resolution**: The controller confirms user existence, extracts role assignments, strictly evaluates role-bound data constraints (e.g., matching unique `studentId` or `facultyId`), and establishes downstream database identity.

---

## 📁 Repository & Folder Structure

The project is structured as a decoupled monorepo directly optimizing full-stack deployment workflows:

```text
ScholrBoard/
├── client/                             # React 19 Frontend Web Application
│   ├── public/                         # Static Web Assets & Previews
│   └── src/
│       ├── assets/                     # Media & Styling dependencies
│       ├── components/                 # Reusable UI blocks (Topbar, Dynamic Charts)
│       ├── config/                     # Firebase & Client environment binders
│       ├── contexts/                   # State Providers (Auth Pipeline, Active Profile)
│       ├── hooks/                      # Custom reactive hooks (useScrollAnimation)
│       ├── layouts/                    # Role-segmented routing shells
│       ├── pages/                      # Application route components (Dashboard, 360 View)
│       └── routes/                     # Router configurations
│
└── server/                             # Express 5 / Node.js API Backend
    ├── config/                         # Database and Firebase Admin connections
    ├── controllers/                    # Core business logic execution handlers
    ├── middleware/                     # Token validation, Role assertions, Error interception
    ├── models/                         # Mongoose Data Schemas (User models)
    └── routes/                         # Express API route declarations
```

---

## 🚀 Installation & Local Setup

### **Prerequisites**
* **Node.js**: v18.0.0 or higher
* **Package Manager**: `npm` v9+
* **Database**: Running local MongoDB server (`mongodb://localhost:27017`) or dedicated Atlas Cluster URL.
* **Firebase**: Active project setup with Authentication (Email/Password provider enabled) and an generated Service Account JSON key.

### **1. Repository Cloning**
```bash
git clone https://github.com/bhavishyagupta11/ScholrBoard.git
cd ScholrBoard
```

### **2. Backend Configuration & Execution**
Navigate to the server workspace, install dependencies, and setup secure credentials:

```bash
cd server
npm install

# Setup environment variables
copy firebase-service-account.template.json firebase-service-account.json
```
*Note: Edit `firebase-service-account.json` to insert your explicit private key credentials.*

Create an operational `.env` file within `server/`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/scholrboard
JWT_SECRET=production_ready_cryptographic_secret_key
NODE_ENV=development
```

Start the backend API server:
```bash
npm run server
```

### **3. Frontend Configuration & Execution**
Open a terminal instance targeting the client environment:

```bash
cd client
npm install

# Duplicate the template environment structure
copy .env.example .env
```

Populate the `client/.env` file with accurate Firebase API access parameters (refer to the Environment Variables section below).

Boot up the high-speed Vite development environment:
```bash
npm run dev
```
The application will instantly bind and serve locally (typically accessible at `http://localhost:5173`).

---

## 🔐 Environment Variables Reference

### **Server (.env)**
| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `PORT` | Local network binding port for Express API | `5000` |
| `MONGODB_URI` | Full connection connection path to database | `mongodb://localhost:27017/scholrboard` |
| `JWT_SECRET` | Cryptographic secret for signing API auth state | `super_secret_jwt_signature_key` |
| `NODE_ENV` | Runtime stage controller (`development` / `production`) | `development` |

### **Client (.env)**
| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base endpoint path addressing the server backend | `http://localhost:5000/api` |
| `VITE_FIREBASE_API_KEY` | Public client identification string for Google APIs | `AIzaSyD...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Target authorization endpoint domain | `scholrboard.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Assigned distinct Cloud Project ID | `scholrboard` |
| `VITE_FIREBASE_STORAGE_BUCKET`| Target bucket handling user uploads | `scholrboard.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID`| FCM notification sender identification | `1234567890` |
| `VITE_FIREBASE_APP_ID` | Explicit application client tracking node | `1:12345:web:abcde` |

---

## 📡 Core API Endpoints

### **Authentication & Profile Subsystems**
| Method | Endpoint | Access | Functionality |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public / Token | Registers client identity within MongoDB alongside complex role constraints. |
| `POST` | `/api/auth/sync` | Private | Synchronizes existing authenticated client session metadata across DB stores. |
| `GET` | `/api/auth/profile` | Private | Fetches authenticated user payload including department, GPA, and internal IDs. |
| `GET` | `/api/users` | Admin | Retrieves paginated user structures for institutional dashboards. |
| `GET` | `/api/users/:id` | Private | Looks up specific target user records by assigned unique string index. |
| `PUT` | `/api/users/:id` | Private | Executes differential transactional updates to state components. |

---

## 📸 Platform Previews

| Student Operations Dashboard | Faculty 360° Assessment Matrix |
| :---: | :---: |
| ![Student Dashboard Placeholder](https://placehold.co/600x350/0f172a/38bdf8?text=Student+Dashboard+%26+Smart+Suggestions) | ![Faculty Matrix Placeholder](https://placehold.co/600x350/0f172a/4ade80?text=Faculty+Mentoring+%26+360+Analytics) |
| **Comprehensive Activity Trackers & Job Feeds** | **Granular Assignment & Coding Trackers** |

| Institutional Analytics Engine | Unified Verification Queues |
| :---: | :---: |
| ![Analytics Engine Placeholder](https://placehold.co/600x350/0f172a/fbbf24?text=Admin+Analytics+%26+Report+Generation) | ![Verification Queue Placeholder](https://placehold.co/600x350/0f172a/f87171?text=Evidence-Backed+Activity+Verifiers) |
| **NAAC / NIRF Reports & Department Metrics** | **One-Click Approval/Rejection Loggers** |

---

## 🧠 Engineering Challenges & Learnings

1. **State Synchronization Across Distributed Providers**: Integrating client-side Firebase user pools with server-authoritative MongoDB schema validations required creating highly resilient synchronization routines (`/api/auth/sync`). We learned to gracefully intercept token revocation loops and legacy localStorage caching structures to prevent application crashes when Firebase session keys rotate.
2. **GPU-Accelerated CSS Architecture**: Designing custom CSS layouts loaded with micro-animations and smooth scroll progression hooks often introduces repaint latency. Implementing hardware-accelerated transforms (`translate3d` and strict declarative classes) within our custom animation hooks (`useScrollAnimation.js`) maintained standard 60 FPS transitions across highly dense analytics dashboards.
3. **Decoupled Multi-Role Security Routing**: To support multiple access levels cleanly, we architected dynamic authorization boundary wrappers (`ProtectedRoute.jsx`). This approach eliminated UI layout flickering during authentication validation by wrapping asynchronous data fetch states with minimal React Suspense fallbacks.

---

## ⚡ Performance & Optimizations

* **Code Splitting & Lazy Routing**: Heavy dashboard views, charting elements, and PDF export logic modules are loaded asynchronously via React `lazy()` wrappers. This keeps the initial JavaScript bundle footprint minimal.
* **Component Memoization**: Heavy computing loops (such as continuous sorting operations across student coding metrics and cumulative contribution heatmaps) utilize `useMemo` hooks to prevent redundant virtual DOM reconciliations.
* **Optimized Observer Lifecycle Handling**: Infinite window listeners are replaced with native `IntersectionObserver` patterns inside our UI hooks. This allows DOM elements to fade in gracefully only when crossing the active viewport boundary, drastically reducing idle background CPU overhead.

---

## 🛡️ Security Best Practices Implemented

* **Asymmetric Token Signature Validations**: Frontend actions require active authorization Bearer credentials. The API authenticates incoming requests strictly via cryptographically secure Google token validation (`verifyIdToken`) prior to routing logic.
* **Schema Integrity Enforcement**: Strict server-side field presence validations inside `authController.js` reject bad input payloads. This prevents untrusted accounts from executing privilege escalations across protected student or faculty boundaries.
* **Environment Sandboxing**: Production logic blocks access paths depending on current stage definitions, separating local testing secrets from live cloud setups.

---

## 🔮 Future Roadmap

* **Real-time WebSockets Integration**: Introducing native Socket.IO communication paths to stream real-time visual alerts to faculty when priority assignment verification files are submitted.
* **Automated Coding Profile Scrapers**: Moving manual API metrics collection to automated background Cron job pipelines running cloud-based worker pools.
* **Plagiarism & Proof AI Verification**: Implementing computer vision parsing layers to automatically identify overlapping text segments or fraudulent verification certificates during file uploads.

---

## 🤝 Contributing Guidelines

We welcome community collaboration! To contribute:

1. Fork the repository directly via GitHub.
2. Create a targeted branch referencing the task (`git checkout -b feature/enhanced-dashboard`).
3. Commit clean, concise source tracking records (`git commit -m "feat: updated reporting layouts"`).
4. Push updates to your fork (`git push origin feature/enhanced-dashboard`).
5. Open a well-documented Pull Request detailing target logic updates.

---

## 👨‍💻 Author Section

**Bhavishya Gupta**  
*Full-Stack Software Engineer*

* **GitHub**: [@bhavishyagupta11](https://github.com/bhavishyagupta11)
* **LinkedIn**: [Bhavishya Gupta](https://linkedin.com/in/bhavishyagupta11)
* **Specialization**: Scalable Web Application Development, Cloud Architectures, and Highly Responsive User Interfaces.

---

## 📄 License

This software is publicly released and maintained under the terms of the **ISC License**. Refer to the underlying [LICENSE](LICENSE) structure for direct text references.
