"""
Tests para /invitaciones — invitar usuarios, aceptar token, listar.
"""
import pytest
from app.tests.conftest import make_studio, make_user
from app.models.user import UserRole


class TestInvitacionesCrear:
    def test_crear_invitacion(self, client, auth_a):
        r = client.post("/invitaciones", json={
            "email": "invitado@test.com", "role": "asociado"
        }, headers=auth_a)
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == "invitado@test.com"
        assert "token" in data

    def test_crear_invitacion_sin_token_401(self, client):
        r = client.post("/invitaciones", json={"email": "a@test.com", "role": "asociado"})
        assert r.status_code in (401, 403)

    def test_no_puede_invitar_email_ya_miembro(self, client, auth_a, admin_a):
        user, _ = admin_a
        r = client.post("/invitaciones", json={"email": user.email, "role": "asociado"}, headers=auth_a)
        assert r.status_code in (400, 409)

    def test_rol_invalido(self, client, auth_a):
        r = client.post("/invitaciones", json={"email": "x@test.com", "role": "dios"}, headers=auth_a)
        assert r.status_code == 422


class TestInvitacionesListar:
    def test_listar_invitaciones(self, client, auth_a):
        client.post("/invitaciones", json={"email": "inv1@test.com", "role": "asociado"}, headers=auth_a)
        r = client.get("/invitaciones", headers=auth_a)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_aislamiento_tenant(self, client, auth_a, auth_b):
        client.post("/invitaciones", json={"email": "inv2@test.com", "role": "asociado"}, headers=auth_a)
        r = client.get("/invitaciones", headers=auth_b)
        assert r.status_code == 200
        assert all(i["email"] != "inv2@test.com" for i in r.json())


class TestInvitacionesEliminar:
    def test_eliminar_invitacion(self, client, auth_a):
        r = client.post("/invitaciones", json={"email": "del@test.com", "role": "pasante"}, headers=auth_a)
        inv_id = r.json()["id"]
        r2 = client.delete(f"/invitaciones/{inv_id}", headers=auth_a)
        assert r2.status_code == 204

    def test_no_puede_eliminar_invitacion_otro_estudio(self, client, auth_a, auth_b):
        r = client.post("/invitaciones", json={"email": "ext@test.com", "role": "asociado"}, headers=auth_b)
        inv_id = r.json()["id"]
        r2 = client.delete(f"/invitaciones/{inv_id}", headers=auth_a)
        assert r2.status_code == 404


class TestAceptarInvitacion:
    def test_aceptar_token_valido(self, client, auth_a):
        r = client.post("/invitaciones", json={"email": "nuevo@test.com", "role": "asociado"}, headers=auth_a)
        token = r.json()["token"]
        r2 = client.post(f"/invitaciones/aceptar/{token}")
        assert r2.status_code == 200
        assert r2.json()["email"] == "nuevo@test.com"

    def test_aceptar_token_invalido(self, client):
        r = client.post("/invitaciones/aceptar/token-falso-123")
        assert r.status_code in (404, 422)
