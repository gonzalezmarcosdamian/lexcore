"""Tests para /clientes — CRUD + aislamiento multi-tenant."""
import pytest
from app.tests.conftest import make_studio, make_user
from app.models.user import UserRole


def create_cliente(client, headers, nombre="Acme SA", tipo="juridica"):
    return client.post("/clientes", json={"nombre": nombre, "tipo": tipo}, headers=headers)


class TestClientesCRUD:
    def test_crear_cliente(self, client, auth_a):
        r = client.post("/clientes", json={"nombre": "García", "tipo": "fisica"}, headers=auth_a)
        assert r.status_code == 201
        data = r.json()
        assert data["nombre"] == "García"
        assert data["tipo"] == "fisica"
        assert data["archivado"] is False

    def test_crear_con_campos_opcionales(self, client, auth_a):
        r = client.post("/clientes", json={
            "nombre": "Empresa SRL",
            "tipo": "juridica",
            "cuit_dni": "30-12345678-9",
            "email": "empresa@test.com",
            "telefono": "011-1234-5678",
        }, headers=auth_a)
        assert r.status_code == 201
        assert r.json()["cuit_dni"] == "30-12345678-9"

    def test_listar_clientes(self, client, auth_a):
        create_cliente(client, auth_a, "Alpha")
        create_cliente(client, auth_a, "Beta")
        r = client.get("/clientes", headers=auth_a)
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_buscar_por_nombre(self, client, auth_a):
        create_cliente(client, auth_a, "García & Asociados")
        create_cliente(client, auth_a, "Martínez SRL")
        r = client.get("/clientes?q=García", headers=auth_a)
        assert len(r.json()) == 1

    def test_obtener_cliente(self, client, auth_a):
        r = create_cliente(client, auth_a)
        cid = r.json()["id"]
        r2 = client.get(f"/clientes/{cid}", headers=auth_a)
        assert r2.status_code == 200

    def test_actualizar_cliente(self, client, auth_a):
        cid = create_cliente(client, auth_a).json()["id"]
        r = client.patch(f"/clientes/{cid}", json={"nombre": "Nuevo Nombre"}, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["nombre"] == "Nuevo Nombre"

    def test_archivar_cliente(self, client, auth_a):
        cid = create_cliente(client, auth_a).json()["id"]
        r = client.delete(f"/clientes/{cid}", headers=auth_a)
        assert r.status_code == 204
        # sigue existiendo pero archivado
        detail = client.get(f"/clientes/{cid}", headers=auth_a).json()
        assert detail["archivado"] is True

    def test_listar_sin_archivados_por_defecto(self, client, auth_a):
        cid = create_cliente(client, auth_a).json()["id"]
        client.delete(f"/clientes/{cid}", headers=auth_a)
        r = client.get("/clientes", headers=auth_a)
        assert all(not c["archivado"] for c in r.json())

    def test_listar_archivados(self, client, auth_a):
        cid = create_cliente(client, auth_a).json()["id"]
        client.delete(f"/clientes/{cid}", headers=auth_a)
        r = client.get("/clientes?archivado=true", headers=auth_a)
        assert len(r.json()) == 1

    def test_404_cliente_inexistente(self, client, auth_a):
        r = client.get("/clientes/id-que-no-existe", headers=auth_a)
        assert r.status_code == 404

    def test_sin_token_retorna_401(self, client):
        r = client.get("/clientes")
        assert r.status_code in (401, 403)


class TestClientesDuplicados:
    """Validación de unicidad de DNI/CUIT por tenant."""

    def test_no_permite_dni_duplicado(self, client, auth_a):
        client.post("/clientes", json={"nombre": "García", "tipo": "fisica", "dni": "12345678"}, headers=auth_a)
        r = client.post("/clientes", json={"nombre": "García Bis", "tipo": "fisica", "dni": "12345678"}, headers=auth_a)
        assert r.status_code == 422
        assert "DNI" in r.json()["detail"]

    def test_no_permite_cuit_duplicado(self, client, auth_a):
        client.post("/clientes", json={"nombre": "Empresa A", "tipo": "juridica", "cuit": "30-12345678-9"}, headers=auth_a)
        r = client.post("/clientes", json={"nombre": "Empresa B", "tipo": "juridica", "cuit": "30-12345678-9"}, headers=auth_a)
        assert r.status_code == 422
        assert "CUIT" in r.json()["detail"]

    def test_permite_mismo_dni_en_otro_tenant(self, client, auth_a, auth_b):
        client.post("/clientes", json={"nombre": "García A", "tipo": "fisica", "dni": "99999999"}, headers=auth_a)
        r = client.post("/clientes", json={"nombre": "García B", "tipo": "fisica", "dni": "99999999"}, headers=auth_b)
        assert r.status_code == 201

    def test_permite_mismo_dni_si_otro_archivado(self, client, auth_a):
        r1 = client.post("/clientes", json={"nombre": "García", "tipo": "fisica", "dni": "77777777"}, headers=auth_a)
        cid = r1.json()["id"]
        client.delete(f"/clientes/{cid}", headers=auth_a)  # archivar
        r2 = client.post("/clientes", json={"nombre": "García Nuevo", "tipo": "fisica", "dni": "77777777"}, headers=auth_a)
        assert r2.status_code == 201

    def test_no_permite_editar_con_dni_de_otro(self, client, auth_a):
        client.post("/clientes", json={"nombre": "García", "tipo": "fisica", "dni": "11111111"}, headers=auth_a)
        r2 = client.post("/clientes", json={"nombre": "López", "tipo": "fisica", "dni": "22222222"}, headers=auth_a)
        cid2 = r2.json()["id"]
        r = client.patch(f"/clientes/{cid2}", json={"dni": "11111111"}, headers=auth_a)
        assert r.status_code == 422


class TestClienteEliminarPermanente:
    """DELETE /clientes/{id}/eliminar — eliminación real con desvinculación."""

    def test_eliminar_cliente_sin_expedientes(self, client, auth_a):
        cid = create_cliente(client, auth_a, "A Eliminar").json()["id"]
        r = client.delete(f"/clientes/{cid}/eliminar", headers=auth_a)
        assert r.status_code == 204
        # ya no existe
        r2 = client.get(f"/clientes/{cid}", headers=auth_a)
        assert r2.status_code == 404

    def test_eliminar_cliente_de_otro_tenant_404(self, client, auth_a, auth_b):
        cid = create_cliente(client, auth_a).json()["id"]
        r = client.delete(f"/clientes/{cid}/eliminar", headers=auth_b)
        assert r.status_code == 404

    def test_eliminar_inexistente_404(self, client, auth_a):
        r = client.delete("/clientes/id-falso/eliminar", headers=auth_a)
        assert r.status_code == 404


class TestClientesAislamientoTenant:
    """Invariante crítico: tenant A nunca ve datos de tenant B."""

    def test_no_ve_clientes_de_otro_tenant(self, client, auth_a, auth_b):
        create_cliente(client, auth_a, "Cliente de A")
        r = client.get("/clientes", headers=auth_b)
        assert r.json() == []

    def test_no_puede_obtener_cliente_de_otro_tenant(self, client, auth_a, auth_b):
        cid = create_cliente(client, auth_a).json()["id"]
        r = client.get(f"/clientes/{cid}", headers=auth_b)
        assert r.status_code == 404

    def test_no_puede_modificar_cliente_de_otro_tenant(self, client, auth_a, auth_b):
        cid = create_cliente(client, auth_a).json()["id"]
        r = client.patch(f"/clientes/{cid}", json={"nombre": "Hack"}, headers=auth_b)
        assert r.status_code == 404

    def test_no_puede_archivar_cliente_de_otro_tenant(self, client, auth_a, auth_b):
        cid = create_cliente(client, auth_a).json()["id"]
        r = client.delete(f"/clientes/{cid}", headers=auth_b)
        assert r.status_code == 404
