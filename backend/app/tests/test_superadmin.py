"""
TDD — SADM-001, SADM-002 (override)
Cubre: acceso superadmin, override de plan/trial, audit trail.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.tests.conftest import make_studio, make_user
from app.models.user import UserRole


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_superadmin(db, studio):
    user, token = make_user(db, studio, role=UserRole.admin, email="super@lexcore.app")
    user.is_superadmin = True
    db.flush()
    # Regenerar token con is_superadmin=True
    from app.core.auth import create_access_token
    token = create_access_token(
        studio_id=studio.id,
        user_id=user.id,
        role=user.role.value,
        is_superadmin=True,
    )
    return user, token


# ── SADM-001: acceso restringido ───────────────────────────────────────────────

class TestSuperadminAccess:

    def test_superadmin_endpoint_requires_is_superadmin(self, client, db, studio_a, admin_a):
        _, token = admin_a  # admin normal, no superadmin
        resp = client.get(
            "/superadmin/studios",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_unauthenticated_gets_401(self, client):
        resp = client.get("/superadmin/studios")
        assert resp.status_code == 403  # HTTPBearer devuelve 403 sin credenciales

    def test_superadmin_can_list_studios(self, client, db, studio_a, admin_a):
        user, _ = admin_a
        user.is_superadmin = True
        from app.core.auth import create_access_token
        token = create_access_token(
            studio_id=studio_a.id, user_id=user.id,
            role=user.role.value, is_superadmin=True,
        )
        db.commit()

        resp = client.get(
            "/superadmin/studios",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        studios = resp.json()
        assert isinstance(studios, list)
        assert len(studios) >= 1


# ── SADM override: reset trial ────────────────────────────────────────────────

class TestSuperadminOverride:

    def _super_token(self, db, studio, admin_user):
        admin_user.is_superadmin = True
        db.flush()
        from app.core.auth import create_access_token
        return create_access_token(
            studio_id=studio.id, user_id=admin_user.id,
            role=admin_user.role.value, is_superadmin=True,
        )

    def test_override_reset_trial(self, client, db, studio_a, admin_a):
        user, _ = admin_a
        # Vencer el trial primero
        studio_a.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=5)
        studio_a.plan = "trial"
        token = self._super_token(db, studio_a, user)
        db.commit()

        resp = client.patch(
            f"/superadmin/studios/{studio_a.id}/override",
            json={"reset_trial": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        db.refresh(studio_a)
        trial_end = studio_a.trial_ends_at
        if trial_end.tzinfo is None:
            trial_end = trial_end.replace(tzinfo=timezone.utc)
        assert trial_end > datetime.now(timezone.utc)

    def test_override_set_plan(self, client, db, studio_a, admin_a):
        user, _ = admin_a
        token = self._super_token(db, studio_a, user)
        db.commit()

        resp = client.patch(
            f"/superadmin/studios/{studio_a.id}/override",
            json={"plan": "pro", "subscription_status": "active"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        db.refresh(studio_a)
        assert studio_a.plan == "pro"
        assert studio_a.subscription_status == "active"

    def test_override_set_trial_ends_at(self, client, db, studio_a, admin_a):
        user, _ = admin_a
        token = self._super_token(db, studio_a, user)
        db.commit()

        future = (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()
        resp = client.patch(
            f"/superadmin/studios/{studio_a.id}/override",
            json={"trial_ends_at": future},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        db.refresh(studio_a)
        trial_end = studio_a.trial_ends_at
        if trial_end.tzinfo is None:
            trial_end = trial_end.replace(tzinfo=timezone.utc)
        assert trial_end > datetime.now(timezone.utc) + timedelta(days=50)

    def test_override_creates_subscription_event(self, client, db, studio_a, admin_a):
        from app.models.subscription_event import SubscriptionEvent
        user, _ = admin_a
        token = self._super_token(db, studio_a, user)
        db.commit()

        resp = client.patch(
            f"/superadmin/studios/{studio_a.id}/override",
            json={"plan": "estudio", "subscription_status": "active"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        event = db.query(SubscriptionEvent).filter(
            SubscriptionEvent.tenant_id == studio_a.id,
            SubscriptionEvent.event_type == "manual_override",
        ).first()
        assert event is not None
        assert event.plan == "estudio"

    def test_override_non_superadmin_gets_403(self, client, db, studio_a, admin_a):
        _, token = admin_a  # admin normal
        resp = client.patch(
            f"/superadmin/studios/{studio_a.id}/override",
            json={"plan": "pro"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_override_unknown_studio_gets_404(self, client, db, studio_a, admin_a):
        user, _ = admin_a
        token = self._super_token(db, studio_a, user)
        db.commit()

        resp = client.patch(
            "/superadmin/studios/nonexistent-id/override",
            json={"plan": "pro"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_override_partial_update(self, client, db, studio_a, admin_a):
        """Solo los campos enviados se modifican — el resto queda igual."""
        user, _ = admin_a
        studio_a.plan = "starter"
        studio_a.billing_cycle = "annual"
        token = self._super_token(db, studio_a, user)
        db.commit()

        resp = client.patch(
            f"/superadmin/studios/{studio_a.id}/override",
            json={"subscription_status": "active"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        db.refresh(studio_a)
        assert studio_a.plan == "starter"           # no cambió
        assert studio_a.billing_cycle == "annual"   # no cambió
        assert studio_a.subscription_status == "active"  # sí cambió


# ── SADM: lista de studios ─────────────────────────────────────────────────────

class TestSuperadminStudios:

    def test_list_includes_plan_and_status(self, client, db, studio_a, admin_a):
        user, _ = admin_a
        studio_a.plan = "pro"
        studio_a.subscription_status = "active"
        from app.core.auth import create_access_token
        user.is_superadmin = True
        token = create_access_token(
            studio_id=studio_a.id, user_id=user.id,
            role=user.role.value, is_superadmin=True,
        )
        db.commit()

        resp = client.get(
            "/superadmin/studios",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        studios = resp.json()
        s = next(x for x in studios if x["id"] == studio_a.id)
        assert s["plan"] == "pro"
        assert s["subscription_status"] == "active"
