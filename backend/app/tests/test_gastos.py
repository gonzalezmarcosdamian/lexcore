"""
Tests CONT-001/002: Gastos del estudio (módulo Contable).
Cubre: CRUD gastos puntuales, plantillas recurrentes, confirmar, resumen, aislamiento tenant.
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

PLANTILLA_BASE = {
    "descripcion": "Alquiler mensual",
    "categoria": "alquiler",
    "monto_esperado": "50000.00",
    "moneda": "ARS",
    "dia_del_mes": 1,
}


class TestGastosCRUD:
    def test_crear_gasto(self, client, auth_a):
        r = client.post("/gastos", json=GASTO_BASE, headers=auth_a)
        assert r.status_code == 201
        data = r.json()
        assert data["descripcion"] == GASTO_BASE["descripcion"]
        assert data["categoria"] == "alquiler"
        assert data["estado"] == "confirmado"
        assert data["mes"] == 4
        assert data["anio"] == 2026
        assert "id" in data

    def test_listar_gastos(self, client, auth_a):
        client.post("/gastos", json=GASTO_BASE, headers=auth_a)
        client.post("/gastos", json={**GASTO_BASE, "descripcion": "Otro gasto"}, headers=auth_a)
        r = client.get("/gastos?mes=4&anio=2026", headers=auth_a)
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
        r3 = client.get("/gastos?mes=4&anio=2026", headers=auth_a)
        assert len(r3.json()) == 0

    def test_gasto_con_expediente(self, client, auth_a, exp_a):
        r = client.post("/gastos", json={**GASTO_BASE, "expediente_id": exp_a.id}, headers=auth_a)
        assert r.status_code == 201
        assert r.json()["expediente_id"] == exp_a.id


class TestPlantillas:
    def test_crear_plantilla(self, client, auth_a):
        r = client.post("/gastos/plantillas", json=PLANTILLA_BASE, headers=auth_a)
        assert r.status_code == 201
        data = r.json()
        assert data["descripcion"] == PLANTILLA_BASE["descripcion"]
        assert data["activa"] is True
        assert "id" in data

    def test_listar_plantillas(self, client, auth_a):
        client.post("/gastos/plantillas", json=PLANTILLA_BASE, headers=auth_a)
        client.post("/gastos/plantillas", json={**PLANTILLA_BASE, "descripcion": "Servicios"}, headers=auth_a)
        r = client.get("/gastos/plantillas", headers=auth_a)
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_actualizar_plantilla(self, client, auth_a):
        r = client.post("/gastos/plantillas", json=PLANTILLA_BASE, headers=auth_a)
        pid = r.json()["id"]
        r2 = client.patch(f"/gastos/plantillas/{pid}", json={"activa": False}, headers=auth_a)
        assert r2.status_code == 200
        assert r2.json()["activa"] is False

    def test_eliminar_plantilla(self, client, auth_a):
        r = client.post("/gastos/plantillas", json=PLANTILLA_BASE, headers=auth_a)
        pid = r.json()["id"]
        r2 = client.delete(f"/gastos/plantillas/{pid}", headers=auth_a)
        assert r2.status_code == 204

    def test_auto_generar_instancia_al_listar(self, client, auth_a):
        """Al listar gastos del mes, las plantillas activas deben generar instancias pendientes."""
        client.post("/gastos/plantillas", json=PLANTILLA_BASE, headers=auth_a)
        r = client.get("/gastos?mes=4&anio=2026", headers=auth_a)
        assert r.status_code == 200
        gastos = r.json()
        assert len(gastos) == 1
        assert gastos[0]["estado"] == "pendiente"
        assert gastos[0]["plantilla_id"] is not None

    def test_confirmar_gasto_pendiente(self, client, auth_a):
        client.post("/gastos/plantillas", json=PLANTILLA_BASE, headers=auth_a)
        gastos = client.get("/gastos?mes=4&anio=2026", headers=auth_a).json()
        gasto_id = gastos[0]["id"]
        r = client.post(f"/gastos/{gasto_id}/confirmar", json={}, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["estado"] == "confirmado"

    def test_confirmar_con_monto_ajustado(self, client, auth_a):
        client.post("/gastos/plantillas", json=PLANTILLA_BASE, headers=auth_a)
        gastos = client.get("/gastos?mes=4&anio=2026", headers=auth_a).json()
        gasto_id = gastos[0]["id"]
        r = client.post(f"/gastos/{gasto_id}/confirmar", json={"monto_real": "55000"}, headers=auth_a)
        assert r.status_code == 200
        assert float(r.json()["monto"]) == 55000.0

    def test_no_duplicar_instancias(self, client, auth_a):
        """Listar dos veces no debe crear duplicados."""
        client.post("/gastos/plantillas", json=PLANTILLA_BASE, headers=auth_a)
        client.get("/gastos?mes=4&anio=2026", headers=auth_a)
        client.get("/gastos?mes=4&anio=2026", headers=auth_a)
        r = client.get("/gastos?mes=4&anio=2026", headers=auth_a)
        assert len(r.json()) == 1


class TestGastosResumen:
    def test_resumen_vacio(self, client, auth_a):
        r = client.get("/gastos/resumen", headers=auth_a)
        assert r.status_code == 200
        data = r.json()
        assert float(data["total_ars"]) == 0.0
        assert data["cantidad"] == 0

    def test_resumen_solo_confirmados(self, client, auth_a):
        """El resumen solo cuenta gastos confirmados, no pendientes."""
        client.post("/gastos/plantillas", json=PLANTILLA_BASE, headers=auth_a)
        # Listar genera un pendiente
        client.get("/gastos?mes=4&anio=2026", headers=auth_a)
        r = client.get("/gastos/resumen?mes=4&anio=2026", headers=auth_a)
        assert r.status_code == 200
        # Pendiente no cuenta
        assert r.json()["cantidad"] == 0

    def test_resumen_con_gastos_confirmados(self, client, auth_a):
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
        r = client.get("/gastos?mes=4&anio=2026", headers=auth_b)
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

    def test_plantillas_aisladas_por_tenant(self, client, auth_a, auth_b):
        client.post("/gastos/plantillas", json=PLANTILLA_BASE, headers=auth_a)
        r = client.get("/gastos/plantillas", headers=auth_b)
        assert r.status_code == 200
        assert len(r.json()) == 0


class TestGastosHistorico:
    """GET /gastos/historico — evolución financiera para el gráfico."""

    def test_historico_retorna_n_meses(self, client, auth_a):
        for n in (3, 6, 12):
            r = client.get(f"/gastos/historico?meses={n}", headers=auth_a)
            assert r.status_code == 200
            assert len(r.json()) == n

    def test_historico_estructura_campos(self, client, auth_a):
        r = client.get("/gastos/historico?meses=3", headers=auth_a)
        item = r.json()[0]
        assert "mes" in item
        assert "anio" in item
        assert "label" in item
        assert "egresos_ars" in item
        assert "ingresos_ars" in item
        assert "resultado_ars" in item

    def test_historico_labels_en_espanol(self, client, auth_a):
        r = client.get("/gastos/historico?meses=12", headers=auth_a)
        labels = [d["label"] for d in r.json()]
        meses_validos = {"Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"}
        assert all(l in meses_validos for l in labels)

    def test_historico_ultimo_mes_es_actual(self, client, auth_a):
        from datetime import date
        hoy = date.today()
        r = client.get("/gastos/historico?meses=3", headers=auth_a)
        ultimo = r.json()[-1]
        assert ultimo["mes"] == hoy.month
        assert ultimo["anio"] == hoy.year

    def test_historico_egresos_mes_pasado(self, client, auth_a):
        """Crea gasto en mes pasado y verifica que aparece en el histórico de 6M."""
        from datetime import date
        hoy = date.today()
        # Usar mes anterior para evitar auto-generación de recurrentes en mes actual
        if hoy.month == 1:
            mes_ant, anio_ant = 12, hoy.year - 1
        else:
            mes_ant, anio_ant = hoy.month - 1, hoy.year
        fecha = f"{anio_ant}-{str(mes_ant).zfill(2)}-15"
        client.post("/gastos", json={**GASTO_BASE, "monto": "10000", "fecha": fecha}, headers=auth_a)
        r = client.get("/gastos/historico?meses=6", headers=auth_a)
        assert r.status_code == 200
        # El penúltimo elemento debe ser el mes pasado
        penultimo = r.json()[-2]
        assert penultimo["mes"] == mes_ant
        assert float(penultimo["egresos_ars"]) == 10000.0

    def test_historico_sin_auth_401(self, client):
        r = client.get("/gastos/historico?meses=3")
        assert r.status_code in (401, 403)

    def test_historico_aislado_por_tenant(self, client, auth_a, auth_b):
        from datetime import date
        hoy = date.today()
        if hoy.month == 1:
            mes_ant, anio_ant = 12, hoy.year - 1
        else:
            mes_ant, anio_ant = hoy.month - 1, hoy.year
        fecha = f"{anio_ant}-{str(mes_ant).zfill(2)}-15"
        client.post("/gastos", json={**GASTO_BASE, "monto": "99000", "fecha": fecha}, headers=auth_a)
        r = client.get("/gastos/historico?meses=6", headers=auth_b)
        assert all(d["egresos_ars"] == 0.0 for d in r.json())
