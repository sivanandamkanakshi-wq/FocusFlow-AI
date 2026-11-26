"""SQLite database connection and table setup."""

import sqlite3
from pathlib import Path


DATABASE_PATH = Path(__file__).resolve().parent / "focusflow.db"


def get_connection():
    """Create and return a SQLite connection with foreign keys enabled."""
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database():
    """Create and migrate application tables without modifying existing data."""
    connection = get_connection()

    try:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                due_date DATE,
                priority TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """
        )
        user_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(users)").fetchall()
        }
        if "google_subject" not in user_columns:
            connection.execute(
                "ALTER TABLE users ADD COLUMN google_subject TEXT"
            )
        task_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(tasks)").fetchall()
        }
        if "completed_at" not in task_columns:
            connection.execute("ALTER TABLE tasks ADD COLUMN completed_at TEXT")
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_tasks_user_status_completed
            ON tasks(user_id, status, completed_at)
            """
        )
        connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_subject
            ON users(google_subject)
            WHERE google_subject IS NOT NULL
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
            ON password_reset_tokens(user_id)
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS focus_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_type TEXT NOT NULL CHECK (session_type IN ('focus', 'short_break', 'long_break', 'custom_focus')),
                mode TEXT NOT NULL CHECK (mode IN ('pomodoro', 'long_focus', 'custom')),
                duration_minutes INTEGER NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                paused_at TEXT,
                accumulated_paused_seconds INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_sessions_one_active_per_user
            ON focus_sessions(user_id)
            WHERE status IN ('active', 'paused')
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_focus_sessions_history
            ON focus_sessions(user_id, status, completed_at)
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS focus_goals (
                user_id INTEGER PRIMARY KEY,
                daily_minutes INTEGER NOT NULL DEFAULT 60,
                daily_sessions INTEGER NOT NULL DEFAULT 4,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS dsa_problems (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                problem_name TEXT NOT NULL,
                problem_url TEXT NOT NULL,
                difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
                topic TEXT NOT NULL CHECK (topic IN ('Arrays', 'Strings', 'Math', 'Sorting', 'Searching', 'Binary Search', 'Hashing', 'Two Pointers', 'Sliding Window', 'Recursion', 'Dynamic Programming', 'Other')),
                completion_date DATE NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_dsa_problems_user_date
            ON dsa_problems(user_id, completion_date)
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_dsa_problems_user_filters
            ON dsa_problems(user_id, difficulty, topic)
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS career_goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                target_date DATE,
                status TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_career_goals_user_status
            ON career_goals(user_id, status)
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_career_goals_user_target
            ON career_goals(user_id, target_date)
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS career_skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goal_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                skill_name TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0
                    CHECK (progress >= 0 AND progress <= 100),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (goal_id) REFERENCES career_goals(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_career_skills_goal
            ON career_skills(goal_id, user_id)
            """
        )
        connection.commit()
    finally:
        connection.close()
