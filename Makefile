# LexCore — comandos de desarrollo y CI
.PHONY: test test-backend test-frontend dev logs build pre-deploy

# ── Dev ───────────────────────────────────────────────────────────────────────

dev:
	docker compose up -d

logs:
	docker compose logs -f backend frontend

logs-backend:
	docker logs lexcore-backend-1 -f

logs-frontend:
	docker logs lexcore-frontend-1 -f

# ── Tests ─────────────────────────────────────────────────────────────────────

test-backend:
	@echo "▶ Tests backend (pytest)..."
	docker compose exec backend pytest --tb=short -q
	@echo "✓ Backend OK"

test-frontend:
	@echo "▶ Type check frontend (tsc)..."
	docker compose exec frontend npx tsc --noEmit
	@echo "✓ Frontend type check OK"

test: test-backend test-frontend
	@echo "✅ Todos los tests pasaron"

# ── Pre-deploy gate ───────────────────────────────────────────────────────────
# Correr SIEMPRE antes de hacer deploy/push a main

pre-deploy: test
	@echo ""
	@echo "🚀 Pre-deploy check completo — OK para deployar"
	@echo "   Backend:  pytest ✓"
	@echo "   Frontend: tsc ✓"

# ── Build ─────────────────────────────────────────────────────────────────────

build:
	docker compose up -d --build

rebuild-backend:
	docker compose up -d --build backend

# ── DB ────────────────────────────────────────────────────────────────────────

migrate:
	docker compose exec backend alembic upgrade head

migration:
	@read -p "Descripción: " desc; \
	docker compose exec backend alembic revision --autogenerate -m "$$desc"

db-shell:
	docker compose exec db psql -U lexcore -d lexcore
