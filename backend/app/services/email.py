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
      <span style="color: white; font-size: 18px; font-weight: 700; letter-spacing: -0.3px;">Vencimiento urgente — Luthor</span>
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
        Este vencimiento vence en menos de 48 horas. Marcalo como cumplido en Luthor una vez que hayas actuado.
      </p>
    </div>
    <div style="padding: 20px 32px; border-top: 1px solid #e8eef4; background: #f4f7fa;">
      <p style="margin: 0; color: #6b8aaa; font-size: 12px; text-align: center;">
        Luthor · Gestión para estudios jurídicos · Argentina
      </p>
    </div>
  </div>
</body>
</html>
"""

        resend.Emails.send({
            "from": "Luthor <noreply@lexcore.app>",  # TODO(rename): cambiar a noreply@luthor.app cuando se migre el dominio
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
      <span style="color: white; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">Luthor</span>
    </div>
    <!-- Body -->
    <div style="padding: 32px;">
      <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #0f1c2e;">Te invitaron a {studio_name}</h2>
      <p style="margin: 0 0 24px; color: #6b8aaa; font-size: 15px; line-height: 1.6;">
        <strong style="color: #0f1c2e;">{inviter_name}</strong> te invitó a unirte a <strong style="color: #0f1c2e;">{studio_name}</strong> como <strong style="color: #2b4dd4;">{rol_display}</strong>.
      </p>
      <p style="margin: 0 0 28px; color: #3a5272; font-size: 14px; line-height: 1.6;">
        Luthor es la plataforma de gestión para el estudio. Vas a poder gestionar expedientes, clientes, vencimientos y mucho más.
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
        Luthor · Gestión para estudios jurídicos · Argentina
      </p>
    </div>
  </div>
</body>
</html>
"""

        resend.Emails.send({
            "from": "Luthor <noreply@lexcore.app>",  # TODO(rename): cambiar a noreply@luthor.app cuando se migre el dominio
            "to": [to_email],
            "subject": f"Invitación a {studio_name} en Luthor",
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
      <span style="color: white; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">Luthor</span>
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
      <p style="margin: 0; color: #6b8aaa; font-size: 12px; text-align: center;">Luthor · Gestión para estudios jurídicos</p>
    </div>
  </div>
</body>
</html>"""

        resend.Emails.send({
            "from": "Luthor <noreply@lexcore.app>",  # TODO(rename): cambiar a noreply@luthor.app cuando se migre el dominio
            "to": [to_email],
            "subject": "Restablecer contraseña — Luthor",
            "html": html,
        })
        logger.info(f"Email de reset enviado a {to_email}")
        return True

    except Exception as e:
        logger.error(f"Error enviando email de reset a {to_email}: {e}")
        return False


def send_subscription_confirmed_email(
    *,
    to_email: str,
    studio_name: str,
    plan_label: str,
    billing_cycle: str,
    amount: float,
    next_billing_date: str | None = None,
) -> bool:
    """Email de confirmación cuando el pago de suscripción es exitoso."""
    from app.core.config import settings

    api_key = getattr(settings, "RESEND_API_KEY", None)
    if not api_key:
        return False

    try:
        import resend
        resend.api_key = api_key

        ciclo = "mensual" if billing_cycle == "monthly" else "anual"
        next_date_str = ""
        if next_billing_date:
            try:
                from datetime import datetime
                d = datetime.fromisoformat(next_billing_date[:10])
                next_date_str = d.strftime("%-d de %B de %Y")
            except Exception:
                next_date_str = next_billing_date[:10]

        html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0f1c2e; background: #f4f7fa;">
  <div style="background: white; border-radius: 16px; border: 1px solid #e8eef4; overflow: hidden;">
    <div style="background: #0f1c2e; padding: 28px 32px;">
      <span style="color: white; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">Luthor</span>
    </div>
    <div style="padding: 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 56px; height: 56px; background: #dcfce7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
          <span style="font-size: 28px;">✓</span>
        </div>
        <h2 style="margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #0f1c2e;">¡Suscripción activada!</h2>
        <p style="margin: 0; color: #6b8aaa; font-size: 14px;">{studio_name}</p>
      </div>
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b8aaa; font-size: 13px;">Plan</span>
          <span style="color: #0f1c2e; font-size: 13px; font-weight: 600;">{plan_label}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b8aaa; font-size: 13px;">Ciclo</span>
          <span style="color: #0f1c2e; font-size: 13px; font-weight: 600; text-transform: capitalize;">{ciclo}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: {'' if not next_date_str else '8px'};">
          <span style="color: #6b8aaa; font-size: 13px;">Monto</span>
          <span style="color: #0f1c2e; font-size: 13px; font-weight: 600;">ARS {amount:,.0f}/mes</span>
        </div>
        {f'<div style="display: flex; justify-content: space-between;"><span style="color: #6b8aaa; font-size: 13px;">Próximo cobro</span><span style="color: #0f1c2e; font-size: 13px; font-weight: 600;">{next_date_str}</span></div>' if next_date_str else ''}
      </div>
      <p style="margin: 0; color: #6b8aaa; font-size: 13px; text-align: center;">
        Podés cancelar en cualquier momento desde tu Perfil → Mi plan.
      </p>
    </div>
    <div style="padding: 20px 32px; border-top: 1px solid #e8eef4; background: #f4f7fa;">
      <p style="margin: 0; color: #6b8aaa; font-size: 12px; text-align: center;">Luthor · Gestión para estudios jurídicos</p>
    </div>
  </div>
</body>
</html>"""

        resend.Emails.send({
            "from": "Luthor <noreply@lexcore.app>",  # TODO(rename): noreply@luthor.app
            "to": [to_email],
            "subject": f"✅ Suscripción activada — {plan_label} {ciclo}",
            "html": html,
        })
        logger.info(f"Email suscripción confirmada enviado a {to_email}")
        return True

    except Exception as e:
        logger.error(f"Error enviando email suscripción a {to_email}: {e}")
        return False


def send_trial_warning_email(
    *,
    to_email: str,
    studio_name: str,
    dias_restantes: int,
    frontend_url: str = "https://lexcore-kappa.vercel.app",
) -> bool:
    """Email de aviso cuando el trial está por vencer (día 25 → 5 días restantes)."""
    from app.core.config import settings

    api_key = getattr(settings, "RESEND_API_KEY", None)
    if not api_key:
        return False

    try:
        import resend
        resend.api_key = api_key

        urgency_color = "#dc2626" if dias_restantes <= 3 else "#d97706"
        plan_url = f"{frontend_url}/perfil"

        html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0f1c2e; background: #f4f7fa;">
  <div style="background: white; border-radius: 16px; border: 1px solid #e8eef4; overflow: hidden;">
    <div style="background: #0f1c2e; padding: 28px 32px;">
      <span style="color: white; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">Luthor</span>
    </div>
    <div style="padding: 32px;">
      <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #0f1c2e;">Tu prueba gratuita vence en {dias_restantes} {'día' if dias_restantes == 1 else 'días'}</h2>
      <p style="margin: 0 0 24px; color: #3a5272; font-size: 15px; line-height: 1.6;">
        El estudio <strong>{studio_name}</strong> tiene acceso completo a Luthor hasta que venza el trial.<br>
        Suscribite antes para no perder el acceso a tus expedientes, vencimientos y honorarios.
      </p>
      <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; color: {urgency_color}; font-size: 14px; font-weight: 600;">
          ⏰ {dias_restantes} {'día restante' if dias_restantes == 1 else 'días restantes'} de acceso completo
        </p>
        <p style="margin: 4px 0 0; color: #92400e; font-size: 13px;">
          Después del trial, el estudio pasa a modo solo lectura.
        </p>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="{plan_url}" style="display: inline-block; background: #2b4dd4; color: white; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 12px;">
          Ver planes y suscribirme →
        </a>
      </div>
      <p style="margin: 0; color: #6b8aaa; font-size: 13px; text-align: center;">
        Desde $17.000 ARS/mes por estudio completo, sin cobro por usuario.
      </p>
    </div>
    <div style="padding: 20px 32px; border-top: 1px solid #e8eef4; background: #f4f7fa;">
      <p style="margin: 0; color: #6b8aaa; font-size: 12px; text-align: center;">Luthor · Gestión para estudios jurídicos</p>
    </div>
  </div>
</body>
</html>"""

        resend.Emails.send({
            "from": "Luthor <noreply@lexcore.app>",  # TODO(rename): noreply@luthor.app
            "to": [to_email],
            "subject": f"⏰ Tu trial vence en {dias_restantes} {'día' if dias_restantes == 1 else 'días'} — Luthor",
            "html": html,
        })
        logger.info(f"Email trial warning enviado a {to_email} ({dias_restantes}d restantes)")
        return True

    except Exception as e:
        logger.error(f"Error enviando email trial warning a {to_email}: {e}")
        return False
