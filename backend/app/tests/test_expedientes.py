"""Tests para /expedientes — CRUD, movimientos, abogados + aislamiento tenant."""
import pytest
from app.tests.conftest import make_studio, make_user
from app.models.user import UserRole


def create_expediente(client, headers, *, caratula="Test c/ Test"):
    return client.post("/expedientes", json={"caratula": caratula}, headers=headers)


class TestExpedientesCRUD:
    def test_crear_expediente(self, client, auth_a, admin_a):
        r = create_expediente(client, auth_a)
        assert r.status_code == 201
        data = r.json()
        assert data["numero"].startswith("EXP-")
        assert data["estado"] == "activo"
        # El creador debe ser asignado como responsable
        assert len(data["abogados"]) == 1
        assert data["abogados"][0]["rol"] == "responsable"

    def test_listar_expedientes(self, client, auth_a):
        create_expediente(client, auth_a, caratula="Caso A")
        create_expediente(client, auth_a, caratula="Caso B")
        r = client.get("/expedientes", headers=auth_a)
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_filtrar_por_estado(self, client, auth_a):
        eid = create_expediente(client, auth_a, caratula="Caso A").json()["id"]
        client.patch(f"/expedientes/{eid}", json={"estado": "cerrado"}, headers=auth_a)
        create_expediente(client, auth_a, caratula="Caso B")
        r = client.get("/expedientes?estado=activo", headers=auth_a)
        assert all(e["estado"] == "activo" for e in r.json())

    def test_buscar_por_caratula(self, client, auth_a):
        create_expediente(client, auth_a, caratula="García c/ Empresa")
        create_expediente(client, auth_a, caratula="Martínez c/ Estado")
        r = client.get("/expedientes?q=García", headers=auth_a)
        assert len(r.json()) == 1

    def test_obtener_expediente(self, client, auth_a):
        eid = create_expediente(client, auth_a).json()["id"]
        r = client.get(f"/expedientes/{eid}", headers=auth_a)
        assert r.status_code == 200

    def test_actualizar_estado(self, client, auth_a):
        eid = create_expediente(client, auth_a).json()["id"]
        r = client.patch(f"/expedientes/{eid}", json={"estado": "cerrado"}, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["estado"] == "cerrado"

    def test_404_expediente_inexistente(self, client, auth_a):
        r = client.get("/expedientes/no-existe", headers=auth_a)
        assert r.status_code == 404


class TestMovimientos:
    def test_agregar_movimiento(self, client, auth_a):
        eid = create_expediente(client, auth_a).json()["id"]
        r = client.post(f"/expedientes/{eid}/movimientos",
                        json={"texto": "Se presentó escrito"}, headers=auth_a)
        assert r.status_code == 201
        assert r.json()["texto"] == "Se presentó escrito"

    def test_listar_movimientos(self, client, auth_a):
        eid = create_expediente(client, auth_a).json()["id"]
        client.post(f"/expedientes/{eid}/movimientos", json={"texto": "Mov 1"}, headers=auth_a)
        client.post(f"/expedientes/{eid}/movimientos", json={"texto": "Mov 2"}, headers=auth_a)
        r = client.get(f"/expedientes/{eid}/movimientos", headers=auth_a)
        assert len(r.json()) == 2

    def test_movimiento_sin_acceso_a_expediente_ajeno(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a).json()["id"]
        r = client.post(f"/expedientes/{eid}/movimientos",
                        json={"texto": "hack"}, headers=auth_b)
        assert r.status_code == 404


class TestAbogados:
    def test_asignar_abogado(self, client, db, auth_a, studio_a):
        otro_user, _ = make_user(db, studio_a, role=UserRole.asociado)
        db.commit()
        eid = create_expediente(client, auth_a).json()["id"]
        r = client.post(f"/expedientes/{eid}/abogados",
                        json={"user_id": otro_user.id, "rol": "colaborador"}, headers=auth_a)
        assert r.status_code == 201

    def test_no_duplicar_abogado(self, client, db, auth_a, studio_a, admin_a):
        user_a, _ = admin_a
        eid = create_expediente(client, auth_a).json()["id"]
        # El creador ya está asignado, intentar agregarlo de nuevo debe fallar
        r = client.post(f"/expedientes/{eid}/abogados",
                        json={"user_id": user_a.id, "rol": "colaborador"}, headers=auth_a)
        assert r.status_code == 409

    def test_no_quitar_responsable(self, client, auth_a, admin_a):
        user_a, _ = admin_a
        eid = create_expediente(client, auth_a).json()["id"]
        r = client.delete(f"/expedientes/{eid}/abogados/{user_a.id}", headers=auth_a)
        assert r.status_code == 400


class TestExpedientesAislamientoTenant:
    def test_no_ve_expedientes_de_otro_tenant(self, client, auth_a, auth_b):
        create_expediente(client, auth_a)
        r = client.get("/expedientes", headers=auth_b)
        assert r.json() == []

    def test_no_puede_leer_expediente_ajeno(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a).json()["id"]
        r = client.get(f"/expedientes/{eid}", headers=auth_b)
        assert r.status_code == 404

    def test_no_puede_modificar_expediente_ajeno(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a).json()["id"]
        r = client.patch(f"/expedientes/{eid}", json={"estado": "cerrado"}, headers=auth_b)
        assert r.status_code == 404
