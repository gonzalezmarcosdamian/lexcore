"""Tests para /vencimientos — CRUD + urgencia + aislamiento tenant."""
from datetime import date, timedelta


def hoy_plus(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def create_expediente(client, headers):
    return client.post("/expedientes", json={"caratula": "Test c/ Test"}, headers=headers).json()["id"]


def create_vencimiento(client, headers, eid, *, dias=10, descripcion="Audiencia"):
    return client.post("/vencimientos", json={
        "expediente_id": eid,
        "descripcion": descripcion,
        "fecha": hoy_plus(dias),
        "tipo": "audiencia",
    }, headers=headers)


class TestVencimientosCRUD:
    def test_crear_vencimiento(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        r = create_vencimiento(client, auth_a, eid)
        assert r.status_code == 201
        assert r.json()["cumplido"] is False

    def test_listar_proximos(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        create_vencimiento(client, auth_a, eid, dias=5)
        create_vencimiento(client, auth_a, eid, dias=15)
        r = client.get("/vencimientos?proximos=7", headers=auth_a)
        assert len(r.json()) == 1

    def test_marcar_cumplido(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        vid = create_vencimiento(client, auth_a, eid).json()["id"]
        r = client.patch(f"/vencimientos/{vid}", json={"cumplido": True}, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["cumplido"] is True

    def test_filtrar_cumplidos(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        vid = create_vencimiento(client, auth_a, eid).json()["id"]
        client.patch(f"/vencimientos/{vid}", json={"cumplido": True}, headers=auth_a)
        create_vencimiento(client, auth_a, eid, dias=20)

        pendientes = client.get("/vencimientos?cumplido=false", headers=auth_a).json()
        cumplidos = client.get("/vencimientos?cumplido=true", headers=auth_a).json()
        assert len(pendientes) == 1
        assert len(cumplidos) == 1

    def test_eliminar_vencimiento(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        vid = create_vencimiento(client, auth_a, eid).json()["id"]
        r = client.delete(f"/vencimientos/{vid}", headers=auth_a)
        assert r.status_code == 204

    def test_expediente_invalido(self, client, auth_a):
        r = client.post("/vencimientos", json={
            "expediente_id": "no-existe",
            "descripcion": "Test",
            "fecha": hoy_plus(5),
            "tipo": "audiencia",
        }, headers=auth_a)
        assert r.status_code == 404

    def test_sin_auth_retorna_401(self, client):
        r = client.get("/vencimientos")
        assert r.status_code in (401, 403)


class TestVencimientosAislamientoTenant:
    def test_no_ve_vencimientos_de_otro_tenant(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a)
        create_vencimiento(client, auth_a, eid)
        r = client.get("/vencimientos", headers=auth_b)
        assert r.json() == []

    def test_no_puede_modificar_vencimiento_ajeno(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a)
        vid = create_vencimiento(client, auth_a, eid).json()["id"]
        r = client.patch(f"/vencimientos/{vid}", json={"cumplido": True}, headers=auth_b)
        assert r.status_code == 404
