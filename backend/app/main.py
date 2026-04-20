import re
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.core.config import settings
from app.routers import auth, clientes, expedientes, vencimientos, invitaciones, honorarios, search, ical, documentos, users, gastos, ingresos, tareas, dev_seed, resumenes, studios, whatsapp, soporte
from app.routers.google_calendar import router as google_calendar_router, sync_router as calendar_sync_router

_ALLOWED_ORIGINS = re.compile(
    r"^(http://localhost:(3000|3001)|https://[a-z0-9\-]+\.vercel\.app)$"
)

app = FastAPI(
    title="LexCore API",
    version="0.4.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
)


def _cors_headers(origin: str) -> dict:
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
        "Access-Control-Max-Age": "600",
    }


@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    origin = request.headers.get("origin", "")
    allowed = bool(origin and _ALLOWED_ORIGINS.match(origin))

    if request.method == "OPTIONS":
        headers = _cors_headers(origin) if allowed else {}
        return Response(status_code=204, headers=headers)

    response = await call_next(request)
    if allowed:
        for k, v in _cors_headers(origin).items():
            response.headers[k] = v
    return response

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
