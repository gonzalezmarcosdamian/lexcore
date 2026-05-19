"""
Tests de autenticación: login email, Google OAuth, setup-studio, refresh token.
Cubre los flujos críticos del onboarding y sesión.
"""
import pytest
from app.tests.conftest import make_studio, make_user
from app.models.user import UserRole, AuthProvider, User
from app.models.studio import Studio
from app.core.auth import create_access_token


# ── Login email/password ──────────────────────────────────────────────────────

class TestLoginEmail:
    def test_login_correcto(self, client, db):
        studio = make_studio(db)
        make_user(db, studio, email="abogado@test.com")
        r = client.post("/auth/login", json={"email": "abogado@test.com", "password": "testpass123"})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["email"] == "abogado@test.com"
        assert "needs_studio" in data
        assert data["needs_studio"] is False

    def test_login_password_incorrecta(self, client, db):
        studio = make_studio(db)
        make_user(db, studio, email="abogado@test.com")
        r = client.post("/auth/login", json={"email": "abogado@test.com", "password": "wrong"})
        assert r.status_code == 401

    def test_login_email_inexistente(self, client, db):
        r = client.post("/auth/login", json={"email": "noexiste@test.com", "password": "pass"})
        assert r.status_code == 401

    def test_login_sin_body(self, client, db):
        r = client.post("/auth/login", json={})
        assert r.status_code == 422

    def test_login_needs_studio_true_si_pending(self, client, db):
        """Usuario con tenant_id='pending' devuelve needs_studio=True."""
        import uuid
        from app.core.auth import hash_password
        user = User(
            id=str(uuid.uuid4()),
            tenant_id="pending",
            email="pendiente@test.com",
            full_name="Test",
            hashed_password=hash_password("testpass123"),
            role=UserRole.admin,
            auth_provider=AuthProvider.email,
        )
        db.add(user)
        db.commit()
        r = client.post("/auth/login", json={"email": "pendiente@test.com", "password": "testpass123"})
        assert r.status_code == 200
        assert r.json()["needs_studio"] is True

    def test_rate_limit_5_intentos(self, client, db):
        # El rate limiter usa tabla login_attempts que no existe en SQLite (tests)
        # Este test corre en integración con PostgreSQL real
        import pytest
        try:
            from sqlalchemy import text
            db.execute(text("SELECT 1 FROM login_attempts LIMIT 1"))
        except Exception:
            pytest.skip("login_attempts no existe en SQLite — test de integración solo")
        studio = make_studio(db)
        make_user(db, studio, email="rl@test.com")
        for _ in range(5):
            client.post("/auth/login", json={"email": "rl@test.com", "password": "wrong"})
        r = client.post("/auth/login", json={"email": "rl@test.com", "password": "wrong"})
        assert r.status_code == 429


# ── Registro email ────────────────────────────────────────────────────────────

class TestRegistro:
    def test_registro_completo(self, client, db):
        r = client.post("/auth/register", json={
            "studio_name": "Estudio Test",
            "studio_slug": "estudio-test",
            "email": "nuevo@test.com",
            "password": "Password123",
            "full_name": "Test User",
        })
        assert r.status_code == 201
        data = r.json()
        assert "access_token" in data
        assert data["email"] == "nuevo@test.com"

    def test_registro_slug_duplicado(self, client, db):
        payload = {
            "studio_name": "Test", "studio_slug": "mi-slug",
            "email": "a@test.com", "password": "Password123", "full_name": "A",
        }
        client.post("/auth/register", json=payload)
        payload["email"] = "b@test.com"
        r = client.post("/auth/register", json=payload)
        assert r.status_code in (400, 422)

    def test_registro_email_duplicado(self, client, db):
        payload = {
            "studio_name": "Test", "studio_slug": "slug-1",
            "email": "dup@test.com", "password": "Password123", "full_name": "A",
        }
        client.post("/auth/register", json=payload)
        payload["studio_slug"] = "slug-2"
        r = client.post("/auth/register", json=payload)
        assert r.status_code in (400, 409, 422)

    def test_registro_sin_campos_requeridos(self, client, db):
        r = client.post("/auth/register", json={"email": "a@test.com"})
        assert r.status_code == 422


# ── Google OAuth ──────────────────────────────────────────────────────────────

class TestGoogleAuth:
    def test_usuario_nuevo_necesita_studio(self, client, db):
        r = client.post("/auth/google", json={
            "email": "nuevo@gmail.com",
            "name": "Nuevo User",
            "google_id": "google-123",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["needs_studio"] is True
        assert data["studio_id"] == "pending"
        assert "access_token" in data

    def test_usuario_existente_no_necesita_studio(self, client, db):
        studio = make_studio(db)
        import uuid
        user = User(
            id=str(uuid.uuid4()),
            tenant_id=studio.id,
            email="existente@gmail.com",
            full_name="Existente",
            role=UserRole.admin,
            auth_provider=AuthProvider.google,
            google_id="google-456",
        )
        db.add(user)
        db.commit()
        r = client.post("/auth/google", json={
            "email": "existente@gmail.com",
            "name": "Existente",
            "google_id": "google-456",
        })
        assert r.status_code == 200
        assert r.json()["needs_studio"] is False

    def test_google_guarda_refresh_token(self, client, db):
        r = client.post("/auth/google", json={
            "email": "refresh@gmail.com",
            "name": "Refresh Test",
            "google_id": "google-789",
            "google_refresh_token": "refresh-tok-abc",
        })
        assert r.status_code == 200
        from app.models.user import User as UserModel
        user = db.query(UserModel).filter(UserModel.email == "refresh@gmail.com").first()
        assert user.google_refresh_token == "refresh-tok-abc"

    def test_google_login_segundo_login_no_pierde_refresh(self, client, db):
        """Segundo login sin refresh_token no borra el guardado."""
        client.post("/auth/google", json={
            "email": "keep@gmail.com", "name": "Keep", "google_id": "g-keep",
            "google_refresh_token": "original-refresh",
        })
        client.post("/auth/google", json={
            "email": "keep@gmail.com", "name": "Keep", "google_id": "g-keep",
        })
        from app.models.user import User as UserModel
        user = db.query(UserModel).filter(UserModel.email == "keep@gmail.com").first()
        assert user.google_refresh_token == "original-refresh"


# ── Setup Studio ──────────────────────────────────────────────────────────────

class TestSetupStudio:
    def _token_pendiente(self, db) -> str:
        import uuid
        user = User(
            id=str(uuid.uuid4()),
            tenant_id="pending",
            email="pending@test.com",
            full_name="Pending User",
            role=UserRole.admin,
            auth_provider=AuthProvider.google,
            google_id="g-pending",
        )
        db.add(user)
        db.commit()
        return create_access_token(studio_id="pending", user_id=user.id, role="admin")

    def test_setup_studio_correcto(self, client, db):
        token = self._token_pendiente(db)
        r = client.post("/auth/setup-studio",
            json={"studio_name": "Nuevo Estudio", "studio_slug": "nuevo-estudio"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["studio_id"] != "pending"

    def test_setup_studio_slug_duplicado(self, client, db):
        make_studio(db, slug="slug-existente")
        token = self._token_pendiente(db)
        r = client.post("/auth/setup-studio",
            json={"studio_name": "Test", "studio_slug": "slug-existente"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 400

    def test_setup_studio_token_no_pending(self, client, db):
        studio = make_studio(db)
        _, token = make_user(db, studio)
        r = client.post("/auth/setup-studio",
            json={"studio_name": "Test", "studio_slug": "test-slug"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code in (401, 409)

    def test_setup_studio_sin_token(self, client, db):
        r = client.post("/auth/setup-studio", json={"studio_name": "T", "studio_slug": "t"})
        assert r.status_code in (401, 403)


# ── Refresh token ─────────────────────────────────────────────────────────────

class TestRefreshToken:
    def test_refresh_devuelve_nuevo_token(self, client, db):
        studio = make_studio(db)
        _, token = make_user(db, studio)
        r = client.post("/auth/refresh", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_refresh_sin_token_401(self, client, db):
        r = client.post("/auth/refresh")
        assert r.status_code in (401, 403, 422)
