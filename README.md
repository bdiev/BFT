# Body Fat Tracker & Water Counter (PWA)

Full-stack PWA to track body fat (US Navy formula) and daily water intake with accounts, offline sync, and real-time updates.

## Features
- **Auth & accounts:** sign up / log in with JWT cookies, change password, delete account; remembers session with “Remember me”.
- **Personal layout:** toggle card visibility, reorder cards, switch between single-column and 3-per-row grid layout.
- **Body fat calculator:** male/female Navy formula (hips for female), save results, history list with inline details, delete entries, clear history.
- **Charts:** custom canvas charts for body fat trend (last 24 points) and water consumption (day/week/month/year), full-width in grid mode for readability.
- **Water tracker:** daily goal (auto-calculated from weight & activity), reset time, quick-add buttons, per-drink history, deletions.
- **Offline & PWA:** installable, service worker caching, queues POST/PUT/DELETE while offline and syncs when back online; landing page for guests.
- **Real-time:** WebSocket pushes entry/water updates across devices for the same user.- **Analytics:** Admin panel tracks site visits with breakdown by registered users vs anonymous visitors; counts all page loads and PWA app launches.
## Tech Stack
- Frontend: vanilla HTML/CSS/JS, Canvas-based charts, PWA (manifest + service worker).
- Backend: Node.js (Express), SQLite, JWT auth, WebSocket (`ws`).

## Quick Start
```bash
npm install
npm run start     # starts on http://localhost:3000
# or
npm run dev       # with nodemon
```
Open http://localhost:3000 in a browser. For PWA/service-worker, serve over http/https (not file://).

## Environment Variables
- `PORT` — server port (default 3000)
- `JWT_SECRET` — secret for JWT signing (change in production)
- `DB_PATH` — path to SQLite file (default: ./database.db). Directory is created automatically.

## Data & Persistence
- SQLite stores users, body-fat entries, user settings (cards), water settings, water logs, and visit logs.
- WebSocket server broadcasts updates; offline queue retries API writes when back online.

## Admin Panel
Admin users (set via `is_admin` flag in users table) can access `/admin` to:
- **View analytics:** total users, entries, water logs, weight logs, and site visit statistics.
- **Manage users:** search, toggle admin role, reset passwords, delete accounts.
- **Real-time updates:** WebSocket notifies admins of new registrations, deletions, and role changes.

### Visit Tracking
The app automatically logs visits from:
- **Page loads:** all HTML page loads (index.html, admin.html) via `navigator.sendBeacon()`.
- **PWA app launches:** explicit API call on app initialization.
- **Breakdown:** distinguishes between registered user visits and anonymous visitor visits.

## Key API Endpoints
- `POST /api/signup` — register new user.
- `POST /api/login` — authenticate user.
- `POST /api/logout` — clear auth cookie.
- `GET /api/me` — current user info.
- `POST /api/log-visit` — log a page visit (auto-called on page load).
- `GET /api/admin/stats` — (admin-only) aggregated stats: user count, entry count, visit count.
- `GET /api/admin/users` — (admin-only) list all users with stats.
- `POST /api/admin/users/:id/toggle-admin` — (admin-only) toggle user admin status.
- `POST /api/admin/users/:id/reset-password` — (admin-only) reset user password.
- `DELETE /api/admin/users/:id` — (admin-only) delete user.
- `GET /api/admin/debug-visits` — (admin-only) inspect visits table structure and recent records.
- `POST /api/admin/test-visit` — (admin-only) log a test visit for debugging.

## Project Structure
- `index.html` — UI layout
- `style.css` — styles and grid/card/charts look
- `app.js` — UI logic, calculators, charts, offline queue, WebSocket, PWA hooks
- `service-worker.js` — static asset caching
- `manifest.json` — PWA manifest
- `server.js` — Express API + WebSocket + SQLite

## Updating Static Assets
When changing cached files, bump the cache version or asset list in `service-worker.js`, then reload (hard refresh) to pick up new assets.
