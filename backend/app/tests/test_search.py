"""
Tests BUS-001: Búsqueda global.
"""
import pytest
from app.models.expediente import Expediente, ExpedienteAbogado, RolEnExpediente
from app.models.cliente import Cliente, TipoCliente


def make_data(db, studio, user):
    c1 = Cliente(tenant_id=studio.id, nombre="García Construcciones S.A.", tipo=TipoCliente.juridica, cuit_dni="30-71234567-1")
    c2 = Cliente(tenant_id=studio.id, nombre="López, María Elena", tipo=TipoCliente.fisica, cuit_dni="27-12345678-9")
    db.add_all([c1, c2])
    db.flush()

    e1 = Expediente(tenant_id=studio.id, numero="CIV-2024-001", caratula="García S.A. c/ Banco Nacional s/ Cobro", fuero="Civil")
    e2 = Expediente(tenant_id=studio.id, numero="LAB-2024-002", caratula="López c/ Empresa s/ Despido", fuero="Laboral")
    db.add_all([e1, e2])
    db.flush()

    for exp in [e1, e2]:
        db.add(ExpedienteAbogado(
            tenant_id=studio.id, expediente_id=exp.id,
            user_id=user.id, rol=RolEnExpediente.responsable,
        ))
    db.commit()
    return [c1, c2], [e1, e2]


@pytest.fixture
def datos_a(db, studio_a, admin_a):
    user, _ = admin_a
    return make_data(db, studio_a, user)


class TestBusquedaGlobal:
    def test_busca_expediente_por_numero(self, client, auth_a, datos_a):
        r = client.get("/search?q=CIV-2024", headers=auth_a)
        assert r.status_code == 200
        data = r.json()
        assert len(data["expedientes"]) == 1
        assert data["expedientes"][0]["numero"] == "CIV-2024-001"

    def test_busca_expediente_por_caratula(self, client, auth_a, datos_a):
        r = client.get("/search?q=García", headers=auth_a)
        assert r.status_code == 200
        data = r.json()
        assert any("García" in e["caratula"] for e in data["expedientes"])

    def test_busca_cliente_por_nombre(self, client, auth_a, datos_a):
        r = client.get("/search?q=López", headers=auth_a)
        assert r.status_code == 200
        data = r.json()
        assert any("López" in c["nombre"] for c in data["clientes"])

    def test_busca_cliente_por_cuit(self, client, auth_a, datos_a):
        r = client.get("/search?q=30-71234567", headers=auth_a)
        assert r.status_code == 200
        data = r.json()
        assert len(data["clientes"]) == 1

    def test_busqueda_retorna_ambos_tipos(self, client, auth_a, datos_a):
        r = client.get("/search?q=García", headers=auth_a)
        data = r.json()
        assert "expedientes" in data
        assert "clientes" in data

    def test_sin_resultados(self, client, auth_a, datos_a):
        r = client.get("/search?q=XYZXYZ123", headers=auth_a)
        assert r.status_code == 200
        data = r.json()
        assert data["expedientes"] == []
        assert data["clientes"] == []

    def test_query_muy_corta_rechazada(self, client, auth_a):
        r = client.get("/search?q=ab", headers=auth_a)
        assert r.status_code == 422

    def test_sin_auth_retorna_401(self, client):
        r = client.get("/search?q=García")
        assert r.status_code in (401, 403)

    def test_aislamiento_tenant(self, client, auth_a, auth_b, datos_a):
        r = client.get("/search?q=García", headers=auth_b)
        data = r.json()
        # tenant_b no tiene datos, no debe ver los de tenant_a
        assert data["expedientes"] == []
        assert data["clientes"] == []
