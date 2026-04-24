"""
test_vencimientos.py — DEPRECADO.

La entidad Vencimiento fue renombrada a Movimiento (sprint 18).
Los tests equivalentes están en test_movimientos.py.

Este archivo conserva solo los tests del endpoint /vencimientos
(backward compat) para verificar que sigue funcionando como alias.
"""
from datetime import date, timedelta


def hoy_plus(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def create_expediente(client, headers):
    return client.post("/expedientes", json={"caratula": "Test c/ Test"}, headers=headers).json()["id"]


def create_via_vencimientos(client, headers, eid, *, dias=10, titulo="Audiencia"):
    """Crea via /vencimientos (alias backward compat)."""
    return client.post("/vencimientos", json={
        "expediente_id": eid,
        "titulo": titulo,
        "fecha": hoy_plus(dias),
        "hora": "10:00",
        "tipo": "audiencia",
    }, headers=headers)


class TestVencimientosBackwardCompat:
    """Verifica que /vencimientos siga funcionando como alias de /movimientos."""

    def test_crear_via_vencimientos(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        r = create_via_vencimientos(client, auth_a, eid)
        assert r.status_code == 201
        data = r.json()
        assert data["titulo"] == "Audiencia"
        assert data["estado"] == "pendiente"

    def test_listar_via_vencimientos(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        create_via_vencimientos(client, auth_a, eid, dias=5)
        r = client.get(f"/vencimientos?expediente_id={eid}", headers=auth_a)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_proximos_via_vencimientos(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        create_via_vencimientos(client, auth_a, eid, dias=3)
        create_via_vencimientos(client, auth_a, eid, dias=20)
        r = client.get("/vencimientos?proximos=7", headers=auth_a)
        assert r.status_code == 200
        # Al menos 1 resultado dentro de 7 días
        assert len(r.json()) >= 1

    def test_marcar_cumplido_via_vencimientos(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        vid = create_via_vencimientos(client, auth_a, eid).json()["id"]
        r = client.patch(f"/vencimientos/{vid}", json={"estado": "cumplido"}, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["estado"] == "cumplido"

    def test_eliminar_via_vencimientos(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        vid = create_via_vencimientos(client, auth_a, eid).json()["id"]
        r = client.delete(f"/vencimientos/{vid}", headers=auth_a)
        assert r.status_code == 204

    def test_sin_auth_retorna_401(self, client):
        r = client.get("/vencimientos")
        assert r.status_code in (401, 403)

    def test_aislamiento_tenant(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a)
        create_via_vencimientos(client, auth_a, eid)
        r = client.get(f"/vencimientos?expediente_id={eid}", headers=auth_b)
        assert r.json() == []
