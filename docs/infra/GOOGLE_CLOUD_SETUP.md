# Google Cloud — Setup LexCore

> Runbook completo de lo que se hizo y cómo reproducirlo desde cero.
> Fecha: 2026-04-15
> Cuenta: ingonzalezdamian@gmail.com

---

## Estado actual

| Recurso | Estado |
|---------|--------|
| Proyecto `lexcore-app` | ✓ Creado |
| Google Calendar API | ✓ Habilitada |
| People API | ✓ Habilitada |
| OAuth Consent Screen | ✓ Configurado |
| OAuth 2.0 Client ID | ✓ Creado (Cliente web Lexcore) |

---

## Lo que se hizo por CLI

### 1. Instalar gcloud CLI
```powershell
winget install Google.CloudSDK
# Después de instalar, agregar al PATH de la sesión:
$env:PATH += ";$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin"
```

### 2. Login con cuenta Google
```powershell
gcloud auth login
# Abre browser → logearse con ingonzalezdamian@gmail.com → autorizar
```

### 3. Crear proyecto
```powershell
gcloud projects create lexcore-app --name="LexCore"
gcloud config set project lexcore-app
```

### 4. Habilitar APIs necesarias
```powershell
gcloud services enable calendar-json.googleapis.com people.googleapis.com --project=lexcore-app
```

---

## Pasos pendientes — requieren browser (5 min)

### Paso A — OAuth Consent Screen

1. Ir a: https://console.cloud.google.com/apis/credentials/consent?project=lexcore-app
2. Seleccionar **External** → **Create**
3. Completar:
   - App name: `LexCore`
   - User support email: `ingonzalezdamian@gmail.com`
   - Developer contact: `ingonzalezdamian@gmail.com`
4. En **Scopes**: agregar
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
5. En **Test users**: agregar `ingonzalezdamian@gmail.com`
6. **Save and Continue** hasta terminar

### Paso B — Crear OAuth 2.0 Client ID

1. Ir a: https://console.cloud.google.com/apis/credentials?project=lexcore-app
2. **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `LexCore Web`
5. Authorized JavaScript origins:
   ```
   http://localhost:3001
   ```
6. Authorized redirect URIs:
   ```
   http://localhost:3001/api/auth/callback/google
   ```
7. **Create** → te muestra Client ID y Client Secret
8. Copiarlos al `.env` del proyecto (ver abajo)

### Paso C — Actualizar .env

```env
# Agregar en lexcore/.env
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
NEXTAUTH_SECRET=<correr: openssl rand -hex 32>
NEXTAUTH_URL=http://localhost:3001
```

---

## Para producción (cuando se deploya)

Repetir Paso B agregando las URLs de prod:
- Authorized JavaScript origins: `https://lexcore.vercel.app`
- Authorized redirect URIs: `https://lexcore.vercel.app/api/auth/callback/google`

Y actualizar las variables de entorno en Vercel + Railway.

---

## Comandos útiles de mantenimiento

```powershell
# Ver APIs habilitadas
gcloud services list --project=lexcore-app --enabled

# Ver credenciales creadas
gcloud alpha iap oauth-clients list projects/lexcore-app/brands/...

# Listar proyectos
gcloud projects list
```
