# Instrucciones manuales — MercadoPago + Cron

> Lo que Claude no puede hacer por vos (requiere acceso a dashboards externos).
> Hacelo una sola vez. Después el flujo de pago funciona solo.

---

## Cuentas de prueba disponibles

### Comprador (para simular pagos en sandbox)

| Campo | Valor |
|-------|-------|
| Nombre | Cordoba |
| País | Argentina |
| User ID | 3352115877 |
| Usuario | TESTUSER2377... (ver screenshot) |
| Contraseña | qxoUuy5aEu |
| Código verificación | 115877 |

> Usá esta cuenta para loguearte en el checkout de MP durante las pruebas.
> Tarjeta de prueba: `4509953566233704` / venc. cualquier fecha futura / CVV `123`

### Vendedor — cuenta de prueba "luthor"

| Campo | Valor |
|-------|-------|
| Nombre | luthor |
| User ID | 3433286684 |
| Usuario | TESTUSER8442... |
| Contraseña | MPZgKFTm55 |
| Código verificación | 286684 |

### Credenciales TEST de la app (PENDIENTE)

Para obtenerlas: **MP Developers → Tu app → Credenciales de prueba**

| Variable | Valor |
|----------|-------|
| `MERCADOPAGO_ACCESS_TOKEN` | `TEST-...` ← pendiente |
| `MERCADOPAGO_PUBLIC_KEY` | `TEST-...` ← pendiente |

---

## 1. Variables de entorno en Railway

**Dónde:** railway.com → proyecto `friendly-healing` → servicio **backend** → Variables

Agregar estas 3 variables:

| Variable | Valor | Dónde obtenerlo |
|----------|-------|-----------------|
| `MERCADOPAGO_ACCESS_TOKEN` | `APP_USR-...` | MP Developers → Tu app → Credenciales de producción |
| `MERCADOPAGO_PUBLIC_KEY` | `APP_USR-...` | MP Developers → Tu app → Credenciales de producción |
| `MERCADOPAGO_WEBHOOK_SECRET` | (generalo vos) | Cualquier string largo y random, ej: `openssl rand -hex 32` |
| `ADMIN_API_KEY` | (generalo vos) | Cualquier string largo y random — para el cron de trial warnings |

> ⚠️ Usar credenciales de **producción**, no de sandbox, para cobros reales.

---

## 2. Registrar URL del webhook en MercadoPago

**Dónde:** https://www.mercadopago.com.ar/developers/panel/app → Tu app → Webhooks

1. Clic en **"Agregar"**
2. **URL:** `https://[tu-dominio-railway]/suscripcion/webhook`
   - La URL de Railway es algo como: `https://lexcore-production-xxxx.up.railway.app`
   - Para verla: Railway → servicio backend → Settings → Domains
3. **Eventos a activar:**
   - ✅ `preapproval`
   - ✅ `subscription_authorized_payment`
4. **Guardar** → MP va a enviar un test y tiene que devolver 200

> El webhook valida la firma HMAC con `MERCADOPAGO_WEBHOOK_SECRET`. Si la firma no matchea, loguea warning pero responde 200 igual (para que MP no reintente infinito).

---

## 3. Configurar Railway Cron para emails de trial

**Dónde:** railway.com → proyecto `friendly-healing` → **New Service → Cron**

Configuración del cron:

| Campo | Valor |
|-------|-------|
| **Schedule** | `0 10 * * *` (todos los días a las 10am UTC = 7am ARG) |
| **Command** | `curl -s -X POST https://[tu-dominio-railway]/cron/trial-warnings -H "x-admin-key: [ADMIN_API_KEY]"` |

Reemplazá `[tu-dominio-railway]` y `[ADMIN_API_KEY]` con los valores reales.

> El endpoint devuelve JSON con `{ "enviados": N, "errores": N, "studios_evaluados": N }`.
> Enviará emails a estudios con 1-7 días de trial restantes.

---

## 4. Crear aplicación en MercadoPago (si no existe)

Si no tenés una app MP creada para Luthor:

1. https://www.mercadopago.com.ar/developers/panel/app
2. **Crear aplicación** → nombre: `Luthor`
3. Tipo: `Pagos Online`
4. Copiar **Access Token** y **Public Key** de producción → pegar en Railway (paso 1)

---

## 5. Verificar que todo funciona

Una vez configurado, probá el flujo completo:

```bash
# 1. Verificar que el webhook responde
curl -X POST https://[railway-url]/suscripcion/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"test","data":{"id":"test"}}'
# Debe devolver: {"ok": true, "received": "test"}

# 2. Verificar el cron manualmente
curl -X POST https://[railway-url]/cron/trial-warnings \
  -H "x-admin-key: [ADMIN_API_KEY]"
# Debe devolver: {"ok": true, "enviados": 0, "errores": 0, ...}

# 3. Ver planes disponibles (browser o curl)
curl https://[railway-url]/suscripcion/planes \
  -H "Authorization: Bearer [tu-jwt-token]"
```

---

## 6. Flujo de pago end-to-end (para testar)

1. Login como admin de un estudio en trial
2. Ir a **Perfil → Mi plan**
3. Elegir plan (Starter/Pro/Estudio) y ciclo (Mensual/Anual)
4. Clic en **"Suscribirme"** → redirige a MercadoPago
5. Pagar con tarjeta de prueba: `4509953566233704` / cualquier fecha futura / CVV `123`
6. MP redirige a `/perfil?subs=ok` → aparece el banner verde "¡Suscripción activada!"
7. El webhook llega en segundos → plan cambia a `active` en DB
8. Revisar en `/superadmin` que el estudio cambió de `trial` a `starter/pro/estudio`

---

## Estado actual del código

| Componente | Estado |
|------------|--------|
| `POST /suscripcion/checkout` | ✅ Crea preapproval en MP |
| `POST /suscripcion/webhook` | ✅ Procesa events, valida HMAC |
| `GET /suscripcion/status` | ✅ Estado actual del plan |
| `PATCH /suscripcion/cancel` | ✅ Cancela preapproval |
| Email confirmación post-pago | ✅ Se envía cuando webhook recibe `authorized` |
| Email aviso trial (día 25) | ✅ `POST /cron/trial-warnings` |
| UI Mi plan en `/perfil` | ✅ Estado + botones + historial |
| Variables Railway | ❌ **Pendiente manual (paso 1)** |
| Webhook URL en MP | ❌ **Pendiente manual (paso 2)** |
| Railway Cron configurado | ❌ **Pendiente manual (paso 3)** |
