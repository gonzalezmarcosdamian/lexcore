"""Tests para /movimientos — CRUD + estado + notas + aislamiento tenant.

Reemplaza test_vencimientos.py adaptado al nuevo modelo:
  - campo 'titulo' (era 'descripcion')
  - campo 'estado' (era 'cumplido: bool')
  - endpoint /movimientos (era /vencimientos)
"""
from datetime import date, timedelta


def hoy_plus(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def create_expediente(client, headers):
    return client.post("/expedientes", json={"caratula": "Test c/ Test"}, headers=headers).json()["id"]


def create_movimiento(client, headers, eid, *, dias=10, titulo="Audiencia de prueba", tipo="audiencia"):
    return client.post("/movimientos", json={
        "expediente_id": eid,
        "titulo": titulo,
        "fecha": hoy_plus(dias),
        "hora": "10:00",
        "tipo": tipo,
    }, headers=headers)


class TestMovimientosCRUD:
    def test_crear_movimiento(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        r = create_movimiento(client, auth_a, eid)
        assert r.status_code == 201
        data = r.json()
        assert data["titulo"] == "Audiencia de prueba"
        assert data["estado"] == "pendiente"
        assert data["tipo"] == "audiencia"

    def test_crear_requiere_expediente(self, client, auth_a):
        r = client.post("/movimientos", json={
            "expediente_id": "no-existe",
            "titulo": "Test",
            "fecha": hoy_plus(5),
            "hora": "09:00",
            "tipo": "audiencia",
        }, headers=auth_a)
        assert r.status_code == 404

    def test_obtener_movimiento(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        mid = create_movimiento(client, auth_a, eid).json()["id"]
        r = client.get(f"/movimientos/{mid}", headers=auth_a)
        assert r.status_code == 200
        assert r.json()["id"] == mid

    def test_listar_proximos(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        create_movimiento(client, auth_a, eid, dias=3)
        create_movimiento(client, auth_a, eid, dias=20)
        r = client.get("/movimientos?proximos=7", headers=auth_a)
        assert len(r.json()) == 1

    def test_listar_por_expediente(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        create_movimiento(client, auth_a, eid)
        create_movimiento(client, auth_a, eid)
        r = client.get(f"/movimientos?expediente_id={eid}", headers=auth_a)
        assert len(r.json()) >= 2

    def test_marcar_cumplido(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        mid = create_movimiento(client, auth_a, eid).json()["id"]
        r = client.patch(f"/movimientos/{mid}", json={"estado": "cumplido"}, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["estado"] == "cumplido"

    def test_marcar_pendiente(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        mid = create_movimiento(client, auth_a, eid).json()["id"]
        client.patch(f"/movimientos/{mid}", json={"estado": "cumplido"}, headers=auth_a)
        r = client.patch(f"/movimientos/{mid}", json={"estado": "pendiente"}, headers=auth_a)
        assert r.json()["estado"] == "pendiente"

    def test_filtrar_por_estado(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        mid = create_movimiento(client, auth_a, eid).json()["id"]
        client.patch(f"/movimientos/{mid}", json={"estado": "cumplido"}, headers=auth_a)
        create_movimiento(client, auth_a, eid, dias=20)

        pendientes = client.get("/movimientos?estado=pendiente", headers=auth_a).json()
        cumplidos = client.get("/movimientos?estado=cumplido", headers=auth_a).json()
        assert any(m["id"] == mid for m in cumplidos)
        assert not any(m["id"] == mid for m in pendientes)

    def test_editar_titulo(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        mid = create_movimiento(client, auth_a, eid).json()["id"]
        r = client.patch(f"/movimientos/{mid}", json={"titulo": "Titulo actualizado"}, headers=auth_a)
        assert r.json()["titulo"] == "Titulo actualizado"

    def test_eliminar_movimiento(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        mid = create_movimiento(client, auth_a, eid).json()["id"]
        r = client.delete(f"/movimientos/{mid}", headers=auth_a)
        assert r.status_code == 204
        # Verificar que no existe
        r2 = client.get(f"/movimientos/{mid}", headers=auth_a)
        assert r2.status_code == 404

    def test_sin_auth_retorna_401(self, client):
        r = client.get("/movimientos")
        assert r.status_code in (401, 403)


class TestMovimientosNotas:
    def test_crear_nota(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        mid = create_movimiento(client, auth_a, eid).json()["id"]
        r = client.post(f"/movimientos/{mid}/notas", json={"texto": "Nota de prueba"}, headers=auth_a)
        assert r.status_code == 201
        assert r.json()["texto"] == "Nota de prueba"

    def test_listar_notas(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        mid = create_movimiento(client, auth_a, eid).json()["id"]
        client.post(f"/movimientos/{mid}/notas", json={"texto": "Nota 1"}, headers=auth_a)
        client.post(f"/movimientos/{mid}/notas", json={"texto": "Nota 2"}, headers=auth_a)
        r = client.get(f"/movimientos/{mid}/notas", headers=auth_a)
        assert len(r.json()) == 2

    def test_eliminar_nota(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        mid = create_movimiento(client, auth_a, eid).json()["id"]
        nid = client.post(f"/movimientos/{mid}/notas", json={"texto": "Borrar"}, headers=auth_a).json()["id"]
        r = client.delete(f"/movimientos/{mid}/notas/{nid}", headers=auth_a)
        assert r.status_code == 204

    def test_nota_de_otro_tenant_no_accesible(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a)
        mid = create_movimiento(client, auth_a, eid).json()["id"]
        nid = client.post(f"/movimientos/{mid}/notas", json={"texto": "Privada"}, headers=auth_a).json()["id"]
        r = client.delete(f"/movimientos/{mid}/notas/{nid}", headers=auth_b)
        assert r.status_code == 404


class TestMovimientosAislamientoTenant:
    def test_no_ve_movimientos_de_otro_tenant(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a)
        create_movimiento(client, auth_a, eid)
        r = client.get("/movimientos", headers=auth_b)
        assert r.json() == []

    def test_no_puede_modificar_movimiento_ajeno(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a)
        mid = create_movimiento(client, auth_a, eid).json()["id"]
        r = client.patch(f"/movimientos/{mid}", json={"estado": "cumplido"}, headers=auth_b)
        assert r.status_code == 404

    def test_no_puede_eliminar_movimiento_ajeno(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a)
        mid = create_movimiento(client, auth_a, eid).json()["id"]
        r = client.delete(f"/movimientos/{mid}", headers=auth_b)
        assert r.status_code == 404

    def test_no_puede_agregar_nota_a_movimiento_ajeno(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a)
        mid = create_movimiento(client, auth_a, eid).json()["id"]
        r = client.post(f"/movimientos/{mid}/notas", json={"texto": "Intruso"}, headers=auth_b)
        assert r.status_code == 404
