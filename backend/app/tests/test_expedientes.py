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

    def test_movimiento_con_fecha_manual(self, client, auth_a):
        eid = create_expediente(client, auth_a).json()["id"]
        r = client.post(f"/expedientes/{eid}/movimientos",
                        json={"texto": "Audiencia", "fecha_manual": "2025-03-15"}, headers=auth_a)
        assert r.status_code == 201
        assert r.json()["fecha_manual"] == "2025-03-15"

    def test_editar_movimiento_texto(self, client, auth_a):
        eid = create_expediente(client, auth_a).json()["id"]
        mid = client.post(f"/expedientes/{eid}/movimientos",
                          json={"texto": "Original"}, headers=auth_a).json()["id"]
        r = client.patch(f"/expedientes/{eid}/movimientos/{mid}",
                         json={"texto": "Editado"}, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["texto"] == "Editado"

    def test_editar_movimiento_fecha_manual(self, client, auth_a):
        eid = create_expediente(client, auth_a).json()["id"]
        mid = client.post(f"/expedientes/{eid}/movimientos",
                          json={"texto": "Mov"}, headers=auth_a).json()["id"]
        r = client.patch(f"/expedientes/{eid}/movimientos/{mid}",
                         json={"fecha_manual": "2025-06-01"}, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["fecha_manual"] == "2025-06-01"
        assert r.json()["texto"] == "Mov"  # no se tocó el texto

    def test_editar_movimiento_ajeno_404(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a).json()["id"]
        mid = client.post(f"/expedientes/{eid}/movimientos",
                          json={"texto": "Mov"}, headers=auth_a).json()["id"]
        r = client.patch(f"/expedientes/{eid}/movimientos/{mid}",
                         json={"texto": "hack"}, headers=auth_b)
        assert r.status_code == 404

    def test_eliminar_movimiento(self, client, auth_a):
        eid = create_expediente(client, auth_a).json()["id"]
        mid = client.post(f"/expedientes/{eid}/movimientos",
                          json={"texto": "Borrar esto"}, headers=auth_a).json()["id"]
        r = client.delete(f"/expedientes/{eid}/movimientos/{mid}", headers=auth_a)
        assert r.status_code == 204
        # ya no aparece en la lista
        movs = client.get(f"/expedientes/{eid}/movimientos", headers=auth_a).json()
        assert all(m["id"] != mid for m in movs)

    def test_eliminar_movimiento_ajeno_404(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a).json()["id"]
        mid = client.post(f"/expedientes/{eid}/movimientos",
                          json={"texto": "Mov"}, headers=auth_a).json()["id"]
        r = client.delete(f"/expedientes/{eid}/movimientos/{mid}", headers=auth_b)
        assert r.status_code == 404

    def test_movimiento_sin_acceso_a_expediente_ajeno(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a).json()["id"]
        r = client.post(f"/expedientes/{eid}/movimientos",
                        json={"texto": "hack"}, headers=auth_b)
        assert r.status_code == 404


class TestExpedienteClientes:
    def _crear_cliente(self, client, headers, nombre="Cliente Test"):
        return client.post("/clientes", json={"nombre": nombre, "tipo": "fisica"}, headers=headers).json()

    def test_crear_expediente_con_cliente_ids(self, client, auth_a):
        c = self._crear_cliente(client, auth_a)
        r = create_expediente(client, auth_a)
        # patch via clientes endpoint
        eid = r.json()["id"]
        r2 = client.post(f"/expedientes/{eid}/clientes",
                         json={"cliente_id": c["id"]}, headers=auth_a)
        assert r2.status_code in (200, 201)
        data = r2.json()
        assert any(ec["id"] == c["id"] for ec in data["clientes_extra"])

    def test_agregar_cliente_a_expediente(self, client, auth_a):
        c = self._crear_cliente(client, auth_a)
        eid = create_expediente(client, auth_a).json()["id"]
        r = client.post(f"/expedientes/{eid}/clientes",
                        json={"cliente_id": c["id"]}, headers=auth_a)
        assert r.status_code == 201
        assert any(ec["id"] == c["id"] for ec in r.json()["clientes_extra"])

    def test_no_duplicar_cliente(self, client, auth_a):
        c = self._crear_cliente(client, auth_a)
        eid = create_expediente(client, auth_a).json()["id"]
        client.post(f"/expedientes/{eid}/clientes", json={"cliente_id": c["id"]}, headers=auth_a)
        r = client.post(f"/expedientes/{eid}/clientes",
                        json={"cliente_id": c["id"]}, headers=auth_a)
        assert r.status_code == 400

    def test_agregar_multiples_clientes(self, client, auth_a):
        c1 = self._crear_cliente(client, auth_a, "Cliente 1")
        c2 = self._crear_cliente(client, auth_a, "Cliente 2")
        eid = create_expediente(client, auth_a).json()["id"]
        client.post(f"/expedientes/{eid}/clientes", json={"cliente_id": c1["id"]}, headers=auth_a)
        r = client.post(f"/expedientes/{eid}/clientes",
                        json={"cliente_id": c2["id"]}, headers=auth_a)
        assert r.status_code == 201
        ids = [ec["id"] for ec in r.json()["clientes_extra"]]
        assert c1["id"] in ids and c2["id"] in ids

    def test_quitar_cliente(self, client, auth_a):
        c = self._crear_cliente(client, auth_a)
        eid = create_expediente(client, auth_a).json()["id"]
        client.post(f"/expedientes/{eid}/clientes", json={"cliente_id": c["id"]}, headers=auth_a)
        r = client.delete(f"/expedientes/{eid}/clientes/{c['id']}", headers=auth_a)
        assert r.status_code == 204

    def test_quitar_cliente_inexistente_404(self, client, auth_a):
        eid = create_expediente(client, auth_a).json()["id"]
        r = client.delete(f"/expedientes/{eid}/clientes/no-existe", headers=auth_a)
        assert r.status_code == 404

    def test_aislamiento_tenant_agregar_cliente(self, client, auth_a, auth_b):
        """Tenant B no puede agregar clientes al expediente de Tenant A."""
        c_b = self._crear_cliente(client, auth_b, "Cliente B")
        eid_a = create_expediente(client, auth_a).json()["id"]
        r = client.post(f"/expedientes/{eid_a}/clientes",
                        json={"cliente_id": c_b["id"]}, headers=auth_b)
        assert r.status_code == 404  # expediente no encontrado para B

    def test_cliente_ajeno_no_agregable(self, client, auth_a, auth_b):
        """No se puede agregar un cliente de otro tenant."""
        c_b = self._crear_cliente(client, auth_b, "Cliente B")
        eid_a = create_expediente(client, auth_a).json()["id"]
        r = client.post(f"/expedientes/{eid_a}/clientes",
                        json={"cliente_id": c_b["id"]}, headers=auth_a)
        assert r.status_code == 404  # cliente no encontrado en tenant A


class TestExpedienteNuevosCampos:
    def test_crear_con_numero_judicial_y_localidad(self, client, auth_a):
        r = client.post("/expedientes", json={
            "caratula": "Test c/ Test",
            "numero_judicial": "045/2026",
            "localidad": "Córdoba, Córdoba",
        }, headers=auth_a)
        assert r.status_code == 201
        data = r.json()
        assert data["numero_judicial"] == "045/2026"
        assert data["localidad"] == "Córdoba, Córdoba"

    def test_actualizar_numero_judicial_y_localidad(self, client, auth_a):
        eid = create_expediente(client, auth_a).json()["id"]
        r = client.patch(f"/expedientes/{eid}", json={
            "numero_judicial": "999/2026",
            "localidad": "Rosario, Santa Fe",
        }, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["numero_judicial"] == "999/2026"
        assert r.json()["localidad"] == "Rosario, Santa Fe"


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
