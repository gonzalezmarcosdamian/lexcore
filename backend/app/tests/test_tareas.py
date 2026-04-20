"""Tests para /tareas — CRUD + estados + aislamiento tenant."""
from datetime import date, timedelta


def hoy_plus(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def create_expediente(client, headers):
    r = client.post("/expedientes", json={"caratula": "Test c/ Test"}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def create_tarea(client, headers, eid, *, titulo="Redactar escrito", estado="pendiente"):
    return client.post("/tareas", json={
        "titulo": titulo,
        "expediente_id": eid,
        "estado": estado,
    }, headers=headers)


class TestTareasCRUD:
    def test_crear_tarea(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        r = create_tarea(client, auth_a, eid)
        assert r.status_code == 201
        data = r.json()
        assert data["titulo"] == "Redactar escrito"
        assert data["estado"] == "pendiente"
        assert data["expediente_id"] == eid

    def test_crear_tarea_estado_default_pendiente(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        r = client.post("/tareas", json={"titulo": "Sin estado", "expediente_id": eid}, headers=auth_a)
        assert r.status_code == 201
        assert r.json()["estado"] == "pendiente"

    def test_listar_tareas_del_expediente(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        create_tarea(client, auth_a, eid, titulo="T1")
        create_tarea(client, auth_a, eid, titulo="T2")
        r = client.get(f"/tareas?expediente_id={eid}", headers=auth_a)
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_filtrar_por_estado(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        create_tarea(client, auth_a, eid, titulo="Pendiente", estado="pendiente")
        create_tarea(client, auth_a, eid, titulo="Hecha", estado="hecha")
        r = client.get("/tareas?estado=pendiente", headers=auth_a)
        assert all(t["estado"] == "pendiente" for t in r.json())

    def test_actualizar_estado(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        tid = create_tarea(client, auth_a, eid).json()["id"]
        r = client.patch(f"/tareas/{tid}", json={"estado": "en_curso"}, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["estado"] == "en_curso"

    def test_ciclo_completo_estados(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        tid = create_tarea(client, auth_a, eid).json()["id"]
        # pendiente → en_curso
        r = client.patch(f"/tareas/{tid}", json={"estado": "en_curso"}, headers=auth_a)
        assert r.json()["estado"] == "en_curso"
        # en_curso → hecha
        r = client.patch(f"/tareas/{tid}", json={"estado": "hecha"}, headers=auth_a)
        assert r.json()["estado"] == "hecha"
        # hecha → pendiente (reversible)
        r = client.patch(f"/tareas/{tid}", json={"estado": "pendiente"}, headers=auth_a)
        assert r.json()["estado"] == "pendiente"

    def test_actualizar_titulo_y_fecha(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        tid = create_tarea(client, auth_a, eid).json()["id"]
        fecha = hoy_plus(7)
        r = client.patch(f"/tareas/{tid}", json={"titulo": "Nuevo título", "fecha_limite": fecha}, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["titulo"] == "Nuevo título"
        assert r.json()["fecha_limite"] == fecha

    def test_eliminar_tarea(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        tid = create_tarea(client, auth_a, eid).json()["id"]
        r = client.delete(f"/tareas/{tid}", headers=auth_a)
        assert r.status_code == 204
        r = client.get(f"/tareas?expediente_id={eid}", headers=auth_a)
        assert r.json() == []

    def test_404_tarea_inexistente(self, client, auth_a):
        r = client.patch("/tareas/no-existe", json={"estado": "hecha"}, headers=auth_a)
        assert r.status_code == 404

    def test_tarea_expediente_inexistente(self, client, auth_a):
        r = client.post("/tareas", json={
            "titulo": "Tarea huérfana",
            "expediente_id": "no-existe",
        }, headers=auth_a)
        assert r.status_code == 404

    def test_ordenamiento_fecha_limite_primero(self, client, auth_a):
        eid = create_expediente(client, auth_a)
        client.post("/tareas", json={"titulo": "Sin fecha", "expediente_id": eid}, headers=auth_a)
        client.post("/tareas", json={"titulo": "Próxima", "expediente_id": eid, "fecha_limite": hoy_plus(3)}, headers=auth_a)
        client.post("/tareas", json={"titulo": "Lejana", "expediente_id": eid, "fecha_limite": hoy_plus(30)}, headers=auth_a)
        r = client.get(f"/tareas?expediente_id={eid}", headers=auth_a)
        titulos = [t["titulo"] for t in r.json()]
        # Las que tienen fecha van primero, sin fecha al final
        assert titulos.index("Próxima") < titulos.index("Lejana")
        assert titulos.index("Lejana") < titulos.index("Sin fecha")


class TestTareasAislamientoTenant:
    def test_no_ve_tareas_de_otro_tenant(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a)
        create_tarea(client, auth_a, eid)
        r = client.get("/tareas", headers=auth_b)
        assert r.json() == []

    def test_no_puede_leer_tarea_ajena(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a)
        tid = create_tarea(client, auth_a, eid).json()["id"]
        r = client.patch(f"/tareas/{tid}", json={"estado": "hecha"}, headers=auth_b)
        assert r.status_code == 404

    def test_no_puede_modificar_tarea_ajena(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a)
        tid = create_tarea(client, auth_a, eid).json()["id"]
        r = client.patch(f"/tareas/{tid}", json={"titulo": "Hackeado"}, headers=auth_b)
        assert r.status_code == 404

    def test_no_puede_eliminar_tarea_ajena(self, client, auth_a, auth_b):
        eid = create_expediente(client, auth_a)
        tid = create_tarea(client, auth_a, eid).json()["id"]
        r = client.delete(f"/tareas/{tid}", headers=auth_b)
        assert r.status_code == 404

    def test_filtrar_por_expediente_no_filtra_entre_tenants(self, client, auth_a, auth_b):
        eid_a = create_expediente(client, auth_a)
        create_tarea(client, auth_a, eid_a, titulo="Tarea A")
        # Tenant B intenta filtrar por expediente de A
        r = client.get(f"/tareas?expediente_id={eid_a}", headers=auth_b)
        assert r.json() == []
