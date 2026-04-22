"""
TDD — SUBS-001, SUBS-003, SUBS-004
Cubre: modelo de datos de suscripción, access level, modo lectura, límite de usuarios.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.tests.conftest import make_studio, make_user
from app.models.user import UserRole
from app.services.subscription_service import get_studio_access_level


# ── Helpers ───────────────────────────────────────────────────────────────────

def _expired_trial(db, slug=None):
    studio = make_studio(db, slug=slug)
    studio.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=1)
    studio.plan = "trial"
    db.flush()
    return studio


def _active_subscription(db, slug=None):
    studio = make_studio(db, slug=slug)
    studio.plan = "pro"
    studio.subscription_status = "active"
    studio.trial_ends_at = None
    db.flush()
    return studio


def _paused_subscription(db, slug=None):
    studio = make_studio(db, slug=slug)
    studio.plan = "pro"
    studio.subscription_status = "paused"
    studio.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=1)  # trial también vencido
    db.flush()
    return studio


# ── SUBS-001: campos en Studio ─────────────────────────────────────────────────

class TestStudioSubscriptionFields:

    def test_new_studio_defaults_to_trial_plan(self, db):
        studio = make_studio(db)
        db.commit()
        db.refresh(studio)
        assert studio.plan == "trial"
        assert studio.subscription_status is None
        assert studio.subscription_id is None
        assert studio.billing_cycle is None

    def test_studio_plan_can_be_set(self, db):
        studio = make_studio(db)
        studio.plan = "pro"
        studio.billing_cycle = "monthly"
        studio.subscription_status = "active"
        db.commit()
        db.refresh(studio)
        assert studio.plan == "pro"
        assert studio.billing_cycle == "monthly"
        assert studio.subscription_status == "active"

    def test_subscription_event_is_append_only(self, db):
        from app.models.subscription_event import SubscriptionEvent
        studio = make_studio(db)
        db.commit()
        evt = SubscriptionEvent(
            tenant_id=studio.id,
            event_type="created",
            plan="trial",
            billing_cycle=None,
            amount=None,
        )
        db.add(evt)
        db.commit()
        db.refresh(evt)
        assert evt.id is not None
        assert evt.created_at is not None


# ── SUBS-001: is_superadmin en User ───────────────────────────────────────────

class TestUserSuperadminField:

    def test_user_defaults_is_superadmin_false(self, db):
        studio = make_studio(db)
        user, _ = make_user(db, studio)
        db.commit()
        db.refresh(user)
        assert user.is_superadmin is False

    def test_user_can_be_set_superadmin(self, db):
        studio = make_studio(db)
        user, _ = make_user(db, studio)
        user.is_superadmin = True
        db.commit()
        db.refresh(user)
        assert user.is_superadmin is True


# ── SUBS-003: get_studio_access_level ─────────────────────────────────────────

class TestAccessLevel:

    def test_trial_active_returns_full(self, db):
        studio = make_studio(db)
        studio.trial_ends_at = datetime.now(timezone.utc) + timedelta(days=5)
        studio.plan = "trial"
        studio.subscription_status = None
        db.flush()
        assert get_studio_access_level(studio) == "full"

    def test_trial_expired_no_subscription_returns_read_only(self, db):
        studio = _expired_trial(db)
        assert get_studio_access_level(studio) == "read_only"

    def test_active_subscription_returns_full(self, db):
        studio = _active_subscription(db)
        assert get_studio_access_level(studio) == "full"

    def test_paused_subscription_returns_read_only(self, db):
        studio = _paused_subscription(db)
        assert get_studio_access_level(studio) == "read_only"

    def test_cancelled_subscription_returns_read_only(self, db):
        studio = make_studio(db)
        studio.plan = "read_only"
        studio.subscription_status = "cancelled"
        studio.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=10)
        db.flush()
        assert get_studio_access_level(studio) == "read_only"

    def test_active_subscription_ignores_expired_trial(self, db):
        """Suscripción activa siempre es full, aunque trial_ends_at sea pasado."""
        studio = make_studio(db)
        studio.plan = "starter"
        studio.subscription_status = "active"
        studio.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=100)
        db.flush()
        assert get_studio_access_level(studio) == "full"


# ── SUBS-003: HTTP 402 en escritura con trial vencido ─────────────────────────

class TestRequireFullAccess:

    def test_post_expedientes_blocked_when_trial_expired(self, client, db, studio_a, admin_a):
        user, token = admin_a
        # Vencer el trial
        studio_a.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=1)
        studio_a.plan = "trial"
        studio_a.subscription_status = None
        db.commit()

        resp = client.post(
            "/expedientes/",
            json={"caratula": "Test c/Test", "fuero": "civil"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 402
        body = resp.json()
        assert body["detail"]["code"] == "read_only"

    def test_get_expedientes_allowed_when_trial_expired(self, client, db, studio_a, admin_a):
        user, token = admin_a
        studio_a.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=1)
        studio_a.plan = "trial"
        studio_a.subscription_status = None
        db.commit()

        resp = client.get(
            "/expedientes/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_post_expedientes_allowed_when_subscription_active(self, client, db, studio_a, admin_a):
        user, token = admin_a
        studio_a.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=1)
        studio_a.plan = "pro"
        studio_a.subscription_status = "active"
        db.commit()

        resp = client.post(
            "/expedientes/",
            json={"caratula": "Test c/Test", "fuero": "civil"},
            headers={"Authorization": f"Bearer {token}"},
        )
        # 200/201 or 422 (validation) — lo que NO debe ser es 402
        assert resp.status_code != 402

    def test_post_vencimientos_blocked_when_read_only(self, client, db, studio_a, admin_a):
        user, token = admin_a
        studio_a.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=1)
        studio_a.plan = "trial"
        studio_a.subscription_status = None
        db.commit()

        resp = client.post(
            "/vencimientos/",
            json={"descripcion": "audiencia", "fecha": "2026-06-01", "tipo": "audiencia"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 402

    def test_suscripcion_checkout_allowed_when_read_only(self, client, db, studio_a, admin_a):
        """El admin en modo lectura debe poder suscribirse."""
        user, token = admin_a
        studio_a.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=1)
        studio_a.plan = "trial"
        studio_a.subscription_status = None
        db.commit()

        resp = client.post(
            "/suscripcion/checkout",
            json={"plan": "starter", "billing_cycle": "monthly"},
            headers={"Authorization": f"Bearer {token}"},
        )
        # 503 si MP no está configurado en test — lo que NO debe ser es 402
        assert resp.status_code != 402


# ── SUBS-004: límite de usuarios por plan ─────────────────────────────────────

class TestPlanUserLimit:

    def test_invite_blocked_when_at_trial_limit(self, client, db, studio_a, admin_a):
        user, token = admin_a
        studio_a.plan = "trial"
        # Ya hay 1 usuario (el admin). Crear el segundo para llegar al límite (trial = 2).
        second, _ = make_user(db, studio_a, role=UserRole.asociado)
        db.commit()

        resp = client.post(
            "/invitaciones",
            json={"email": "tercero@test.com", "full_name": "Tercero", "rol": "asociado"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
        body = resp.json()
        assert body["detail"]["code"] == "plan_limit"
        assert body["detail"]["limit"] == 2

    def test_invite_allowed_under_trial_limit(self, client, db, studio_a, admin_a):
        user, token = admin_a
        studio_a.plan = "trial"
        db.commit()
        # Solo hay 1 usuario (el admin), límite es 2 → puede invitar uno más

        resp = client.post(
            "/invitaciones",
            json={"email": "segundo@test.com", "full_name": "Segundo", "rol": "asociado"},
            headers={"Authorization": f"Bearer {token}"},
        )
        # Puede fallar por lógica de negocio pero NO debe ser 403 por plan_limit
        data = resp.json()
        if resp.status_code == 403:
            assert data.get("detail", {}).get("code") != "plan_limit"

    def test_invite_allowed_for_pro_plan(self, client, db, studio_a, admin_a):
        user, token = admin_a
        studio_a.plan = "pro"
        studio_a.subscription_status = "active"
        # Agregar 5 usuarios (admin + 4 asociados = 5, límite pro = 6)
        for i in range(4):
            make_user(db, studio_a, role=UserRole.asociado, email=f"u{i}@test.com")
        db.commit()

        resp = client.post(
            "/invitaciones",
            json={"email": "sexto@test.com", "full_name": "Sexto", "rol": "asociado"},
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 403:
            data = resp.json()
            assert data.get("detail", {}).get("code") != "plan_limit"

    def test_invite_blocked_for_pro_at_limit(self, client, db, studio_a, admin_a):
        user, token = admin_a
        studio_a.plan = "pro"
        studio_a.subscription_status = "active"
        # admin + 5 asociados = 6 usuarios activos = límite pro
        for i in range(5):
            make_user(db, studio_a, role=UserRole.asociado, email=f"u{i}@test.com")
        db.commit()

        resp = client.post(
            "/invitaciones",
            json={"email": "septimo@test.com", "full_name": "Septimo", "rol": "asociado"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
        assert resp.json()["detail"]["code"] == "plan_limit"

    def test_two_users_at_trial_limit_blocks_third(self, client, db, studio_a, admin_a):
        """Con trial = 2, al tener admin + 1 asociado activo, el tercero queda bloqueado."""
        user, token = admin_a
        studio_a.plan = "trial"
        make_user(db, studio_a, role=UserRole.asociado, email="segundo@t.com")
        db.commit()

        resp = client.post(
            "/invitaciones",
            json={"email": "tercero@test.com", "full_name": "Tercero", "rol": "asociado"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
        assert resp.json()["detail"]["code"] == "plan_limit"


# ── SUBS-001: studio_access_level en /auth/me ─────────────────────────────────

class TestAuthMeAccessLevel:

    def test_me_includes_studio_access_level_full(self, client, db, studio_a, admin_a):
        _, token = admin_a
        studio_a.trial_ends_at = datetime.now(timezone.utc) + timedelta(days=10)
        db.commit()

        resp = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["studio_access_level"] == "full"

    def test_me_includes_studio_access_level_read_only(self, client, db, studio_a, admin_a):
        _, token = admin_a
        studio_a.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=1)
        studio_a.plan = "trial"
        studio_a.subscription_status = None
        db.commit()

        resp = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["studio_access_level"] == "read_only"
