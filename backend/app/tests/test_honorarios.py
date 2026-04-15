"""
Tests HON-001: Honorarios + pagos.
Cubre: CRUD completo, saldo calculado, aislamiento tenant.
"""
import pytest
from app.tests.conftest import make_studio, make_user
from app.models.user import UserRole
from app.models.expediente import Expediente, ExpedienteAbogado, RolEnExpediente


# ── Fixtures de expediente ────────────────────────────────────────────────────

def make_expediente(db, studio, user):
    exp = Expediente(
        tenant_id=studio.id,
        numero="TEST-001",
        caratula="Test c/ Test s/ Cobro",
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


@pytest.fixture
def exp_b(db, studio_b, admin_b):
    user, _ = admin_b
    return make_expediente(db, studio_b, user)


HON_BASE = {
    "concepto": "Honorarios por patrocinio letrado",
    "monto_acordado": "150000.00",
    "moneda": "ARS",
    "fecha_acuerdo": "2026-04-15",
}


# ── CRUD ──────────────────────────────────────────────────────────────────────

class TestHonorariosCRUD:
    def test_crear_honorario(self, client, auth_a, exp_a):
        r = client.post("/honorarios", json={**HON_BASE, "expediente_id": exp_a.id}, headers=auth_a)
        assert r.status_code == 201
        data = r.json()
        assert data["concepto"] == HON_BASE["concepto"]
        assert float(data["monto_acordado"]) == 150000.0
        assert data["moneda"] == "ARS"
        assert float(data["total_pagado"]) == 0.0
        assert float(data["saldo_pendiente"]) == 150000.0
        assert data["pagos"] == []

    def test_crear_honorario_usd(self, client, auth_a, exp_a):
        r = client.post("/honorarios", json={
            **HON_BASE, "expediente_id": exp_a.id,
            "monto_acordado": "2500.00", "moneda": "USD",
        }, headers=auth_a)
        assert r.status_code == 201
        assert r.json()["moneda"] == "USD"

    def test_listar_honorarios_expediente(self, client, auth_a, exp_a):
        client.post("/honorarios", json={**HON_BASE, "expediente_id": exp_a.id}, headers=auth_a)
        client.post("/honorarios", json={
            **HON_BASE, "expediente_id": exp_a.id,
            "concepto": "Segundo honorario", "monto_acordado": "50000.00",
        }, headers=auth_a)
        r = client.get(f"/honorarios/expediente/{exp_a.id}", headers=auth_a)
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_resumen_dashboard(self, client, auth_a, exp_a):
        client.post("/honorarios", json={**HON_BASE, "expediente_id": exp_a.id}, headers=auth_a)
        r = client.get("/honorarios/resumen", headers=auth_a)
        assert r.status_code == 200
        data = r.json()
        assert float(data["total_acordado_ars"]) == 150000.0
        assert float(data["saldo_pendiente_ars"]) == 150000.0
        assert data["expedientes_con_deuda"] == 1

    def test_actualizar_honorario(self, client, auth_a, exp_a):
        r = client.post("/honorarios", json={**HON_BASE, "expediente_id": exp_a.id}, headers=auth_a)
        hon_id = r.json()["id"]
        r2 = client.patch(f"/honorarios/{hon_id}", json={"concepto": "Honorarios actualizados"}, headers=auth_a)
        assert r2.status_code == 200
        assert r2.json()["concepto"] == "Honorarios actualizados"

    def test_eliminar_honorario(self, client, auth_a, exp_a):
        r = client.post("/honorarios", json={**HON_BASE, "expediente_id": exp_a.id}, headers=auth_a)
        hon_id = r.json()["id"]
        r2 = client.delete(f"/honorarios/{hon_id}", headers=auth_a)
        assert r2.status_code == 204
        r3 = client.get(f"/honorarios/expediente/{exp_a.id}", headers=auth_a)
        assert r3.json() == []

    def test_expediente_inexistente(self, client, auth_a):
        r = client.post("/honorarios", json={**HON_BASE, "expediente_id": "no-existe"}, headers=auth_a)
        assert r.status_code == 404

    def test_monto_cero_rechazado(self, client, auth_a, exp_a):
        r = client.post("/honorarios", json={
            **HON_BASE, "expediente_id": exp_a.id, "monto_acordado": "0"
        }, headers=auth_a)
        assert r.status_code == 422

    def test_sin_auth_retorna_401(self, client, exp_a):
        r = client.get(f"/honorarios/expediente/{exp_a.id}")
        assert r.status_code in (401, 403)


# ── Pagos ─────────────────────────────────────────────────────────────────────

class TestPagos:
    def _crear_honorario(self, client, auth, exp):
        r = client.post("/honorarios", json={**HON_BASE, "expediente_id": exp.id}, headers=auth)
        return r.json()["id"]

    def test_registrar_pago_parcial(self, client, auth_a, exp_a):
        hon_id = self._crear_honorario(client, auth_a, exp_a)
        r = client.post(f"/honorarios/{hon_id}/pagos", json={
            "importe": "50000.00", "moneda": "ARS", "fecha": "2026-04-15",
        }, headers=auth_a)
        assert r.status_code == 201
        assert float(r.json()["importe"]) == 50000.0

    def test_saldo_actualiza_con_pago(self, client, auth_a, exp_a):
        hon_id = self._crear_honorario(client, auth_a, exp_a)
        client.post(f"/honorarios/{hon_id}/pagos", json={
            "importe": "50000.00", "moneda": "ARS", "fecha": "2026-04-15",
        }, headers=auth_a)
        r = client.get(f"/honorarios/expediente/{exp_a.id}", headers=auth_a)
        hon = r.json()[0]
        assert float(hon["total_pagado"]) == 50000.0
        assert float(hon["saldo_pendiente"]) == 100000.0

    def test_pago_total_saldo_cero(self, client, auth_a, exp_a):
        hon_id = self._crear_honorario(client, auth_a, exp_a)
        client.post(f"/honorarios/{hon_id}/pagos", json={
            "importe": "150000.00", "moneda": "ARS", "fecha": "2026-04-15",
        }, headers=auth_a)
        r = client.get(f"/honorarios/expediente/{exp_a.id}", headers=auth_a)
        hon = r.json()[0]
        assert float(hon["saldo_pendiente"]) == 0.0

    def test_pago_con_comprobante(self, client, auth_a, exp_a):
        hon_id = self._crear_honorario(client, auth_a, exp_a)
        r = client.post(f"/honorarios/{hon_id}/pagos", json={
            "importe": "75000.00", "moneda": "ARS", "fecha": "2026-04-15",
            "comprobante": "Transferencia Bancaria N°12345678",
        }, headers=auth_a)
        assert r.json()["comprobante"] == "Transferencia Bancaria N°12345678"

    def test_eliminar_pago(self, client, auth_a, exp_a):
        hon_id = self._crear_honorario(client, auth_a, exp_a)
        rp = client.post(f"/honorarios/{hon_id}/pagos", json={
            "importe": "50000.00", "moneda": "ARS", "fecha": "2026-04-15",
        }, headers=auth_a)
        pago_id = rp.json()["id"]
        client.delete(f"/honorarios/{hon_id}/pagos/{pago_id}", headers=auth_a)
        r = client.get(f"/honorarios/expediente/{exp_a.id}", headers=auth_a)
        assert float(r.json()[0]["total_pagado"]) == 0.0

    def test_resumen_actualiza_con_cobro(self, client, auth_a, exp_a):
        hon_id = self._crear_honorario(client, auth_a, exp_a)
        client.post(f"/honorarios/{hon_id}/pagos", json={
            "importe": "150000.00", "moneda": "ARS", "fecha": "2026-04-15",
        }, headers=auth_a)
        r = client.get("/honorarios/resumen", headers=auth_a)
        data = r.json()
        assert data["expedientes_con_deuda"] == 0
        assert float(data["total_cobrado_ars"]) == 150000.0


# ── Aislamiento tenant ────────────────────────────────────────────────────────

class TestHonorariosAislamientoTenant:
    def test_no_ve_honorarios_de_otro_tenant(self, client, auth_a, auth_b, exp_a, exp_b):
        client.post("/honorarios", json={**HON_BASE, "expediente_id": exp_a.id}, headers=auth_a)
        r = client.get(f"/honorarios/expediente/{exp_a.id}", headers=auth_b)
        assert r.status_code == 404  # exp_a no existe para tenant_b

    def test_no_puede_modificar_honorario_ajeno(self, client, auth_a, auth_b, exp_a):
        r = client.post("/honorarios", json={**HON_BASE, "expediente_id": exp_a.id}, headers=auth_a)
        hon_id = r.json()["id"]
        r2 = client.patch(f"/honorarios/{hon_id}", json={"concepto": "Hack"}, headers=auth_b)
        assert r2.status_code == 404

    def test_resumen_solo_ve_su_tenant(self, client, auth_a, auth_b, exp_a, exp_b):
        client.post("/honorarios", json={**HON_BASE, "expediente_id": exp_a.id}, headers=auth_a)
        r = client.get("/honorarios/resumen", headers=auth_b)
        assert float(r.json()["total_acordado_ars"]) == 0.0
