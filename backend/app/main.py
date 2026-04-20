from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, clientes, expedientes, vencimientos, invitaciones, honorarios, search, ical, documentos, users, gastos, ingresos, tareas, dev_seed, resumenes, studios, whatsapp, soporte
from app.routers.google_calendar import router as google_calendar_router, sync_router as calendar_sync_router

app = FastAPI(
    title="LexCore API",
    version="0.4.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(clientes.router)
app.include_router(expedientes.router)
app.include_router(vencimientos.router)
app.include_router(invitaciones.router)
app.include_router(honorarios.router)
app.include_router(search.router)
app.include_router(ical.router)
app.include_router(documentos.router)
app.include_router(users.router)
app.include_router(gastos.router)
app.include_router(ingresos.router)
app.include_router(tareas.router)
if settings.ALLOW_DEV_ENDPOINTS or settings.ENVIRONMENT == "development":
    app.include_router(dev_seed.router)
app.include_router(resumenes.router)
app.include_router(studios.router)
app.include_router(google_calendar_router)
app.include_router(calendar_sync_router)
app.include_router(whatsapp.router)
app.include_router(soporte.router)


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.ENVIRONMENT, "version": "0.4.0"}
