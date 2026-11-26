import hashlib
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import database
import app as app_module


class FocusFlowBackendTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = os.path.join(self.temp_dir.name, "test.db")
        self.database_patch = patch.object(database, "DATABASE_PATH", self.database_path)
        self.database_patch.start()
        database.initialize_database()
        app_module.ai_chat_attempts.clear()

        app_module.app.config.update(TESTING=True)
        self.client = app_module.app.test_client()

        csrf_response = self.client.get("/api/auth/csrf")
        self.csrf = csrf_response.get_json()["csrf_token"]
        self.headers = {
            "Content-Type": "application/json",
            "X-CSRF-Token": self.csrf,
        }

    def tearDown(self):
        self.database_patch.stop()
        self.temp_dir.cleanup()

    def register(self, email="user@example.com"):
        return self.client.post(
            "/api/auth/register",
            headers=self.headers,
            json={
                "name": "Test User",
                "email": email,
                "password": "StrongPass1!",
                "confirmPassword": "StrongPass1!",
            },
        )

    def login(self, email="user@example.com"):
        return self.client.post(
            "/api/auth/login",
            headers=self.headers,
            json={"email": email, "password": "StrongPass1!"},
        )

    def test_registration_login_and_session_authentication(self):
        registration = self.register()
        self.assertEqual(registration.status_code, 201)
        login = self.login()
        self.assertEqual(login.status_code, 200)
        me = self.client.get("/api/auth/me")
        self.assertTrue(me.get_json()["authenticated"])

    def test_csrf_is_required_for_login(self):
        response = self.client.post(
            "/api/auth/login",
            json={"email": "user@example.com", "password": "StrongPass1!"},
        )
        self.assertEqual(response.status_code, 403)

    def test_invalid_password_and_invalid_csrf_are_rejected(self):
        self.register()
        invalid_password = self.client.post(
            "/api/auth/login",
            headers=self.headers,
            json={"email": "user@example.com", "password": "WrongPassword1!"},
        )
        self.assertEqual(invalid_password.status_code, 401)
        invalid_csrf_headers = {
            "Content-Type": "application/json",
            "X-CSRF-Token": "not-the-session-token",
        }
        invalid_csrf = self.client.post(
            "/api/auth/login",
            headers=invalid_csrf_headers,
            json={"email": "user@example.com", "password": "WrongPassword1!"},
        )
        self.assertEqual(invalid_csrf.status_code, 403)

    def test_registration_is_rejected_without_csrf(self):
        response = self.client.post(
            "/api/auth/register",
            json={
                "name": "Test User",
                "email": "missing-csrf@example.com",
                "password": "StrongPass1!",
                "confirmPassword": "StrongPass1!",
            },
        )
        self.assertEqual(response.status_code, 403)

    def test_tasks_are_isolated_by_authenticated_session(self):
        self.register("first@example.com")
        self.login("first@example.com")
        created = self.client.post(
            "/api/tasks",
            headers=self.headers,
            json={"title": "First user's task"},
        )
        self.assertEqual(created.status_code, 201)

        supplied_user_id = self.client.post(
            "/api/tasks",
            headers=self.headers,
            json={"title": "Rejected", "user_id": 999},
        )
        self.assertEqual(supplied_user_id.status_code, 400)

        self.register("second@example.com")
        self.login("second@example.com")
        listed = self.client.get("/api/tasks")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.get_json()["data"], [])

        unauthorized_update = self.client.put(
            "/api/tasks/1",
            headers=self.headers,
            json={"title": "Not allowed"},
        )
        self.assertEqual(unauthorized_update.status_code, 404)

    def test_forgot_password_is_non_disclosing_and_reset_token_is_hashed(self):
        self.register()
        unknown = self.client.post(
            "/api/auth/forgot-password",
            headers=self.headers,
            json={"email": "unknown@example.com"},
        )
        self.assertEqual(unknown.status_code, 200)

        with patch.object(app_module, "send_password_reset_email") as send_email:
            known = self.client.post(
                "/api/auth/forgot-password",
                headers=self.headers,
                json={"email": "user@example.com"},
            )
        self.assertEqual(known.status_code, 200)
        send_email.assert_called_once()
        reset_url = send_email.call_args.args[1]
        raw_token = reset_url.rsplit("token=", 1)[1]
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

        connection = database.get_connection()
        try:
            stored = connection.execute(
                "SELECT token_hash FROM password_reset_tokens WHERE token_hash = ?",
                (token_hash,),
            ).fetchone()
        finally:
            connection.close()
        self.assertIsNotNone(stored)

    def test_password_reset_changes_password_and_token_cannot_be_reused(self):
        self.register()
        raw_token = "single-use-test-token"
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        connection = database.get_connection()
        user = connection.execute(
            "SELECT id FROM users WHERE email = ?",
            ("user@example.com",),
        ).fetchone()
        connection.execute(
            """
            INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
            VALUES (?, ?, ?)
            """,
            (user["id"], token_hash, (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()),
        )
        connection.commit()
        connection.close()

        reset = self.client.post(
            "/api/auth/reset-password",
            headers=self.headers,
            json={"token": raw_token, "password": "NewStrong2!", "confirmPassword": "NewStrong2!"},
        )
        self.assertEqual(reset.status_code, 200)
        new_csrf = self.client.get("/api/auth/csrf").get_json()["csrf_token"]
        reuse_headers = {
            "Content-Type": "application/json",
            "X-CSRF-Token": new_csrf,
        }
        reuse = self.client.post(
            "/api/auth/reset-password",
            headers=reuse_headers,
            json={"token": raw_token, "password": "AnotherStrong3!", "confirmPassword": "AnotherStrong3!"},
        )
        self.assertEqual(reuse.status_code, 400)
        login_before_password_change = self.client.post(
            "/api/auth/login",
            headers=reuse_headers,
            json={"email": "user@example.com", "password": "NewStrong2!"},
        )
        self.assertEqual(login_before_password_change.status_code, 200)
        old_login = self.client.post(
            "/api/auth/login",
            headers=reuse_headers,
            json={"email": "user@example.com", "password": "StrongPass1!"},
        )
        self.assertEqual(old_login.status_code, 401)

    def test_password_reset_expired_token_is_rejected(self):
        self.register()
        raw_token = "expired-test-token"
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        connection = database.get_connection()
        user = connection.execute(
            "SELECT id FROM users WHERE email = ?",
            ("user@example.com",),
        ).fetchone()
        connection.execute(
            """
            INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
            VALUES (?, ?, ?)
            """,
            (user["id"], token_hash, (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()),
        )
        connection.commit()
        connection.close()

        reset = self.client.post(
            "/api/auth/reset-password",
            headers=self.headers,
            json={"token": raw_token, "password": "NewStrong2!", "confirmPassword": "NewStrong2!"},
        )
        self.assertEqual(reset.status_code, 400)

    def test_google_oauth_configuration_detection(self):
        with patch.dict(
            os.environ,
            {"GOOGLE_CLIENT_ID": "", "GOOGLE_CLIENT_SECRET": ""},
            clear=False,
        ):
            missing = self.client.get("/api/auth/google")
        self.assertEqual(missing.status_code, 503)

        with patch.dict(
            os.environ,
            {"GOOGLE_CLIENT_ID": "test-client", "GOOGLE_CLIENT_SECRET": "test-secret"},
            clear=False,
        ):
            configured = self.client.get("/api/auth/google")
        self.assertEqual(configured.status_code, 302)

    def test_google_oauth_rejects_missing_or_mismatched_state(self):
        with patch.dict(
            os.environ,
            {"GOOGLE_CLIENT_ID": "test-client", "GOOGLE_CLIENT_SECRET": "test-secret"},
            clear=False,
        ):
            response = self.client.get("/api/auth/google")
            self.assertEqual(response.status_code, 302)
            with patch.object(app_module.google, "authorize_access_token") as authorize:
                callback = self.client.get(
                    "/api/auth/google/callback?state=incorrect"
                )
        self.assertEqual(callback.status_code, 400)
        authorize.assert_not_called()

    def test_focus_session_start_pause_resume_abandon_and_reset(self):
        self.register("focus@example.com")
        self.login("focus@example.com")
        started = self.client.post(
            "/api/focus/sessions/start",
            headers=self.headers,
            json={"mode": "custom", "session_type": "focus", "duration_minutes": 1},
        )
        self.assertEqual(started.status_code, 201)
        session_id = started.get_json()["data"]["id"]

        paused = self.client.post(
            f"/api/focus/sessions/{session_id}/pause",
            headers=self.headers,
        )
        self.assertEqual(paused.status_code, 200)
        self.assertEqual(paused.get_json()["data"]["status"], "paused")

        resumed = self.client.post(
            f"/api/focus/sessions/{session_id}/resume",
            headers=self.headers,
        )
        self.assertEqual(resumed.status_code, 200)
        self.assertEqual(resumed.get_json()["data"]["status"], "active")

        abandoned = self.client.post(
            f"/api/focus/sessions/{session_id}/abandon",
            headers=self.headers,
        )
        self.assertEqual(abandoned.status_code, 200)
        self.assertEqual(abandoned.get_json()["data"]["status"], "abandoned")

    def test_focus_completion_duplicate_and_break_not_focus(self):
        self.register("complete@example.com")
        self.login("complete@example.com")
        started = self.client.post(
            "/api/focus/sessions/start",
            headers=self.headers,
            json={"mode": "custom", "session_type": "focus", "duration_minutes": 1},
        )
        session_id = started.get_json()["data"]["id"]
        completed_at = (
            datetime.now(timezone.utc) + timedelta(seconds=65)
        ).isoformat().replace("+00:00", "Z")
        completed = self.client.post(
            f"/api/focus/sessions/{session_id}/complete",
            headers=self.headers,
            json={"completed_at": completed_at},
        )
        self.assertEqual(completed.status_code, 200)
        duplicate = self.client.post(
            f"/api/focus/sessions/{session_id}/complete",
            headers=self.headers,
            json={"completed_at": completed_at},
        )
        self.assertEqual(duplicate.status_code, 200)
        self.assertTrue(duplicate.get_json().get("duplicate"))

        stats = self.client.get(
            "/api/focus/stats?timezone_offset_minutes=0",
        ).get_json()["data"]
        self.assertEqual(stats["total_completed_sessions"], 1)

        break_session = self.client.post(
            "/api/focus/sessions/start",
            headers=self.headers,
            json={"mode": "pomodoro", "session_type": "short_break", "duration_minutes": 5},
        )
        self.assertEqual(break_session.status_code, 201)
        break_id = break_session.get_json()["data"]["id"]
        completed_break_at = (
            datetime.now(timezone.utc) + timedelta(seconds=305)
        ).isoformat().replace("+00:00", "Z")
        self.client.post(
            f"/api/focus/sessions/{break_id}/complete",
            headers=self.headers,
            json={"completed_at": completed_break_at},
        )
        stats = self.client.get(
            "/api/focus/stats?timezone_offset_minutes=0",
        ).get_json()["data"]
        self.assertEqual(stats["total_completed_sessions"], 1)
        self.assertEqual(stats["total_focus_minutes"], 1)

    def test_focus_session_history_is_user_owned_and_csrf_protected(self):
        self.register("owner@example.com")
        self.login("owner@example.com")
        started = self.client.post(
            "/api/focus/sessions/start",
            headers=self.headers,
            json={"mode": "custom", "session_type": "focus", "duration_minutes": 1},
        )
        session_id = started.get_json()["data"]["id"]

        missing_csrf = self.client.post(
            f"/api/focus/sessions/{session_id}/pause",
        )
        self.assertEqual(missing_csrf.status_code, 403)

        history = self.client.get("/api/focus/sessions")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(len(history.get_json()["data"]), 1)

        self.client.post(
            "/api/auth/logout",
            headers=self.headers,
        )
        csrf_response = self.client.get("/api/auth/csrf")
        self.csrf = csrf_response.get_json()["csrf_token"]
        self.headers["X-CSRF-Token"] = self.csrf
        self.register("other@example.com")
        self.login("other@example.com")
        other_history = self.client.get("/api/focus/sessions")
        self.assertEqual(other_history.get_json()["data"], [])

    def test_focus_goals_daily_stats_and_streak_calculation(self):
        self.register("goals@example.com")
        self.login("goals@example.com")
        unauthenticated = app_module.app.test_client()
        self.assertEqual(
            unauthenticated.get("/api/focus/stats").status_code,
            401,
        )
        updated = self.client.put(
            "/api/focus/goals",
            headers=self.headers,
            json={"daily_minutes": 90, "daily_sessions": 3},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["data"]["daily_minutes"], 90)

        invalid_goal = self.client.put(
            "/api/focus/goals",
            headers=self.headers,
            json={"daily_minutes": 1, "daily_sessions": 0},
        )
        self.assertEqual(invalid_goal.status_code, 400)

        start = self.client.post(
            "/api/focus/sessions/start",
            headers=self.headers,
            json={"mode": "custom", "session_type": "focus", "duration_minutes": 1},
        )
        session_id = start.get_json()["data"]["id"]
        completed_at = (
            datetime.now(timezone.utc) + timedelta(seconds=65)
        ).isoformat().replace("+00:00", "Z")
        self.client.post(
            f"/api/focus/sessions/{session_id}/complete",
            headers=self.headers,
            json={"completed_at": completed_at},
        )
        stats = self.client.get("/api/focus/stats?timezone_offset_minutes=0").get_json()["data"]
        self.assertEqual(stats["today_sessions"], 1)
        self.assertEqual(stats["today_focus_minutes"], 1)
        self.assertEqual(stats["current_streak"], 1)
        self.assertEqual(stats["longest_streak"], 1)
        self.assertEqual(len(stats["weekly"]), 7)
        self.assertEqual(sum(day["sessions"] for day in stats["weekly"]), 1)

    def test_focus_streak_consecutive_dates(self):
        today = datetime.now(timezone.utc).date()
        dates = [
            (today - timedelta(days=2)).isoformat(),
            (today - timedelta(days=1)).isoformat(),
            today.isoformat(),
        ]
        longest, current = app_module.calculate_focus_streak(dates, today)
        self.assertEqual(longest, 3)
        self.assertEqual(current, 3)
        longest, current = app_module.calculate_focus_streak(
            [today.isoformat()],
            today + timedelta(days=2),
        )
        self.assertEqual(longest, 1)
        self.assertEqual(current, 0)

    def test_focus_start_requires_authentication_and_rejects_invalid_duration(self):
        client = app_module.app.test_client()
        started = client.post(
            "/api/focus/sessions/start",
            headers={"Content-Type": "application/json", "X-CSRF-Token": "missing"},
            json={"mode": "custom", "session_type": "focus", "duration_minutes": 10},
        )
        self.assertEqual(started.status_code, 403)

        self.register("duration@example.com")
        self.login("duration@example.com")
        invalid = self.client.post(
            "/api/focus/sessions/start",
            headers=self.headers,
            json={"mode": "custom", "session_type": "focus", "duration_minutes": 181},
        )
        self.assertEqual(invalid.status_code, 400)

    def test_dsa_create_retrieve_update_delete_and_duplicate_handling(self):
        self.register("dsa@example.com")
        self.login("dsa@example.com")
        payload = {
            "problem_name": "Two Sum",
            "problem_url": "https://leetcode.com/problems/two-sum/",
            "difficulty": "Easy",
            "topic": "Arrays",
            "completion_date": "2026-11-07",
            "notes": "Hash map",
        }
        created = self.client.post("/api/dsa/problems", headers=self.headers, json=payload)
        self.assertEqual(created.status_code, 201)
        problem_id = created.get_json()["data"]["id"]

        duplicate = self.client.post("/api/dsa/problems", headers=self.headers, json=payload)
        self.assertEqual(duplicate.status_code, 200)
        self.assertTrue(duplicate.get_json()["duplicate"])

        listed = self.client.get("/api/dsa/problems")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.get_json()["data"]), 1)

        updated = self.client.put(
            f"/api/dsa/problems/{problem_id}",
            headers=self.headers,
            json={"difficulty": "Medium", "notes": "Updated"},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["data"]["difficulty"], "Medium")

        deleted = self.client.delete(
            f"/api/dsa/problems/{problem_id}",
            headers=self.headers,
        )
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(self.client.get("/api/dsa/problems").get_json()["data"], [])

    def test_dsa_validation_unauthenticated_csrf_and_isolation(self):
        unauthenticated = app_module.app.test_client()
        self.assertEqual(unauthenticated.get("/api/dsa/problems").status_code, 401)
        self.assertEqual(
            unauthenticated.post(
                "/api/dsa/problems",
                json={"problem_name": "x"},
            ).status_code,
            403,
        )

        self.register("first-dsa@example.com")
        self.login("first-dsa@example.com")
        invalid_difficulty = self.client.post(
            "/api/dsa/problems",
            headers=self.headers,
            json={
                "problem_name": "Invalid",
                "problem_url": "https://leetcode.com/problems/invalid/",
                "difficulty": "Extreme",
                "topic": "Arrays",
                "completion_date": "2026-11-07",
            },
        )
        self.assertEqual(invalid_difficulty.status_code, 400)
        invalid_url = self.client.post(
            "/api/dsa/problems",
            headers=self.headers,
            json={
                "problem_name": "Invalid URL",
                "problem_url": "https://example.com/problem",
                "difficulty": "Easy",
                "topic": "Arrays",
                "completion_date": "2026-11-07",
            },
        )
        self.assertEqual(invalid_url.status_code, 400)

        created = self.client.post(
            "/api/dsa/problems",
            headers=self.headers,
            json={
                "problem_name": "Private",
                "problem_url": "https://leetcode.com/problems/private/",
                "difficulty": "Hard",
                "topic": "Other",
                "completion_date": "2026-11-07",
            },
        )
        problem_id = created.get_json()["data"]["id"]
        self.register("second-dsa@example.com")
        self.login("second-dsa@example.com")
        self.assertEqual(self.client.get("/api/dsa/problems").get_json()["data"], [])
        self.assertEqual(
            self.client.get(f"/api/dsa/problems/{problem_id}").status_code,
            404,
        )
        self.assertEqual(
            self.client.put(
                f"/api/dsa/problems/{problem_id}",
                headers=self.headers,
                json={"difficulty": "Easy"},
            ).status_code,
            404,
        )

    def test_dsa_summary_topic_difficulty_streak_and_analytics(self):
        self.register("analytics-dsa@example.com")
        self.login("analytics-dsa@example.com")
        records = [
            ("Two Sum", "easy", "Arrays", "Easy", "2026-11-05"),
            ("Two Sum II", "easy-two", "Arrays", "Medium", "2026-11-06"),
            ("Merge", "merge", "Sorting", "Hard", "2026-11-07"),
            ("Duplicate Date", "duplicate-date", "Sorting", "Easy", "2026-11-07"),
        ]
        for name, slug, topic, difficulty, date in records:
            response = self.client.post(
                "/api/dsa/problems",
                headers=self.headers,
                json={
                    "problem_name": name,
                    "problem_url": f"https://leetcode.com/problems/{slug}/",
                    "difficulty": difficulty,
                    "topic": topic,
                    "completion_date": date,
                },
            )
            self.assertIn(response.status_code, (200, 201))

        summary = self.client.get(
            "/api/dsa/summary?timezone_offset_minutes=330"
        ).get_json()["data"]
        self.assertEqual(summary["total_solved"], 4)
        self.assertEqual(summary["easy_solved"], 2)
        self.assertEqual(summary["medium_solved"], 1)
        self.assertEqual(summary["hard_solved"], 1)
        self.assertEqual(summary["topic_counts"]["Arrays"], 2)
        self.assertEqual(summary["topic_counts"]["Sorting"], 2)

        analytics = self.client.get(
            "/api/dsa/analytics?timezone_offset_minutes=330"
        ).get_json()["data"]
        self.assertEqual(analytics["difficulty_counts"]["Easy"], 2)
        self.assertEqual(analytics["topic_counts"]["Arrays"], 2)
        self.assertEqual(len(analytics["weekly"]), 7)
        self.assertEqual(len(analytics["monthly"]), 6)

        longest, current = app_module.calculate_dsa_streak(
            ["2026-11-05", "2026-11-06", "2026-11-07"],
            datetime.strptime("2026-11-07", "%Y-%m-%d").date(),
        )
        self.assertEqual((longest, current), (3, 3))
        longest, current = app_module.calculate_dsa_streak(
            ["2026-11-05", "2026-11-07"],
            datetime.strptime("2026-11-08", "%Y-%m-%d").date(),
        )
        self.assertEqual((longest, current), (1, 1))

    def test_dsa_invalid_csrf_on_create_and_delete(self):
        self.register("csrf-dsa@example.com")
        self.login("csrf-dsa@example.com")
        invalid_headers = {
            "Content-Type": "application/json",
            "X-CSRF-Token": "invalid",
        }
        response = self.client.post(
            "/api/dsa/problems",
            headers=invalid_headers,
            json={
                "problem_name": "Rejected",
                "problem_url": "https://leetcode.com/problems/rejected/",
                "difficulty": "Easy",
                "topic": "Arrays",
                "completion_date": "2026-11-07",
            },
        )
        self.assertEqual(response.status_code, 403)

    def test_career_goal_and_skill_crud_and_summary(self):
        self.register("career@example.com")
        self.login("career@example.com")

        created_goal = self.client.post(
            "/api/career/goals",
            headers=self.headers,
            json={
                "title": "Backend engineer",
                "description": "Grow backend depth",
                "target_date": "2026-12-31",
                "status": "active",
            },
        )
        self.assertEqual(created_goal.status_code, 201)
        goal_id = created_goal.get_json()["data"]["id"]

        skill_one = self.client.post(
            f"/api/career/goals/{goal_id}/skills",
            headers=self.headers,
            json={"skill_name": "Flask", "progress": 50, "notes": "Practice APIs"},
        )
        skill_two = self.client.post(
            f"/api/career/goals/{goal_id}/skills",
            headers=self.headers,
            json={"skill_name": "SQL", "progress": 100, "notes": None},
        )
        self.assertEqual(skill_one.status_code, 201)
        self.assertEqual(skill_two.status_code, 201)
        skill_id = skill_one.get_json()["data"]["id"]

        updated = self.client.put(
            f"/api/career/goals/{goal_id}/skills/{skill_id}",
            headers=self.headers,
            json={"progress": 75, "notes": "Updated"},
        )
        self.assertEqual(updated.status_code, 200)
        goal_detail = self.client.get(f"/api/career/goals/{goal_id}").get_json()["data"]
        self.assertEqual(goal_detail["skill_count"], 2)
        self.assertEqual(goal_detail["progress"], 87.5)
        self.assertEqual(goal_detail["completed_skills"], 1)
        self.assertEqual(goal_detail["remaining_skills"], 1)

        summary = self.client.get("/api/career/summary").get_json()["data"]
        self.assertEqual(summary["total_goals"], 1)
        self.assertEqual(summary["active_goals"], 1)
        self.assertEqual(summary["completed_goals"], 0)
        self.assertEqual(summary["total_skills"], 2)
        self.assertEqual(summary["completed_skills"], 1)
        self.assertEqual(summary["overall_skill_progress"], 87.5)

        complete_goal = self.client.put(
            f"/api/career/goals/{goal_id}",
            headers=self.headers,
            json={"status": "completed"},
        )
        self.assertEqual(complete_goal.status_code, 200)
        summary = self.client.get("/api/career/summary").get_json()["data"]
        self.assertEqual(summary["completed_goals"], 1)

        deleted_skill = self.client.delete(
            f"/api/career/goals/{goal_id}/skills/{skill_id}",
            headers=self.headers,
        )
        self.assertEqual(deleted_skill.status_code, 200)
        deleted_goal = self.client.delete(
            f"/api/career/goals/{goal_id}",
            headers=self.headers,
        )
        self.assertEqual(deleted_goal.status_code, 200)

    def test_analytics_empty_summary_activity_and_filters(self):
        self.register("analytics-empty@example.com")
        self.login("analytics-empty@example.com")
        summary = self.client.get("/api/analytics/summary").get_json()["data"]
        self.assertEqual(summary["total_tasks"], 0)
        self.assertEqual(summary["completed_tasks"], 0)
        self.assertEqual(summary["pending_tasks"], 0)
        self.assertEqual(summary["overdue_tasks"], 0)
        self.assertEqual(summary["total_completed_focus_sessions"], 0)
        self.assertEqual(summary["total_focus_minutes"], 0)
        self.assertEqual(summary["total_dsa_problems_solved"], 0)
        self.assertEqual(summary["total_career_goals"], 0)
        self.assertEqual(summary["overall_skill_progress"], 0)
        for period, expected_length in (("daily", 1), ("weekly", 7), ("monthly", 6)):
            activity = self.client.get(
                f"/api/analytics/activity?period={period}"
            )
            self.assertEqual(activity.status_code, 200)
            data = activity.get_json()["data"]
            self.assertEqual(len(data["labels"]), expected_length)
            self.assertFalse(any(data["tasks"]["created"]))
            self.assertFalse(any(data["tasks"]["completed"]))
            self.assertFalse(any(data["focus"]["minutes"]))
            self.assertFalse(any(data["dsa"]["completed"]))
        invalid_period = self.client.get("/api/analytics/activity?period=yearly")
        self.assertEqual(invalid_period.status_code, 400)
        invalid_timezone = self.client.get(
            "/api/analytics/activity?timezone_offset_minutes=not-a-number"
        )
        self.assertEqual(invalid_timezone.status_code, 400)

    def test_task_completion_timestamp_reopen_and_existing_completed_task(self):
        self.register("task-analytics@example.com")
        self.login("task-analytics@example.com")
        created = self.client.post(
            "/api/tasks",
            headers=self.headers,
            json={"title": "Analytics task", "due_date": None, "priority": "high"},
        )
        self.assertEqual(created.status_code, 201)
        task_id = created.get_json()["data"]["id"]

        completed = self.client.put(
            f"/api/tasks/{task_id}",
            headers=self.headers,
            json={"status": "completed"},
        )
        self.assertEqual(completed.status_code, 200)
        completion_timestamp = completed.get_json()["data"]["completed_at"]
        self.assertIsNotNone(completion_timestamp)

        edited = self.client.put(
            f"/api/tasks/{task_id}",
            headers=self.headers,
            json={"title": "Analytics task edited"},
        )
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(edited.get_json()["data"]["completed_at"], completion_timestamp)

        reopened = self.client.put(
            f"/api/tasks/{task_id}",
            headers=self.headers,
            json={"status": "pending"},
        )
        self.assertEqual(reopened.status_code, 200)
        self.assertIsNone(reopened.get_json()["data"]["completed_at"])

        connection = database.get_connection()
        try:
            connection.execute(
                """
                INSERT INTO tasks (user_id, title, status, created_at, completed_at)
                VALUES (?, ?, 'completed', CURRENT_TIMESTAMP, NULL)
                """,
                (1, "Existing completed task"),
            )
            connection.commit()
            legacy = connection.execute(
                "SELECT status, completed_at FROM tasks WHERE title = ?",
                ("Existing completed task",),
            ).fetchone()
            self.assertEqual(legacy["status"], "completed")
            self.assertIsNone(legacy["completed_at"])
        finally:
            connection.close()

    def test_analytics_summary_cross_feature_totals_and_isolation(self):
        self.register("analytics-one@example.com")
        self.login("analytics-one@example.com")
        self.client.post(
            "/api/tasks",
            headers=self.headers,
            json={"title": "Completed task"},
        )
        task_id = self.client.get("/api/tasks").get_json()["data"][0]["id"]
        self.client.put(
            f"/api/tasks/{task_id}",
            headers=self.headers,
            json={"status": "completed"},
        )
        self.client.post(
            "/api/dsa/problems",
            headers=self.headers,
            json={
                "problem_name": "One Problem",
                "problem_url": "https://leetcode.com/problems/one-problem/",
                "difficulty": "Easy",
                "topic": "Arrays",
                "completion_date": "2026-11-07",
            },
        )
        goal = self.client.post(
            "/api/career/goals",
            headers=self.headers,
            json={"title": "Private goal"},
        ).get_json()["data"]
        self.client.post(
            f"/api/career/goals/{goal['id']}/skills",
            headers=self.headers,
            json={"skill_name": "Python", "progress": 100},
        )

        summary = self.client.get("/api/analytics/summary").get_json()["data"]
        self.assertEqual(summary["total_tasks"], 1)
        self.assertEqual(summary["completed_tasks"], 1)
        self.assertEqual(summary["pending_tasks"], 0)
        self.assertEqual(summary["total_dsa_problems_solved"], 1)
        self.assertEqual(summary["total_career_goals"], 1)
        self.assertEqual(summary["total_skills"], 1)
        self.assertEqual(summary["overall_skill_progress"], 100)

        self.register("analytics-two@example.com")
        self.login("analytics-two@example.com")
        second_summary = self.client.get("/api/analytics/summary").get_json()["data"]
        self.assertEqual(second_summary["total_tasks"], 0)
        self.assertEqual(second_summary["total_dsa_problems_solved"], 0)
        self.assertEqual(second_summary["total_career_goals"], 0)

        with self.client.session_transaction() as flask_session:
            flask_session.clear()
        self.assertEqual(self.client.get("/api/analytics/summary").status_code, 401)
        self.assertEqual(self.client.get("/api/analytics/activity").status_code, 401)

    def test_task_completed_at_column_migration_is_safe(self):
        connection = database.get_connection()
        try:
            columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(tasks)").fetchall()
            }
            self.assertIn("completed_at", columns)
            indexes = {
                row["name"] for row in connection.execute("PRAGMA index_list(tasks)").fetchall()
            }
            self.assertIn("idx_tasks_user_status_completed", indexes)
        finally:
            connection.close()

    def test_career_validation_auth_csrf_and_user_isolation(self):
        self.register("career-csrf@example.com")
        self.login("career-csrf@example.com")
        invalid_goal = self.client.post(
            "/api/career/goals",
            headers={"Content-Type": "application/json", "X-CSRF-Token": "invalid"},
            json={"title": "Rejected"},
        )
        self.assertEqual(invalid_goal.status_code, 403)

        self.register("career-one@example.com")
        self.login("career-one@example.com")
        goal = self.client.post(
            "/api/career/goals",
            headers=self.headers,
            json={"title": "Private goal"},
        )
        self.assertEqual(goal.status_code, 201)
        goal_id = goal.get_json()["data"]["id"]

        invalid_status = self.client.put(
            f"/api/career/goals/{goal_id}",
            headers=self.headers,
            json={"status": "paused"},
        )
        self.assertEqual(invalid_status.status_code, 400)
        invalid_progress = self.client.post(
            f"/api/career/goals/{goal_id}/skills",
            headers=self.headers,
            json={"skill_name": "Python", "progress": 101},
        )
        self.assertEqual(invalid_progress.status_code, 400)

        self.register("career-two@example.com")
        self.login("career-two@example.com")
        self.assertEqual(self.client.get("/api/career/goals").get_json()["data"], [])
        self.assertEqual(self.client.get(f"/api/career/goals/{goal_id}").status_code, 404)
        self.assertEqual(
            self.client.post(
                f"/api/career/goals/{goal_id}/skills",
                headers=self.headers,
                json={"skill_name": "Forbidden", "progress": 10},
            ).status_code,
            404,
        )

        with self.client.session_transaction() as flask_session:
            flask_session.clear()
        self.assertEqual(self.client.get("/api/career/goals").status_code, 401)
        self.assertEqual(
            self.client.post(
                "/api/career/goals",
                headers=self.headers,
                json={"title": "Unauthenticated"},
            ).status_code,
            401,
        )

    def test_ai_status_missing_key_and_configured_key(self):
        self.register("ai-status@example.com")
        self.login("ai-status@example.com")
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("GROQ_API_KEY", None)
            missing = self.client.get("/api/ai/status")
        self.assertEqual(missing.status_code, 200)
        self.assertFalse(missing.get_json()["data"]["configured"])
        self.assertFalse(missing.get_json()["data"]["available"])

        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}, clear=False):
            configured = self.client.get("/api/ai/status")
        self.assertEqual(configured.status_code, 200)
        self.assertTrue(configured.get_json()["data"]["configured"])
        self.assertTrue(configured.get_json()["data"]["available"])
        self.assertNotIn("test-key", configured.get_data(as_text=True))

        with patch.dict(
            os.environ,
            {"GROQ_API_KEY": "gsk_test-key-format"},
            clear=False,
        ):
            groq_key = self.client.get("/api/ai/status")
        self.assertEqual(groq_key.status_code, 200)
        self.assertEqual(groq_key.get_json()["data"]["provider"], "groq")
        self.assertTrue(groq_key.get_json()["data"]["configured"])
        self.assertTrue(groq_key.get_json()["data"]["available"])

    def test_ai_chat_requires_authentication_and_csrf(self):
        with self.client.session_transaction() as flask_session:
            flask_session.clear()
        unauthenticated = self.client.post(
            "/api/ai/chat",
            headers=self.headers,
            json={"message": "Help me study"},
        )
        self.assertEqual(unauthenticated.status_code, 401)

        csrf_response = self.client.get("/api/auth/csrf")
        self.csrf = csrf_response.get_json()["csrf_token"]
        self.headers = {
            "Content-Type": "application/json",
            "X-CSRF-Token": self.csrf,
        }
        self.register("ai-csrf@example.com")
        login_result = self.login("ai-csrf@example.com")
        self.assertEqual(login_result.status_code, 200)
        self.login("ai-csrf@example.com")
        missing_csrf = self.client.post(
            "/api/ai/chat",
            json={"message": "Help me study"},
        )
        self.assertEqual(missing_csrf.status_code, 403)

    def test_ai_chat_validates_messages_and_user_id(self):
        self.register("ai-validation@example.com")
        self.login("ai-validation@example.com")
        empty = self.client.post(
            "/api/ai/chat",
            headers=self.headers,
            json={"message": "   "},
        )
        self.assertEqual(empty.status_code, 400)
        oversized = self.client.post(
            "/api/ai/chat",
            headers=self.headers,
            json={"message": "x" * 2001},
        )
        self.assertEqual(oversized.status_code, 400)
        supplied_id = self.client.post(
            "/api/ai/chat",
            headers=self.headers,
            json={"message": "Help me", "user_id": 999},
        )
        self.assertEqual(supplied_id.status_code, 400)

    def test_ai_chat_accepts_groq_key_configuration(self):
        self.register("ai-key-format@example.com")
        self.login("ai-key-format@example.com")
        with patch.dict(
            os.environ,
            {"GROQ_API_KEY": "gsk_test-key-format"},
            clear=False,
        ), patch.object(
            app_module,
            "generate_groq_response",
            return_value=("Groq is ready to help.", None),
        ):
            response = self.client.post(
                "/api/ai/chat",
                headers=self.headers,
                json={"message": "Help me plan"},
            )
        self.assertEqual(response.status_code, 200)

    def test_ai_chat_provider_success_timeout_and_failure(self):
        self.register("ai-provider@example.com")
        self.login("ai-provider@example.com")
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("GROQ_API_KEY", None)
            unavailable = self.client.post(
                "/api/ai/chat",
                headers=self.headers,
                json={"message": "Help me plan"},
            )
        self.assertEqual(unavailable.status_code, 503)

        with patch.dict(os.environ, {"GROQ_API_KEY": "mock-key"}, clear=False), patch.object(
            app_module,
            "generate_groq_response",
            return_value=("Use your Tasks page to plan the next step.", None),
        ):
            success = self.client.post(
                "/api/ai/chat",
                headers=self.headers,
                json={"message": "How should I plan my day?"},
            )
        self.assertEqual(success.status_code, 200)
        self.assertEqual(
            success.get_json()["data"]["response"],
            "Use your Tasks page to plan the next step.",
        )

        with patch.dict(os.environ, {"GROQ_API_KEY": "mock-key"}, clear=False), patch.object(
            app_module,
            "generate_groq_response",
            return_value=(None, "Groq rejected the provider API key. Please check the backend configuration."),
        ):
            authentication_error = self.client.post(
                "/api/ai/chat",
                headers=self.headers,
                json={"message": "Explain my progress"},
            )
        self.assertEqual(authentication_error.status_code, 502)
        self.assertEqual(
            authentication_error.get_json()["data"]["error_category"],
            "provider_authentication",
        )

        with patch.dict(os.environ, {"GROQ_API_KEY": "mock-key"}, clear=False), patch.object(
            app_module,
            "generate_groq_response",
            return_value=(None, "The AI provider timed out. Please try again."),
        ):
            timeout = self.client.post(
                "/api/ai/chat",
                headers=self.headers,
                json={"message": "Plan my study time"},
            )
        self.assertEqual(timeout.status_code, 504)

        with patch.dict(os.environ, {"GROQ_API_KEY": "mock-key"}, clear=False), patch.object(
            app_module,
            "generate_groq_response",
            side_effect=RuntimeError("provider failure"),
        ):
            failure = self.client.post(
                "/api/ai/chat",
                headers=self.headers,
                json={"message": "Explain my progress"},
            )
        self.assertEqual(failure.status_code, 502)
        self.assertNotIn("provider failure", failure.get_data(as_text=True))

    def test_ai_chat_empty_context_is_genuine_and_user_isolated(self):
        self.register("ai-empty@example.com")
        self.login("ai-empty@example.com")
        observed_context = {}

        def fake_generate(message, context):
            observed_context.update(context)
            return ("No activity records are available for this account.", None)

        with patch.dict(os.environ, {"GROQ_API_KEY": "mock-key"}, clear=False), patch.object(
            app_module,
            "generate_groq_response",
            side_effect=fake_generate,
        ):
            response = self.client.post(
                "/api/ai/chat",
                headers=self.headers,
                json={"message": "Explain my recent activity"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(observed_context["data_available"])

        first_task = self.client.post(
            "/api/tasks",
            headers=self.headers,
            json={"title": "Private AI context task"},
        )
        self.assertEqual(first_task.status_code, 201)
        self.register("ai-other@example.com")
        self.login("ai-other@example.com")
        observed_context.clear()
        with patch.dict(os.environ, {"GROQ_API_KEY": "mock-key"}, clear=False), patch.object(
            app_module,
            "generate_groq_response",
            side_effect=fake_generate,
        ):
            second_response = self.client.post(
                "/api/ai/chat",
                headers=self.headers,
                json={"message": "Explain my tasks and productivity"},
            )
        self.assertEqual(second_response.status_code, 200)
        self.assertFalse(observed_context["data_available"])
        self.assertEqual(observed_context["tasks"]["recent_items"], [])

    def test_ai_chat_rate_limit_and_read_only_behavior(self):
        self.register("ai-rate@example.com")
        self.login("ai-rate@example.com")
        with patch.dict(os.environ, {"GROQ_API_KEY": "mock-key"}, clear=False), patch.object(
            app_module,
            "generate_groq_response",
            return_value=("Make the change yourself on the Tasks page.", None),
        ):
            for _ in range(20):
                allowed = self.client.post(
                    "/api/ai/chat",
                    headers=self.headers,
                    json={"message": "Suggest priorities"},
                )
                self.assertEqual(allowed.status_code, 200)
            limited = self.client.post(
                "/api/ai/chat",
                headers=self.headers,
                json={"message": "Suggest priorities"},
            )
        self.assertEqual(limited.status_code, 429)

        task_count = self.client.get("/api/tasks").get_json()["data"]
        self.assertEqual(len(task_count), 0)

    def test_ai_status_is_rejected_when_unauthenticated(self):
        with self.client.session_transaction() as flask_session:
            flask_session.clear()
        response = self.client.get("/api/ai/status")
        self.assertEqual(response.status_code, 401)

    def test_google_oauth_rejects_invalid_audience_and_issuer(self):
        with self.client.session_transaction() as flask_session:
            flask_session["google_state"] = "valid-state"
            flask_session["google_nonce"] = "valid-nonce"
        with patch.dict(
            os.environ,
            {"GOOGLE_CLIENT_ID": "expected-client", "GOOGLE_CLIENT_SECRET": "test-secret"},
            clear=False,
        ), patch.object(
            app_module.google,
            "authorize_access_token",
            return_value={"id_token": "token"},
        ), patch.object(
            app_module.google,
            "parse_id_token",
            return_value={
                "sub": "subject",
                "email": "google@example.com",
                "name": "Google User",
                "email_verified": True,
                "aud": "wrong-client",
                "iss": "accounts.google.com",
            },
        ):
            callback = self.client.get(
                "/api/auth/google/callback?state=valid-state"
            )
        self.assertEqual(callback.status_code, 400)


if __name__ == "__main__":
    unittest.main()
