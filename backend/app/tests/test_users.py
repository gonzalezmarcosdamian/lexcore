"""
Tests para /users — gestión de equipo: listar, cambiar rol, eliminar.
"""
import pytest
from app.tests.conftest import make_studio, make_user
from app.models.user import UserRole


class TestUsersListar:
    def test_listar_miembros(self, client, auth_a):
        r = client.get("/users", headers=auth_a)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_sin_token_401(self, client):
        r = client.get("/users")
        assert r.status_code in (401, 403)

    def test_solo_ve_su_estudio(self, client, auth_a, auth_b, db, studio_b, admin_b):
        r = client.get("/users", headers=auth_a)
        ids = [u["id"] for u in r.json()]
        user_b, _ = admin_b
        assert user_b.id not in ids


class TestUsersCambiarRol:
    def test_cambiar_rol_a_asociado(self, client, auth_a, db, studio_a):
        user2, _ = make_user(db, studio_a, role=UserRole.asociado, email="asociado@test.com")
        r = client.patch(f"/users/{user2.id}/role", json={"role": "socio"}, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["role"] == "socio"

    def test_no_puede_cambiar_su_propio_rol(self, client, auth_a, admin_a):
        user, _ = admin_a
        r = client.patch(f"/users/{user.id}/role", json={"role": "asociado"}, headers=auth_a)
        assert r.status_code in (400, 403)

    def test_rol_invalido_422(self, client, auth_a, db, studio_a):
        user2, _ = make_user(db, studio_a, role=UserRole.asociado, email="inv@test.com")
        r = client.patch(f"/users/{user2.id}/role", json={"role": "superheroe"}, headers=auth_a)
        assert r.status_code == 422

    def test_no_puede_modificar_usuario_otro_estudio(self, client, auth_a, db, studio_b):
        user_b, _ = make_user(db, studio_b, email="otro@test.com")
        r = client.patch(f"/users/{user_b.id}/role", json={"role": "socio"}, headers=auth_a)
        assert r.status_code == 404


class TestUsersEliminar:
    def test_eliminar_miembro(self, client, auth_a, db, studio_a):
        user2, _ = make_user(db, studio_a, role=UserRole.asociado, email="del@test.com")
        r = client.delete(f"/users/{user2.id}", headers=auth_a)
        assert r.status_code == 204

    def test_no_puede_eliminarse_a_si_mismo(self, client, auth_a, admin_a):
        user, _ = admin_a
        r = client.delete(f"/users/{user.id}", headers=auth_a)
        assert r.status_code in (400, 403)

    def test_no_puede_eliminar_usuario_otro_estudio(self, client, auth_a, db, studio_b):
        user_b, _ = make_user(db, studio_b, email="ext@test.com")
        r = client.delete(f"/users/{user_b.id}", headers=auth_a)
        assert r.status_code == 404
