"""Tests para /tareas — CRUD básico + aislamiento tenant."""
from app.tests.conftest import make_studio, make_user
from app.models.user import UserRole


def create_expediente(client, headers):
    return client.post("/expedientes", json={"caratula": "Caso Test"}, headers=headers).json()["id"]


def create_tarea(client, headers, expediente_id, *, titulo="Tarea test"):
    return client.post("/tareas", json={
        "titulo": titulo,
        "expediente_id": expediente_id,
        "estado": "pendiente",
    }, headers=headers)


class TestTareasCRUD:
    def test_crear_tarea(self, client, auth_a, admin_a):
        eid = create_expediente(client, auth_a)
        r = create_tarea(client, auth_a, eid)
        assert r.status_code == 201
        data = r.json()
        assert data["titulo"] == "Tarea test"
        assert data["estado"] == "pendiente"

    def test_listar_tareas(self, client, auth_a, admin_a):
        eid = create_expediente(client, auth_a)
        create_tarea(client, auth_a, eid, titulo="T1")
        create_tarea(client, auth_a, eid, titulo="T2")
        r = client.get("/tareas", headers=auth_a)
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_actualizar_estado(self, client, auth_a, admin_a):
        eid = create_expediente(client, auth_a)
        tid = create_tarea(client, auth_a, eid).json()["id"]
        r = client.patch(f"/tareas/{tid}", json={"estado": "hecha"}, headers=auth_a)
        assert r.status_code == 200
        assert r.json()["estado"] == "hecha"

    def test_eliminar_tarea(self, client, auth_a, admin_a):
        eid = create_expediente(client, auth_a)
        tid = create_tarea(client, auth_a, eid).json()["id"]
        r = client.delete(f"/tareas/{tid}", headers=auth_a)
        assert r.status_code == 204
        r2 = client.get("/tareas", headers=auth_a)
        assert len(r2.json()) == 0

    def test_filtrar_por_expediente(self, client, auth_a, admin_a):
        eid1 = create_expediente(client, auth_a)
        eid2 = create_expediente(client, auth_a)
        create_tarea(client, auth_a, eid1, titulo="De exp1")
        create_tarea(client, auth_a, eid2, titulo="De exp2")
        r = client.get(f"/tareas?expediente_id={eid1}", headers=auth_a)
        assert len(r.json()) == 1
        assert r.json()[0]["titulo"] == "De exp1"


class TestTareasAislamientoTenant:
    def test_studio_b_no_ve_tareas_de_studio_a(self, client, db, auth_a, auth_b, admin_a, admin_b):
        """Studio B no puede listar tareas de Studio A."""
        eid = create_expediente(client, auth_a)
        create_tarea(client, auth_a, eid, titulo="Tarea de A")

        r = client.get("/tareas", headers=auth_b)
        assert r.status_code == 200
        assert len(r.json()) == 0

    def test_studio_b_no_puede_editar_tarea_de_studio_a(self, client, db, auth_a, auth_b, admin_a, admin_b):
        """Studio B recibe 404 al intentar editar una tarea de Studio A."""
        eid = create_expediente(client, auth_a)
        tid = create_tarea(client, auth_a, eid).json()["id"]

        r = client.patch(f"/tareas/{tid}", json={"estado": "hecha"}, headers=auth_b)
        assert r.status_code == 404

    def test_studio_b_no_puede_eliminar_tarea_de_studio_a(self, client, db, auth_a, auth_b, admin_a, admin_b):
        """Studio B recibe 404 al intentar eliminar una tarea de Studio A."""
        eid = create_expediente(client, auth_a)
        tid = create_tarea(client, auth_a, eid).json()["id"]

        r = client.delete(f"/tareas/{tid}", headers=auth_b)
        assert r.status_code == 404
