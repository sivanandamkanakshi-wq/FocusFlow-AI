# FocusFlow AI

Smart Productivity and Career Development Dashboard.

## Project structure

- `frontend/` - React, Vite, and JavaScript application.
- `backend/` - Flask application and future data layer.
- `docs/` - Project documentation.

## Start the frontend

```powershell
cd frontend
npm run dev
```

## Start the backend

```powershell
cd backend
.\\.venv\\Scripts\\python.exe app.py
```

The backend runs at `http://127.0.0.1:5000`.

## Authentication and task APIs

Task ownership now comes from the secure Flask server-side session. Client-supplied `user_id` is rejected. State-changing requests require an `X-CSRF-Token` returned by `GET /api/auth/csrf`.

Authentication endpoints:

- `GET /api/auth/csrf`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Task endpoints:

- `GET /api/tasks` lists tasks for the authenticated user.
- `POST /api/tasks` creates a task. JSON: `{"title":"Plan sprint","description":"","due_date":"2026-11-07","priority":"high"}`
- `PUT /api/tasks/<task_id>` updates `title`, `description`, `due_date`, `priority`, and/or `status`.
- `DELETE /api/tasks/<task_id>` deletes an owned task.

Allowed priority values are `low`, `medium`, and `high`. Allowed status values are `pending`, `in_progress`, and `completed`.

## Google OAuth configuration

Copy `backend/.env.example` to `backend/.env`, then set:

- `SECRET_KEY` to a long random value.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from Google Cloud Console.
- `GOOGLE_REDIRECT_URI` to `http://localhost:5000/api/auth/google/callback`.
- `FRONTEND_URL` to the active Vite origin, such as `http://localhost:5174`.

Register the callback URL as an authorized redirect URI in Google Cloud Console. Do not commit `backend/.env` or credentials. Real Google sign-in remains unavailable until both Google environment values are configured.

## Password reset email configuration

Set the `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`,
`SMTP_USE_TLS`, and `PASSWORD_RESET_URL` values in `backend/.env`. Password reset
tokens are stored only as SHA-256 hashes and expire after 30 minutes. The forgot
password response does not reveal whether an email address is registered.
