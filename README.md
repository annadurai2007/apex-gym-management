# 🏋️‍♂️ APEX FITNESS CLUB — PREMIUM GYM MANAGEMENT SYSTEM

A full-stack, enterprise-grade Gym Management System engineered with a luxury dark fitness brand aesthetic (**Deep Black `#090B0A`**, **Dark Charcoal `#141715`**, **Neon Lime `#C6FF00`**), powered by a modular Python Flask REST API, MySQL relational database, JWT role-based access control, Chart.js dynamic analytics, and a Vanilla JavaScript frontend.

---

## 📸 SYSTEM ARCHITECTURE & PREVIEWS

- **Public Landing Page**: Cinematic hero section ("BUILD YOUR STRONGER SELF"), interactive BMI & TDEE Calorie Calculator, live dynamic plan pricing cards, master coach showcase, member testimonials, and concierge contact desk.
- **Authentication Portal**: Split-screen luxury layout with 1-click Demo Account presets for Admin, Master Trainer, Active Member, and Expiring Member.
- **Admin Management Suite**: Real-time business intelligence metrics, interactive Chart.js revenue/attendance/membership graphs, full CRUD operations for Members, Trainers, Plans, Payments, Workouts, and Diets, express attendance check-in desk, and one-click CSV report exports.
- **Member Self-Service Portal**: Personalized welcome dashboard, animated membership expiration countdown, assigned weekly workout split with interactive completion checkboxes, nutrition & macronutrient timetable, coach dossier, and printable receipts.

```
Gym Management System/
├── frontend/
│   ├── index.html            # Public Landing Page
│   ├── login.html            # Authentication (Admin, Trainer, Member)
│   ├── admin-dashboard.html  # Executive Management Suite
│   ├── member-dashboard.html # Personalized Member Portal
│   ├── css/
│   │   ├── variables.css     # Design tokens, color palette, typography
│   │   ├── main.css          # Core components: buttons, tables, modals, toasts
│   │   ├── landing.css       # Cinematic landing page styles
│   │   └── dashboard.css     # Admin & Member dashboard layouts, sidebar, charts
│   └── js/
│       ├── config.js         # API base URL & universal JWT fetch client
│       ├── ui.js             # Toasts, confirmation modal dialogs, formatters
│       ├── auth.js           # Auth state, session storage, route guards
│       ├── landing.js        # Landing page interactivity & live plans loader
│       ├── admin.js          # Admin suite controller with Chart.js & full CRUD
│       └── member.js         # Member portal controller (countdown, routines, diets)
├── backend/
│   ├── app.py                # Flask application factory, CORS, static routes
│   ├── config.py             # Environment configuration manager
│   ├── database.py           # PyMySQL connection pool & query executor
│   ├── requirements.txt      # Python dependencies
│   ├── routes/
│   │   ├── auth_routes.py         # Login, /me, password changes
│   │   ├── dashboard_routes.py    # Stats counters, Chart.js datasets, alerts
│   │   ├── member_routes.py       # Member CRUD, search, photo uploads
│   │   ├── trainer_routes.py      # Trainer CRUD & member assignments
│   │   ├── plan_routes.py         # Membership tiers & custom pricing
│   │   ├── membership_routes.py   # Plan activation, renewal, expiring alerts
│   │   ├── attendance_routes.py   # Check-in, checkout, duplicate prevention
│   │   ├── payment_routes.py      # Billing, receipt generation, dues
│   │   ├── workout_routes.py      # Workout routine templates & assignments
│   │   ├── diet_routes.py         # Nutrition blueprints & meal timetables
│   │   ├── report_routes.py       # Metrics summary & CSV downloads
│   │   └── notification_routes.py # In-app notification alerts
│   ├── utils/
│   │   ├── auth_middleware.py     # JWT token verification & role decorators
│   │   └── helpers.py             # Serializers, invoice & code generators
│   └── uploads/                   # Member avatar uploads directory
├── database/
│   ├── schema.sql            # Complete MySQL DDL schema with foreign keys
│   └── seed.sql              # Rich development and demo seed data
├── tests/
│   └── test_system.py        # Automated end-to-end integration test suite
├── .env.example              # Environment variables template
├── .env                      # Local environment configuration
├── .gitignore                # Production ignore patterns
├── requirements.txt          # Root Python dependencies
├── run.py                    # Unified application runner & CLI manager
└── README.md                 # Complete project documentation
```

---

## ⚡ QUICK START GUIDE

### 1. Prerequisites
- **Python 3.10+** (Python 3.14 recommended)
- **MySQL or MariaDB 10.4+** (XAMPP, Laragon, Docker, or native service)
- **Git** (optional)

### 2. Configure Database Credentials
Edit `.env` (or `backend/.env`) to match your MySQL connection settings:
```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=gym_management_db

JWT_SECRET_KEY=apex_gym_jwt_secret_token_key_2026_super_secure
JWT_EXPIRES_HOURS=24
FLASK_PORT=5000
```

### 3. Initialize Schema & Seed Data
Run the built-in database setup command:
```bash
python run.py --init-db
```
This will:
1. Create the `gym_management_db` database if it does not exist.
2. Execute `database/schema.sql` creating all 15 relational tables with foreign keys and indexes.
3. Populate `database/seed.sql` with realistic users, plans, trainers, members, check-ins, payments, workouts, and diets.

### 4. Start the Application
```bash
python run.py
```
Open your browser to:
- **Landing Page**: [http://127.0.0.1:5000/](http://127.0.0.1:5000/)
- **Sign In Portal**: [http://127.0.0.1:5000/login](http://127.0.0.1:5000/login)
- **Admin Dashboard**: [http://127.0.0.1:5000/admin](http://127.0.0.1:5000/admin)
- **Member Portal**: [http://127.0.0.1:5000/member](http://127.0.0.1:5000/member)

---

## 🔑 DEFAULT TEST CREDENTIALS

All test accounts are pre-configured in seed data with working password hashes:

| Role | Name | Email | Password | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Administrator | `admin@apexgym.com` | `Admin@123` | Full administrative suite access |
| **Trainer** | Marcus Vance | `marcus@apexgym.com` | `Trainer@123` | Strength & Conditioning coach |
| **Member** | Alex Rivera | `alex@apexgym.com` | `Member@123` | Active Platinum Elite member |
| **Member** | Sarah Connor | `sarah@apexgym.com` | `Member@123` | Gold member (Expiring in 3 days) |
| **Member** | Jordan Miller | `jordan@apexgym.com` | `Member@123` | Silver member (Expired plan) |

> 💡 *Tip: On the `/login` page, you can click any of the quick-fill pill buttons to automatically populate these credentials.*

---

## 🛠️ REST API ENDPOINTS SPECIFICATION

### Authentication (`/api/auth`)
- `POST /api/auth/login` — Authenticate user and issue JWT token.
- `GET /api/auth/me` — Retrieve current authenticated user profile.
- `POST /api/auth/change-password` — Change password for authenticated session.

### Executive Dashboard (`/api/dashboard`)
- `GET /api/dashboard/stats` — Real-time metrics (members count, attendance count, revenue, pending dues).
- `GET /api/dashboard/charts` — Chart.js datasets for revenue trends, attendance bar chart, and plan doughnut.
- `GET /api/dashboard/recent-activity` — Recent registrations, transactions, and expiring memberships.

### Members (`/api/members`)
- `GET /api/members` — Paginated list with search (`?search=`), status filter (`?status=`), and page control.
- `POST /api/members` — Register new member, create login account, and assign initial plan.
- `GET /api/members/<id>` — Full member dossier with attendance, payments, and workout routine.
- `PUT /api/members/<id>` — Update profile attributes.
- `DELETE /api/members/<id>` — Delete member and user account.
- `POST /api/members/<id>/photo` — Upload or update avatar photo.

### Trainers (`/api/trainers`)
- `GET /api/trainers` — List master trainers with assigned client counts.
- `POST /api/trainers` — Register new trainer.
- `PUT /api/trainers/<id>` — Update coach details.
- `POST /api/trainers/assign` — Assign a member to a trainer.

### Membership Plans & Renewals (`/api/plans`, `/api/memberships`)
- `GET /api/plans` — Public & admin membership tiers list.
- `POST /api/plans` — Create new membership tier.
- `PUT /api/plans/<id>` — Update pricing, duration, features, and status.
- `POST /api/memberships/assign` — Assign or renew a plan for a member.
- `GET /api/memberships/expiring` — Filter memberships expiring within N days.

### Attendance Desk (`/api/attendance`)
- `POST /api/attendance/check-in` — Fast check-in with member code (`APX-XXXX`) and duplicate prevention.
- `POST /api/attendance/check-out` — Record checkout timestamp.
- `GET /api/attendance/today` — Live roster of members checked in today.
- `GET /api/attendance/history` — Historical attendance log with date range filters.
- `GET /api/attendance/member/<member_id>` — Member-specific attendance timeline.

### Billing & Payments (`/api/payments`)
- `GET /api/payments` — Filterable payment ledger (search, status, method, date ranges).
- `POST /api/payments` — Record offline payment with automatic invoice numbering (`INV-YYYYMM-XXXX`).
- `GET /api/payments/<id>/receipt` — Official printable receipt with gym details and tax ID.
- `GET /api/payments/pending` — List expired or pending membership accounts.

### Workout & Diet Blueprints (`/api/workouts`, `/api/diets`)
- `GET /api/workouts` & `POST /api/workouts` — Manage routine templates with weekly exercises, sets, reps, and rest periods.
- `POST /api/workouts/assign` — Assign workout routine to member.
- `GET /api/workouts/member/<member_id>` — Active workout routine for member.
- `GET /api/diets` & `POST /api/diets` — Manage nutrition blueprints with calorie target, macro distribution, and meal schedules.
- `POST /api/diets/assign` — Assign diet blueprint to member.
- `GET /api/diets/member/<member_id>` — Active diet blueprint for member.

### Business Reports & CSV Export (`/api/reports`)
- `GET /api/reports/summary` — Aggregate revenue by method, top plans, and trainer performance.
- `GET /api/reports/export/payments` — Downloadable payments CSV.
- `GET /api/reports/export/attendance` — Downloadable attendance CSV.

---

## 🧪 AUTOMATED TESTING

A complete test suite is provided in `tests/test_system.py` verifying all 22 critical integration paths:
```bash
python -m unittest tests/test_system.py
```
Output:
```
Ran 22 tests in 31.393s
OK
```

---

## 🚀 DEPLOYMENT GUIDE

### Option A: 1-Command Docker Deployment (Recommended)
Launch the entire system with MySQL container, automatic schema/seed initialization, and Gunicorn web server:
```bash
docker compose up --build -d
```
Access at `http://localhost:5000`.

### Option B: Cloud Deployment (Render / Railway / Heroku / Koyeb)
1. Push repository to GitHub.
2. In Render or Railway, choose **Deploy from GitHub repo**.
3. It detects `Procfile` and `wsgi.py` automatically:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn wsgi:app --bind 0.0.0.0:$PORT --workers 2 --threads 4`
4. Connect a cloud MySQL database (e.g. Aiven, PlanetScale, Supabase, or Railway MySQL plugin) and set `.env` variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET_KEY`).

### Option C: Windows Server / Local Production
Run with the high-performance multi-threaded Waitress WSGI server:
```bash
python run_waitress.py
```

### Option D: Linux Ubuntu VPS (Nginx + Gunicorn + Systemd)
1. Install dependencies: `pip install -r requirements.txt`
2. Start Gunicorn:
   ```bash
   gunicorn -w 4 -b 127.0.0.1:5000 wsgi:app
   ```
3. Configure Nginx reverse proxy to forward port 80/443 to `http://127.0.0.1:5000`.

---

## 🛡️ SECURITY IMPLEMENTATION

- **Password Security**: Salted hashes generated using `werkzeug.security` (scrypt algorithm).
- **SQL Injection Prevention**: 100% parameterized queries via PyMySQL.
- **Authorization**: Cryptographically signed JWT tokens with 24-hour expiration.
- **Role-Based Access Control**: Decorators `@token_required` and `@role_required` strictly protect administrative endpoints and isolate member records.
- **Duplicate Prevention**: Unique constraints and daily date matching prevent duplicate check-ins.
- **File Upload Protection**: Whitelisted image extensions (`.png`, `.jpg`, `.jpeg`, `.webp`), secure filename generation with timestamp hashing, and file size limits (16MB).
