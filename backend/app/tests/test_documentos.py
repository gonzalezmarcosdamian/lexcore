"""
Tests para el módulo de documentos.
Storage (upload_file, generate_download_url, delete_object) se mockea — los tests
validan lógica de negocio y aislamiento tenant, no la integración con el storage real.
"""
import io
import uuid
from unittest.mock import patch, MagicMock

import pytest

from app.models.expediente import Expediente, EstadoExpediente
from app.models.documento import Documento
from app.tests.conftest import make_studio, make_user
from app.models.user import UserRole


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_expediente(db, tenant_id: str) -> Expediente:
    exp = Expediente(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        numero=f"TEST-{uuid.uuid4().hex[:6]}",
        caratula="Test c/ Test s/ Test",
        estado=EstadoExpediente.activo,
    )
    db.add(exp)
    db.commit()
    return exp


FAKE_FILE_KEY = "tenant-abc/exp-xyz/some-uuid.pdf"
FAKE_DOWNLOAD_URL = "https://storage.example.com/download?sig=fake"


@pytest.fixture(autouse=True)
def mock_storage():
    """Mockea todas las funciones de storage para evitar llamadas reales."""
    with patch("app.routers.documentos.upload_file", return_value=("https://fake-url.com", FAKE_FILE_KEY)) as mock_upload, \
         patch("app.routers.documentos.generate_download_url", return_value=FAKE_DOWNLOAD_URL), \
         patch("app.routers.documentos.delete_object") as mock_del:
        yield {"upload": mock_upload, "delete": mock_del}


@pytest.fixture
def tenant_a(db):
    studio = make_studio(db, slug="docs-studio-a")
    user, token = make_user(db, studio, role=UserRole.admin)
    db.commit()
    return {"studio_id": studio.id, "user_id": user.id, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture
def tenant_b(db):
    studio = make_studio(db, slug="docs-studio-b")
    user, token = make_user(db, studio, role=UserRole.admin)
    db.commit()
    return {"studio_id": studio.id, "user_id": user.id, "headers": {"Authorization": f"Bearer {token}"}}


def _upload(client, tenant: dict, exp_id: str, nombre: str = "escrito.pdf") -> dict:
    """Helper: sube un documento via multipart form."""
    r = client.post(
        "/documentos/upload",
        data={"expediente_id": exp_id, "descripcion": ""},
        files={"file": (nombre, io.BytesIO(b"fake pdf content"), "application/pdf")},
        headers=tenant["headers"],
    )
    assert r.status_code == 201, r.text
    return r.json()


# ── Upload ────────────────────────────────────────────────────────────────────

class TestUpload:
    def test_upload_documento(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        doc = _upload(client, tenant_a, exp.id)
        assert doc["nombre"] == "escrito.pdf"
        assert doc["content_type"] == "application/pdf"
        assert doc["uploaded_by"] == tenant_a["user_id"]
        assert doc["file_key"] == FAKE_FILE_KEY

    def test_upload_sin_auth_401(self, client, db, tenant_a):
        exp = make_expediente(db, tenant_a["studio_id"])
        r = client.post(
            "/documentos/upload",
            data={"expediente_id": exp.id},
            files={"file": ("doc.pdf", io.BytesIO(b"x"), "application/pdf")},
        )
        assert r.status_code in (401, 403)

    def test_upload_expediente_otro_tenant_404(self, client, tenant_a, tenant_b, db):
        exp_b = make_expediente(db, tenant_b["studio_id"])
        r = client.post(
            "/documentos/upload",
            data={"expediente_id": exp_b.id},
            files={"file": ("doc.pdf", io.BytesIO(b"x"), "application/pdf")},
            headers=tenant_a["headers"],
        )
        assert r.status_code == 404

    def test_upload_sin_contexto_400(self, client, tenant_a):
        r = client.post(
            "/documentos/upload",
            data={},
            files={"file": ("doc.pdf", io.BytesIO(b"x"), "application/pdf")},
            headers=tenant_a["headers"],
        )
        assert r.status_code == 400


# ── CRUD Documentos ───────────────────────────────────────────────────────────

class TestDocumentosCRUD:
    def test_listar_documentos(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        _upload(client, tenant_a, exp.id, "doc1.pdf")
        _upload(client, tenant_a, exp.id, "doc2.pdf")
        r = client.get(f"/documentos?expediente_id={exp.id}", headers=tenant_a["headers"])
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_listar_vacio(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        r = client.get(f"/documentos?expediente_id={exp.id}", headers=tenant_a["headers"])
        assert r.status_code == 200
        assert r.json() == []

    def test_listar_sin_filtro_400(self, client, tenant_a):
        r = client.get("/documentos", headers=tenant_a["headers"])
        assert r.status_code == 400

    def test_download_url(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        doc = _upload(client, tenant_a, exp.id)
        r = client.get(f"/documentos/{doc['id']}/download-url", headers=tenant_a["headers"])
        assert r.status_code == 200
        assert r.json()["download_url"] == FAKE_DOWNLOAD_URL

    def test_eliminar_documento(self, client, tenant_a, db, mock_storage):
        exp = make_expediente(db, tenant_a["studio_id"])
        doc = _upload(client, tenant_a, exp.id)
        r = client.delete(f"/documentos/{doc['id']}", headers=tenant_a["headers"])
        assert r.status_code == 204
        mock_storage["delete"].assert_called_once_with(FAKE_FILE_KEY)

    def test_eliminar_luego_no_aparece_en_lista(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        doc = _upload(client, tenant_a, exp.id)
        client.delete(f"/documentos/{doc['id']}", headers=tenant_a["headers"])
        r = client.get(f"/documentos?expediente_id={exp.id}", headers=tenant_a["headers"])
        assert r.json() == []

    def test_download_url_no_existente_404(self, client, tenant_a):
        r = client.get(f"/documentos/{uuid.uuid4()}/download-url", headers=tenant_a["headers"])
        assert r.status_code == 404

    def test_patch_label(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        doc = _upload(client, tenant_a, exp.id)
        r = client.patch(f"/documentos/{doc['id']}", json={"label": "Demanda inicial"}, headers=tenant_a["headers"])
        assert r.status_code == 200
        assert r.json()["label"] == "Demanda inicial"


# ── Aislamiento tenant ────────────────────────────────────────────────────────

class TestDocumentosAislamientoTenant:
    def _doc_en_db(self, db, tenant: dict, exp_id: str) -> Documento:
        doc = Documento(
            id=str(uuid.uuid4()),
            tenant_id=tenant["studio_id"],
            expediente_id=exp_id,
            nombre="secreto.pdf",
            file_key=FAKE_FILE_KEY,
            size_bytes=1000,
            content_type="application/pdf",
            uploaded_by=tenant["user_id"],
        )
        db.add(doc)
        db.commit()
        return doc

    def test_tenant_a_no_ve_docs_de_tenant_b(self, client, tenant_a, tenant_b, db):
        exp_b = make_expediente(db, tenant_b["studio_id"])
        self._doc_en_db(db, tenant_b, exp_b.id)
        r = client.get(f"/documentos?expediente_id={exp_b.id}", headers=tenant_a["headers"])
        assert r.status_code == 404

    def test_tenant_a_no_puede_descargar_doc_de_tenant_b(self, client, tenant_a, tenant_b, db):
        exp_b = make_expediente(db, tenant_b["studio_id"])
        doc = self._doc_en_db(db, tenant_b, exp_b.id)
        r = client.get(f"/documentos/{doc.id}/download-url", headers=tenant_a["headers"])
        assert r.status_code == 404

    def test_tenant_a_no_puede_eliminar_doc_de_tenant_b(self, client, tenant_a, tenant_b, db):
        exp_b = make_expediente(db, tenant_b["studio_id"])
        doc = self._doc_en_db(db, tenant_b, exp_b.id)
        r = client.delete(f"/documentos/{doc.id}", headers=tenant_a["headers"])
        assert r.status_code == 404
