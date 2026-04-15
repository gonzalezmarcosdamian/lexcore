"""
Tests TDD para el módulo de documentos (DOC-001).
R2/boto3 se mockea — los tests validan la lógica de negocio y el aislamiento tenant,
no la integración con el storage real.
"""
import uuid
from unittest.mock import patch

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


FAKE_UPLOAD_URL = "https://r2.example.com/upload?sig=fake"
FAKE_DOWNLOAD_URL = "https://r2.example.com/download?sig=fake"
FAKE_FILE_KEY = "tenant-abc/exp-xyz/some-uuid.pdf"


@pytest.fixture(autouse=True)
def mock_storage():
    """Mockea todas las funciones de storage para evitar llamadas reales a R2."""
    with patch("app.routers.documentos.generate_upload_url", return_value=(FAKE_UPLOAD_URL, FAKE_FILE_KEY)), \
         patch("app.routers.documentos.generate_download_url", return_value=FAKE_DOWNLOAD_URL), \
         patch("app.routers.documentos.delete_object") as mock_del:
        yield mock_del


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


# ── Upload URL ────────────────────────────────────────────────────────────────

class TestUploadUrl:
    def test_genera_upload_url(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        r = client.post("/documentos/upload-url", json={
            "expediente_id": exp.id,
            "nombre": "demanda.pdf",
            "content_type": "application/pdf",
            "size_bytes": 1024 * 100,
        }, headers=tenant_a["headers"])
        assert r.status_code == 200
        data = r.json()
        assert data["upload_url"] == FAKE_UPLOAD_URL
        assert data["file_key"] == FAKE_FILE_KEY

    def test_upload_url_expediente_otro_tenant_404(self, client, tenant_a, tenant_b, db):
        exp_b = make_expediente(db, tenant_b["studio_id"])
        r = client.post("/documentos/upload-url", json={
            "expediente_id": exp_b.id,
            "nombre": "doc.pdf",
            "content_type": "application/pdf",
            "size_bytes": 1024,
        }, headers=tenant_a["headers"])
        assert r.status_code == 404

    def test_upload_url_sin_auth_401(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        r = client.post("/documentos/upload-url", json={
            "expediente_id": exp.id,
            "nombre": "doc.pdf",
            "content_type": "application/pdf",
            "size_bytes": 1024,
        })
        assert r.status_code in (401, 403)

    def test_upload_url_archivo_muy_grande_422(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        r = client.post("/documentos/upload-url", json={
            "expediente_id": exp.id,
            "nombre": "grande.pdf",
            "content_type": "application/pdf",
            "size_bytes": 100 * 1024 * 1024,  # 100MB > límite 50MB
        }, headers=tenant_a["headers"])
        assert r.status_code == 422


# ── CRUD Documentos ───────────────────────────────────────────────────────────

class TestDocumentosCRUD:
    def _crear(self, client, tenant: dict, exp_id: str, nombre: str = "escrito.pdf") -> dict:
        r = client.post("/documentos", json={
            "expediente_id": exp_id,
            "nombre": nombre,
            "file_key": FAKE_FILE_KEY,
            "size_bytes": 50_000,
            "content_type": "application/pdf",
        }, headers=tenant["headers"])
        assert r.status_code == 201
        return r.json()

    def test_crear_documento(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        doc = self._crear(client, tenant_a, exp.id)
        assert doc["nombre"] == "escrito.pdf"
        assert doc["size_bytes"] == 50_000
        assert doc["content_type"] == "application/pdf"
        assert doc["uploaded_by"] == tenant_a["user_id"]

    def test_listar_documentos(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        self._crear(client, tenant_a, exp.id, "doc1.pdf")
        self._crear(client, tenant_a, exp.id, "doc2.docx")
        r = client.get(f"/documentos?expediente_id={exp.id}", headers=tenant_a["headers"])
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_listar_vacio(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        r = client.get(f"/documentos?expediente_id={exp.id}", headers=tenant_a["headers"])
        assert r.status_code == 200
        assert r.json() == []

    def test_download_url(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        doc = self._crear(client, tenant_a, exp.id)
        r = client.get(f"/documentos/{doc['id']}/download-url", headers=tenant_a["headers"])
        assert r.status_code == 200
        assert r.json()["download_url"] == FAKE_DOWNLOAD_URL

    def test_eliminar_documento(self, client, tenant_a, db, mock_storage):
        exp = make_expediente(db, tenant_a["studio_id"])
        doc = self._crear(client, tenant_a, exp.id)
        r = client.delete(f"/documentos/{doc['id']}", headers=tenant_a["headers"])
        assert r.status_code == 204
        mock_storage.assert_called_once_with(FAKE_FILE_KEY)

    def test_eliminar_luego_no_aparece_en_lista(self, client, tenant_a, db):
        exp = make_expediente(db, tenant_a["studio_id"])
        doc = self._crear(client, tenant_a, exp.id)
        client.delete(f"/documentos/{doc['id']}", headers=tenant_a["headers"])
        r = client.get(f"/documentos?expediente_id={exp.id}", headers=tenant_a["headers"])
        assert r.json() == []

    def test_download_url_no_existente_404(self, client, tenant_a):
        r = client.get(f"/documentos/{uuid.uuid4()}/download-url", headers=tenant_a["headers"])
        assert r.status_code == 404


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
        # Tenant A intenta listar con expediente de B → 404 (no pasa la validación del expediente)
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
