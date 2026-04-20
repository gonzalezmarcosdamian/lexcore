"""
Servicio de email via Resend.
Si RESEND_API_KEY no está configurada, falla silenciosamente con log.
"""
import logging
from typing import Optional, List

logger = logging.getLogger(__name__)


def send_vencimiento_urgente_email(
    *,
    to_emails: List[str],
    descripcion: str,
    fecha: str,
    tipo: str,
    caratula: str,
    expediente_id: str,
    frontend_url: str = "http://localhost:3001",
) -> bool:
    """
    Envía alerta de vencimiento urgente (<48hs) a los miembros del estudio.
    Retorna True si fue enviado, False si falló (no lanza excepción).
    """
    from app.core.config import settings

    api_key = getattr(settings, "RESEND_API_KEY", None)
    if not api_key:
        logger.warning("RESEND_API_KEY no configurada — email urgente omitido")
        return False
    if not to_emails:
        return False

    try:
        import resend
        resend.api_key = api_key

        url = f"{frontend_url}/expedientes/{expediente_id}"

        html = f"""
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0f1c2e; background: #f4f7fa;">
  <div style="background: white; border-radius: 16px; border: 1px solid #e8eef4; overflow: hidden;">
    <div style="background: #dc2626; padding: 20px 32px; display: flex; align-items: center; gap: 12px;">
      <span style="color: white; font-size: 20px;">⚠️</span>
      <span style="color: white; font-size: 18px; font-weight: 700; letter-spacing: -0.3px;">Vencimiento urgente — LexCore</span>
    </div>
    <div style="padding: 32px;">
      <p style="margin: 0 0 6px; color: #6b8aaa; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Expediente</p>
      <p style="margin: 0 0 24px; font-size: 16px; font-weight: 700; color: #0f1c2e;">{caratula}</p>

      <p style="margin: 0 0 6px; color: #6b8aaa; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Vencimiento</p>
      <p style="margin: 0 0 6px; font-size: 20px; font-weight: 700; color: #dc2626;">{descripcion}</p>
      <p style="margin: 0 0 24px; font-size: 14px; color: #3a5272;">
        <strong>Fecha:</strong> {fecha} &nbsp;·&nbsp; <strong>Tipo:</strong> {tipo or "Vencimiento"}
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="{url}" style="display: inline-block; background: #dc2626; color: white; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 12px;">
          Ver expediente →
        </a>
      </div>
      <p style="margin: 0; color: #6b8aaa; font-size: 13px; text-align: center;">
        Este vencimiento vence en menos de 48 horas. Marcalo como cumplido en LexCore una vez que hayas actuado.
      </p>
    </div>
    <div style="padding: 20px 32px; border-top: 1px solid #e8eef4; background: #f4f7fa;">
      <p style="margin: 0; color: #6b8aaa; font-size: 12px; text-align: center;">
        LexCore · Gestión para estudios jurídicos · Argentina
      </p>
    </div>
  </div>
</body>
</html>
"""

        resend.Emails.send({
            "from": "LexCore <noreply@lexcore.app>",
            "to": to_emails,
            "subject": f"⚠️ Vencimiento urgente: {descripcion}",
            "html": html,
        })
        logger.info(f"Email urgente enviado a {to_emails} para vencimiento '{descripcion}'")
        return True

    except Exception as e:
        logger.error(f"Error enviando email urgente: {e}")
        return False


def send_invitation_email(
    *,
    to_email: str,
    to_name: str,
    studio_name: str,
    inviter_name: str,
    rol: str,
    accept_url: str,
) -> bool:
    """
    Envía email de invitación al estudio.
    Retorna True si el email fue enviado, False si falló (no lanza excepción).
    """
    from app.core.config import settings

    api_key = getattr(settings, "RESEND_API_KEY", None)
    if not api_key:
        logger.warning("RESEND_API_KEY no configurada — email de invitación omitido")
        return False

    try:
        import resend
        resend.api_key = api_key

        rol_display = {
            "socio": "Socio/a",
            "asociado": "Asociado/a",
            "pasante": "Pasante",
        }.get(rol, rol.capitalize())

        html = f"""
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0f1c2e; background: #f4f7fa;">
  <div style="background: white; border-radius: 16px; border: 1px solid #e8eef4; overflow: hidden;">
    <!-- Header -->
    <div style="background: #0f1c2e; padding: 28px 32px; display: flex; align-items: center; gap: 12px;">
      <div style="width: 36px; height: 36px; background: #2b4dd4; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
        <span style="color: white; font-size: 18px; font-weight: bold;">⚖</span>
      </div>
      <span style="color: white; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">LexCore</span>
    </div>
    <!-- Body -->
    <div style="padding: 32px;">
      <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #0f1c2e;">Te invitaron a {studio_name}</h2>
      <p style="margin: 0 0 24px; color: #6b8aaa; font-size: 15px; line-height: 1.6;">
        <strong style="color: #0f1c2e;">{inviter_name}</strong> te invitó a unirte a <strong style="color: #0f1c2e;">{studio_name}</strong> como <strong style="color: #2b4dd4;">{rol_display}</strong>.
      </p>
      <p style="margin: 0 0 28px; color: #3a5272; font-size: 14px; line-height: 1.6;">
        LexCore es la plataforma de gestión para el estudio. Vas a poder gestionar expedientes, clientes, vencimientos y mucho más.
      </p>
      <!-- CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="{accept_url}" style="display: inline-block; background: #2b4dd4; color: white; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 12px; letter-spacing: -0.2px;">
          Aceptar invitación →
        </a>
      </div>
      <p style="margin: 0; color: #6b8aaa; font-size: 13px; text-align: center;">
        El link vence en 7 días. Si no esperabas esta invitación, podés ignorar este email.
      </p>
    </div>
    <!-- Footer -->
    <div style="padding: 20px 32px; border-top: 1px solid #e8eef4; background: #f4f7fa;">
      <p style="margin: 0; color: #6b8aaa; font-size: 12px; text-align: center;">
        LexCore · Gestión para estudios jurídicos · Argentina
      </p>
    </div>
  </div>
</body>
</html>
"""

        resend.Emails.send({
            "from": "LexCore <noreply@lexcore.app>",
            "to": [to_email],
            "subject": f"Invitación a {studio_name} en LexCore",
            "html": html,
        })
        logger.info(f"Email de invitación enviado a {to_email}")
        return True

    except Exception as e:
        logger.error(f"Error enviando email de invitación a {to_email}: {e}")
        return False


def send_reset_password_email(
    *,
    to_email: str,
    full_name: str,
    token: str,
    frontend_url: str = "http://localhost:3001",
) -> bool:
    from app.core.config import settings

    api_key = getattr(settings, "RESEND_API_KEY", None)
    if not api_key:
        logger.warning("RESEND_API_KEY no configurada — email de reset omitido")
        return False

    try:
        import resend
        resend.api_key = api_key

        url = f"{frontend_url}/reset-password/{token}"
        first_name = full_name.split()[0] if full_name else "hola"

        html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0f1c2e; background: #f4f7fa;">
  <div style="background: white; border-radius: 16px; border: 1px solid #e8eef4; overflow: hidden;">
    <div style="background: #0f1c2e; padding: 28px 32px;">
      <span style="color: white; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">LexCore</span>
    </div>
    <div style="padding: 32px;">
      <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #0f1c2e;">Restablecer contraseña</h2>
      <p style="margin: 0 0 24px; color: #6b8aaa; font-size: 15px; line-height: 1.6;">
        Hola <strong style="color: #0f1c2e;">{first_name}</strong>, recibimos una solicitud para restablecer tu contraseña.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{url}" style="display: inline-block; background: #2b4dd4; color: white; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 12px;">
          Restablecer contraseña →
        </a>
      </div>
      <p style="margin: 0; color: #6b8aaa; font-size: 13px; text-align: center;">
        El link vence en 1 hora. Si no solicitaste este cambio, podés ignorar este email.
      </p>
    </div>
    <div style="padding: 20px 32px; border-top: 1px solid #e8eef4; background: #f4f7fa;">
      <p style="margin: 0; color: #6b8aaa; font-size: 12px; text-align: center;">LexCore · Gestión para estudios jurídicos</p>
    </div>
  </div>
</body>
</html>"""

        resend.Emails.send({
            "from": "LexCore <noreply@lexcore.app>",
            "to": [to_email],
            "subject": "Restablecer contraseña — LexCore",
            "html": html,
        })
        logger.info(f"Email de reset enviado a {to_email}")
        return True

    except Exception as e:
        logger.error(f"Error enviando email de reset a {to_email}: {e}")
        return False
