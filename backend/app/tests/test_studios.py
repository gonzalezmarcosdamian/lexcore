"""
Tests para /studios — perfil del estudio: obtener, actualizar, logo.
"""
import pytest
from app.tests.conftest import make_studio, make_user


class TestStudiosMe:
    def test_obtener_studio(self, client, auth_a):
        r = client.get("/studios/me", headers=auth_a)
        assert r.status_code == 200
        data = r.json()
        assert "name" in data
        assert "slug" in data

    def test_sin_token_401(self, client):
        r = client.get("/studios/me")
        assert r.status_code in (401, 403)


class TestStudiosActualizar:
    def test_actualizar_nombre(self, client, auth_a):
        r = client.patch("/studios/me", json={"name": "Nuevo Nombre"}, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["name"] == "Nuevo Nombre"

    def test_actualizar_email_contacto(self, client, auth_a):
        r = client.patch("/studios/me", json={"email_contacto": "contacto@estudio.com"}, headers=auth_a)
        assert r.status_code == 200

    def test_no_puede_cambiar_slug_a_uno_existente(self, client, auth_a, db):
        otro = make_studio(db, slug="slug-ocupado")
        r = client.patch("/studios/me", json={"slug": "slug-ocupado"}, headers=auth_a)
        assert r.status_code in (400, 409)

    def test_solo_admin_puede_actualizar(self, client, db, studio_a):
        _, token_asoc = make_user(db, studio_a, role=__import__('app.models.user', fromlist=['UserRole']).UserRole.asociado, email="asoc@test.com")
        headers = {"Authorization": f"Bearer {token_asoc}"}
        r = client.patch("/studios/me", json={"name": "Hack"}, headers=headers)
        assert r.status_code in (403, 401)
