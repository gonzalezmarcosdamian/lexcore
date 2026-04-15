"""
Fixtures globales de testing para LexCore.
Usa SQLite in-memory — los modelos usan sa.Enum que SQLite renderiza como VARCHAR.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.auth import create_access_token, hash_password as get_password_hash
from app.core.database import Base
from app.core.deps import get_db
from app.main import app as fastapi_app
from app.models.studio import Studio
from app.models.user import User, UserRole, AuthProvider
# Import all models so Base.metadata picks them up for create_all
from app.models import cliente as _m_cliente  # noqa: F401
from app.models import expediente as _m_expediente  # noqa: F401
from app.models import invitacion as _m_invitacion  # noqa: F401
from app.models import honorario as _m_honorario  # noqa: F401
from app.models import documento as _m_documento  # noqa: F401
from app.models import gasto as _m_gasto  # noqa: F401

SQLITE_URL = "sqlite:///file:testdb?mode=memory&cache=shared&uri=true"

engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    yield TestClient(fastapi_app)
    fastapi_app.dependency_overrides.clear()


# ── Factories ─────────────────────────────────────────────────────────────────

def make_studio(db, *, slug: str = None) -> Studio:
    slug = slug or f"estudio-{uuid.uuid4().hex[:6]}"
    studio = Studio(id=str(uuid.uuid4()), name=f"Estudio {slug}", slug=slug)
    db.add(studio)
    db.flush()
    return studio


def make_user(db, studio: Studio, *, role: UserRole = UserRole.admin, email: str = None):
    """Crea un user y devuelve (user, jwt_token)."""
    email = email or f"user-{uuid.uuid4().hex[:6]}@test.com"
    user = User(
        id=str(uuid.uuid4()),
        tenant_id=studio.id,
        email=email,
        full_name="Test User",
        hashed_password=get_password_hash("testpass123"),
        role=role,
        auth_provider=AuthProvider.email,
    )
    db.add(user)
    db.flush()
    token = create_access_token(
        studio_id=studio.id, user_id=user.id, role=role.value
    )
    return user, token


# ── Fixtures compuestas ───────────────────────────────────────────────────────

@pytest.fixture
def studio_a(db):
    return make_studio(db, slug="studio-a")


@pytest.fixture
def studio_b(db):
    return make_studio(db, slug="studio-b")


@pytest.fixture
def admin_a(db, studio_a):
    user, token = make_user(db, studio_a, role=UserRole.admin)
    db.commit()
    return user, token


@pytest.fixture
def admin_b(db, studio_b):
    user, token = make_user(db, studio_b, role=UserRole.admin)
    db.commit()
    return user, token


@pytest.fixture
def auth_a(admin_a):
    _, token = admin_a
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_b(admin_b):
    _, token = admin_b
    return {"Authorization": f"Bearer {token}"}
