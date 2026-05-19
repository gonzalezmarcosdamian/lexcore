"""
Tests para /ingresos — módulo contable: CRUD y aislamiento tenant.
"""
import pytest
from app.tests.conftest import make_studio, make_user
from datetime import date

INGRESO_BASE = {
    "descripcion": "Consulta externa",
    "categoria": "consultas",
    "monto": "15000.00",
    "moneda": "ARS",
    "fecha": str(date.today()),
}


class TestIngresosCRUD:
    def test_crear_ingreso(self, client, auth_a):
        r = client.post("/ingresos", json=INGRESO_BASE, headers=auth_a)
        assert r.status_code == 201
        data = r.json()
        assert data["descripcion"] == "Consulta externa"
        assert float(data["monto"]) == 15000.0

    def test_listar_ingresos(self, client, auth_a):
        client.post("/ingresos", json=INGRESO_BASE, headers=auth_a)
        r = client.get("/ingresos", headers=auth_a)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_editar_ingreso(self, client, auth_a):
        r = client.post("/ingresos", json=INGRESO_BASE, headers=auth_a)
        ing_id = r.json()["id"]
        r2 = client.patch(f"/ingresos/{ing_id}", json={"descripcion": "Actualizado"}, headers=auth_a)
        assert r2.status_code == 200
        assert r2.json()["descripcion"] == "Actualizado"

    def test_eliminar_ingreso(self, client, auth_a):
        r = client.post("/ingresos", json=INGRESO_BASE, headers=auth_a)
        ing_id = r.json()["id"]
        r2 = client.delete(f"/ingresos/{ing_id}", headers=auth_a)
        assert r2.status_code == 204

    def test_404_ingreso_inexistente(self, client, auth_a):
        r = client.get("/ingresos/id-falso", headers=auth_a)
        assert r.status_code in (404, 405)

    def test_resumen_ingresos(self, client, auth_a):
        client.post("/ingresos", json=INGRESO_BASE, headers=auth_a)
        r = client.get("/ingresos/resumen", headers=auth_a)
        assert r.status_code == 200
        assert "total_ars" in r.json()

    def test_sin_token_401(self, client):
        r = client.get("/ingresos")
        assert r.status_code in (401, 403)


class TestIngresosAislamientoTenant:
    def test_no_ve_ingresos_de_otro_estudio(self, client, auth_a, auth_b):
        client.post("/ingresos", json=INGRESO_BASE, headers=auth_a)
        r = client.get("/ingresos", headers=auth_b)
        assert r.status_code == 200
        assert len(r.json()) == 0

    def test_no_puede_editar_ingreso_ajeno(self, client, auth_a, auth_b):
        r = client.post("/ingresos", json=INGRESO_BASE, headers=auth_a)
        ing_id = r.json()["id"]
        r2 = client.patch(f"/ingresos/{ing_id}", json={"descripcion": "Hack"}, headers=auth_b)
        assert r2.status_code == 404

    def test_no_puede_eliminar_ingreso_ajeno(self, client, auth_a, auth_b):
        r = client.post("/ingresos", json=INGRESO_BASE, headers=auth_a)
        ing_id = r.json()["id"]
        r2 = client.delete(f"/ingresos/{ing_id}", headers=auth_b)
        assert r2.status_code == 404
