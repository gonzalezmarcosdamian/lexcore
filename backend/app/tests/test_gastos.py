"""
Tests CONT-001: Gastos del estudio.
Cubre: CRUD, resumen, filtros, aislamiento tenant.
"""
import pytest
from app.tests.conftest import make_studio, make_user
from app.models.user import UserRole
from app.models.expediente import Expediente, ExpedienteAbogado, RolEnExpediente


def make_expediente(db, studio, user):
    exp = Expediente(
        tenant_id=studio.id,
        numero="GASTO-001",
        caratula="Test Gasto c/ Test",
        fuero="Civil",
        juzgado="Juzgado 1",
    )
    db.add(exp)
    db.flush()
    ea = ExpedienteAbogado(
        tenant_id=studio.id,
        expediente_id=exp.id,
        user_id=user.id,
        rol=RolEnExpediente.responsable,
    )
    db.add(ea)
    db.commit()
    return exp


@pytest.fixture
def exp_a(db, studio_a, admin_a):
    user, _ = admin_a
    return make_expediente(db, studio_a, user)


GASTO_BASE = {
    "descripcion": "Alquiler oficina abril",
    "categoria": "alquiler",
    "monto": "50000.00",
    "moneda": "ARS",
    "fecha": "2026-04-01",
}


class TestGastosCRUD:
    def test_crear_gasto(self, client, auth_a):
        r = client.post("/gastos", json=GASTO_BASE, headers=auth_a)
        assert r.status_code == 201
        data = r.json()
        assert data["descripcion"] == GASTO_BASE["descripcion"]
        assert data["categoria"] == "alquiler"
        assert "id" in data

    def test_listar_gastos(self, client, auth_a):
        client.post("/gastos", json=GASTO_BASE, headers=auth_a)
        client.post("/gastos", json={**GASTO_BASE, "descripcion": "Otro gasto"}, headers=auth_a)
        r = client.get("/gastos", headers=auth_a)
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_actualizar_gasto(self, client, auth_a):
        r = client.post("/gastos", json=GASTO_BASE, headers=auth_a)
        gasto_id = r.json()["id"]
        r2 = client.patch(f"/gastos/{gasto_id}", json={"descripcion": "Actualizado"}, headers=auth_a)
        assert r2.status_code == 200
        assert r2.json()["descripcion"] == "Actualizado"

    def test_eliminar_gasto(self, client, auth_a):
        r = client.post("/gastos", json=GASTO_BASE, headers=auth_a)
        gasto_id = r.json()["id"]
        r2 = client.delete(f"/gastos/{gasto_id}", headers=auth_a)
        assert r2.status_code == 204
        r3 = client.get("/gastos", headers=auth_a)
        assert len(r3.json()) == 0

    def test_gasto_con_expediente(self, client, auth_a, exp_a):
        r = client.post("/gastos", json={**GASTO_BASE, "expediente_id": exp_a.id}, headers=auth_a)
        assert r.status_code == 201
        assert r.json()["expediente_id"] == exp_a.id


class TestGastosResumen:
    def test_resumen_vacio(self, client, auth_a):
        r = client.get("/gastos/resumen", headers=auth_a)
        assert r.status_code == 200
        data = r.json()
        assert float(data["total_ars"]) == 0.0
        assert data["cantidad"] == 0

    def test_resumen_con_gastos(self, client, auth_a):
        client.post("/gastos", json={**GASTO_BASE, "monto": "30000", "fecha": "2026-04-05"}, headers=auth_a)
        client.post("/gastos", json={**GASTO_BASE, "monto": "20000", "fecha": "2026-04-10"}, headers=auth_a)
        r = client.get("/gastos/resumen?mes=4&anio=2026", headers=auth_a)
        assert r.status_code == 200
        data = r.json()
        assert float(data["total_ars"]) == 50000.0
        assert data["cantidad"] == 2


class TestGastosAislamientoTenant:
    def test_studio_b_no_ve_gastos_a(self, client, auth_a, auth_b):
        client.post("/gastos", json=GASTO_BASE, headers=auth_a)
        r = client.get("/gastos", headers=auth_b)
        assert r.status_code == 200
        assert len(r.json()) == 0

    def test_studio_b_no_puede_editar_gasto_a(self, client, auth_a, auth_b):
        r = client.post("/gastos", json=GASTO_BASE, headers=auth_a)
        gasto_id = r.json()["id"]
        r2 = client.patch(f"/gastos/{gasto_id}", json={"descripcion": "Hack"}, headers=auth_b)
        assert r2.status_code == 404

    def test_studio_b_no_puede_eliminar_gasto_a(self, client, auth_a, auth_b):
        r = client.post("/gastos", json=GASTO_BASE, headers=auth_a)
        gasto_id = r.json()["id"]
        r2 = client.delete(f"/gastos/{gasto_id}", headers=auth_b)
        assert r2.status_code == 404
