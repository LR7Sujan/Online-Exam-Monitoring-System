# 🛡️ ProctorIQ
## Online Exam Monitoring & Anti-Cheating System

> 📺 **Demo video:** *add your link here*

A real-time exam proctoring platform with three roles (Admin, Proctor, Student). Penalties, terminations and grading are enforced **inside MySQL** with triggers, stored procedures and transactions, so results stay correct even if violations arrive from several sources at once.

---

## 🚀 Capabilities

| Feature | Description |
|---|---|
| 🧮 **Trust Score Engine** | Students start at 100. A database trigger deducts points per violation and auto-terminates the exam below the minimum score |
| 👁️ **AI Detection** | Face, multiple faces, phone and speech detection, all running in the browser |
| ⚠️ **Warning System** | One penalty, one full-screen warning, then detection resumes after the student confirms |
| 🔀 **Unique Papers** | Questions and options are shuffled per student, and the answer key never leaves the server |
| ⏱️ **Extra Time Requests** | Students request extra minutes and the proctor approves, edits or rejects in real time |
| 📡 **Live Monitor** | Shows only students currently taking an exam, updated in real time |
| 🎥 **Exam Recording** | Webcam video stored for staff review in a full player (seek, 2x speed, fullscreen) |
| 🗂️ **Student Audit** | Each candidate's progress, average trust, scorecards and recordings |
| 🎨 **Themes** | Dark and cream-light themes with selectable accent colors |

---

## 👥 Roles

| Role | Can do |
|---|---|
| **Admin** | Manage exams, questions, penalty rules and users. View analytics, recordings and student audit |
| **Proctor** | Monitor live exams, review violations (Confirm / Dismiss), handle time requests, terminate sessions |
| **Student** | Take exams, see warnings, request extra time, view results |

---

## ⚖️ Violation & Penalty Rules

Penalties are **not fixed**. The admin can change the points for every violation type from the **Rules & Simulator** tab in the Admin Console, and the change applies to the next violation with no code changes. They are stored in the `Violation_Types` table.

| Violation | Detection |
|---|---|
| Tab switch / minimize | Browser visibility event |
| Fullscreen exit | Fullscreen event |
| Copy / cut / paste | Clipboard events |
| No face in frame | Face detection |
| Multiple faces | 2 or more faces for 5 continuous seconds |
| Phone detected | Object detection |
| Speech detected | Sustained speech on the microphone |
| DevTools opened | Window size and timing check |

If the trust score drops below the exam's minimum, the exam is terminated and the student is disqualified. A proctor can **Dismiss** a false alarm and the points are restored automatically.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Database** | MySQL 8.0+ (triggers, stored procedures, views) |
| **Backend** | Node.js, Express, TypeScript, Zod, JWT, bcrypt |
| **Frontend** | React, Vite, TypeScript, Tailwind CSS, Framer Motion, Recharts |
| **AI (in-browser)** | MediaPipe, Web Audio API |
| **Testing** | Vitest/Jest, Playwright |

---

## ⚡ Quick Start

### Requirements

| Requirement | Details |
|---|---|
| **Node.js** | 20.6 or newer (uses native `process.loadEnvFile` and `--env-file`) |
| **MySQL** | 8.0 or newer (must support triggers and stored procedures) |
| **Browser** | Chrome or Edge, with camera and microphone for students |

> On Windows, install MySQL Community Server as a service and check in `services.msc` that **MySQL80** is running.

### Run the project

```bash
git clone <your-repository-url>
cd <project-folder>
npm install && npm --prefix server install && npm --prefix client install
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `.env` with your database details:

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=proctoriq
JWT_SECRET=use-a-long-random-string
```

Then create the database and start the app:

```bash
npm run db:migrate    # tables, triggers, procedures, views
npm run db:seed       # demo users and exams
npm run dev           # starts the API and the website
```

Open **http://localhost:5173** (API runs on **http://localhost:4000**).

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@proctoriq.io` | *add here* |
| Proctor | `proctor@proctoriq.io` | *add here* |
| Student | `student@proctoriq.io` | *add here* |

> ⚠️ Change all demo passwords before putting the site online. Never commit `.env` or database dumps.

---

## 🧪 Testing

Tests use a separate database whose name ends in `_test`, so they never touch real data.

```bash
npm run db:test:reset
npm test
npm run test:e2e
```

---

## 🔐 Security & Privacy

- Passwords hashed with bcrypt, JWT login with role checks on every route
- Scores, penalties, time and question order are decided on the server
- Violation audit log is protected by a database trigger and cannot be deleted
- Recordings are visible to Admin and Proctor only, every view is logged, and files are deleted after the retention period
- Audio is analyzed on the student's device and is **never recorded or uploaded**
- Students accept a consent notice before the camera and microphone are used

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL isn't running. Start **MySQL80** in `services.msc` |
| `Access denied for user` | Check `DB_USER` and `DB_PASSWORD` in `.env` |
| `Unknown database` | Run `npm run db:migrate` |
| Sidebar shows **DISCONNECTED** | Make sure both the API and MySQL are running |
| Camera or microphone blocked | Allow permissions. This needs `localhost` or HTTPS |

---

## ⚠️ Known Limitations

- Browser-based proctoring can be bypassed, so use a lockdown browser for high-stakes exams
- Phone and speech detection can misfire. Proctors can dismiss false alarms
- Recordings use disk space, so set the retention period to match your storage

---

## 📄 License

*Add your license here (for example MIT).*

---

## 👤 Author

| Platform | Link |
|---|---|
| GitHub | *add your profile link* |
| Contact | *add your email* |

⭐ **Star the repository if this project helped you.**
