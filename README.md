# ScholrBoard

> **A Production-Ready Full-Stack Academic & Portfolio Management Platform**

[![Tech Stack: MERN](https://img.shields.io/badge/Tech%20Stack-MERN-0052CC?style=flat-square&logo=react)](https://github.com)
[![Frontend: React 19](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%207-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Backend: Express 5](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%205-339933?style=flat-square&logo=nodedotjs)](https://expressjs.com)
[![Database: MongoDB](https://img.shields.io/badge/Database-MongoDB%20%7C%20Mongoose-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com)
[![Auth: JWT](https://img.shields.io/badge/Auth-JWT-FFCA28?style=flat-square)](https://jwt.io)
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
* **Authentication Pipeline**: Secure authentication utilizing server-issued JSON Web Tokens (**JWT**).
* **Security & Utilities**: `bcrypt` for local cryptographic processing, `cors`, `dotenv` for localized multi-environment configs.
* **Media Handling**: Native `multer` parsing coupled with `cloudinary` integration for persistent static assets and user document proofs.

---

## 🏛️ System Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
|                                   CLIENT LAYER                                    |
|   +-------------------+             +-----------------+     +-----------------+   |
|   |  React 19 / Vite  | ----------> |   AuthContext   | --> | ProfileContext  |   |
|   +-------------------+             +-----------------+     +-----------------+   |
+-----------------------------------------------------------------------------------+
          |                                    |
    REST API Calls                        Server JWT
          |                                    |
          v                                    v
+-----------------------------------------------------------------------------------+
|                                   SERVER LAYER                                    |
|   +---------------------------------------------------------------------------+   |
|   | Middleware: auth.js (JWT Signature & Expiration Verification)             |   |
|   +---------------------------------------------------------------------------+   |
|                                          |                                        |
|                                          v                                        |
|   +-------------------+     +-------------------------+     +-----------------+   |
|   | authController.js | --> | User Schema Validation  | --> | MongoDB Storage |   |
|   +-------------------+     +-------------------------+     +-----------------+   |
+-----------------------------------------------------------------------------------+
```

### **Authentication & Session Workflow**
1. **Credentials Submission**: The user submits their email and password via login/registration.
2. **Token Issuance**: The server authenticates the credentials against the MongoDB User document and issues a native JWT.
3. **Subsequent API Requests**: The client stores the JWT in localStorage and appends it as a `Bearer <token>` to the `Authorization` header of all subsequent API calls.
4. **Middleware Verification**: The backend `auth.js` middleware validates token signature, expiration, and loads the active user record from MongoDB.

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
│       ├── config/                     # Client configuration settings
│       ├── contexts/                   # State Providers (Auth context, Active Profile)
│       ├── hooks/                      # Custom reactive hooks (useScrollAnimation)
│       ├── layouts/                    # Role-segmented routing shells
│       ├── pages/                      # Application route components (Dashboard, 360 View)
│       └── routes/                     # Router configurations
│
└── server/                             # Express 5 / Node.js API Backend
    ├── config/                         # Database connection configuration
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

---

## 📡 Core API Endpoints

### **Authentication & Profile Subsystems**
| Method | Endpoint | Access | Functionality |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public / Token | Registers client identity within MongoDB alongside complex role constraints. |
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

1. **Native JWT Authentication Strategy**: Migrating from external providers to a self-contained, native JWT architecture required careful handling of token lifecycle states, secure local storage caching structures, and request-level user activity validation to protect role-based access.
2. **GPU-Accelerated CSS Architecture**: Designing custom CSS layouts loaded with micro-animations and smooth scroll progression hooks often introduces repaint latency. Implementing hardware-accelerated transforms (`translate3d` and strict declarative classes) within our custom animation hooks (`useScrollAnimation.js`) maintained standard 60 FPS transitions across highly dense analytics dashboards.
3. **Decoupled Multi-Role Security Routing**: To support multiple access levels cleanly, we architected dynamic authorization boundary wrappers (`ProtectedRoute.jsx`). This approach eliminated UI layout flickering during authentication validation by wrapping asynchronous data fetch states with minimal React Suspense fallbacks.

---

## ⚡ Performance & Optimizations

* **Code Splitting & Lazy Routing**: Heavy dashboard views, charting elements, and PDF export logic modules are loaded asynchronously via React `lazy()` wrappers. This keeps the initial JavaScript bundle footprint minimal.
* **Component Memoization**: Heavy computing loops (such as continuous sorting operations across student coding metrics and cumulative contribution heatmaps) utilize `useMemo` hooks to prevent redundant virtual DOM reconciliations.
* **Optimized Observer Lifecycle Handling**: Infinite window listeners are replaced with native `IntersectionObserver` patterns inside our UI hooks. This allows DOM elements to fade in gracefully only when crossing the active viewport boundary, drastically reducing idle background CPU overhead.

---

## 🛡️ Security Best Practices Implemented

* **JWT Signature Validations**: Frontend actions require active authorization Bearer credentials. The API authenticates incoming requests strictly via cryptographically secure JSON Web Tokens (`jwt.verify`) prior to routing logic.
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
