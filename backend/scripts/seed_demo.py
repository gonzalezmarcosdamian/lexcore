"""
Seed de datos demo para LexCore.
Crea un estudio completo con clientes, expedientes, movimientos y vencimientos reales.

Uso:
    docker compose exec backend python scripts/seed_demo.py
    docker compose exec backend python scripts/seed_demo.py --reset  # borra todo primero
"""
import sys
import uuid
from datetime import date, timedelta

# Add /app to path
sys.path.insert(0, "/app")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.auth import hash_password, create_access_token
from app.core.config import settings
from app.models.studio import Studio
from app.models.user import User, UserRole, AuthProvider
from app.models.cliente import Cliente, TipoCliente
from app.models.expediente import (
    Expediente, ExpedienteAbogado, Movimiento, Vencimiento,
    EstadoExpediente, RolEnExpediente,
)
from app.models.honorario import Honorario, PagoHonorario, Moneda

# ── Conexión ──────────────────────────────────────────────────────────────────

DATABASE_URL = settings.DATABASE_URL
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

# ── Helpers ───────────────────────────────────────────────────────────────────

def uid():
    return str(uuid.uuid4())

def hoy():
    return date.today()

def dias(n: int) -> str:
    return (hoy() + timedelta(days=n)).isoformat()

# ── Reset ─────────────────────────────────────────────────────────────────────

def reset(db, studio_id: str):
    print("  Borrando datos demo existentes...")
    db.execute(text(f"DELETE FROM pagos_honorarios WHERE tenant_id = '{studio_id}'"))
    db.execute(text(f"DELETE FROM honorarios WHERE tenant_id = '{studio_id}'"))
    db.execute(text(f"DELETE FROM vencimientos WHERE tenant_id = '{studio_id}'"))
    db.execute(text(f"DELETE FROM movimientos WHERE tenant_id = '{studio_id}'"))
    db.execute(text(f"DELETE FROM expediente_abogados WHERE tenant_id = '{studio_id}'"))
    db.execute(text(f"DELETE FROM expedientes WHERE tenant_id = '{studio_id}'"))
    db.execute(text(f"DELETE FROM clientes WHERE tenant_id = '{studio_id}'"))
    db.execute(text(f"DELETE FROM invitaciones WHERE tenant_id = '{studio_id}'"))
    db.execute(text(f"DELETE FROM users WHERE tenant_id = '{studio_id}' AND email != 'ingonzalezdamian@gmail.com'"))
    db.commit()
    print("  ✓ Datos previos borrados")

# ── Main seed ─────────────────────────────────────────────────────────────────

def seed():
    db = Session()
    do_reset = "--reset" in sys.argv

    print("\n🌱 LexCore — Seed de datos demo\n")

    # ── 1. Studio y admin ─────────────────────────────────────────────────────
    studio = db.query(Studio).filter_by(slug="demo-estudio").first()
    if not studio:
        studio = Studio(id=uid(), name="Estudio Jurídico González & Asociados", slug="demo-estudio")
        db.add(studio)
        db.flush()
        print(f"  ✓ Studio: {studio.name}")
    else:
        print(f"  → Studio existente: {studio.name}")
        if do_reset:
            reset(db, studio.id)

    sid = studio.id

    # Admin principal (el usuario real del dev)
    admin = db.query(User).filter_by(email="ingonzalezdamian@gmail.com").first()
    if not admin:
        admin = User(
            id=uid(), tenant_id=sid,
            email="ingonzalezdamian@gmail.com",
            full_name="Damian Gonzalez",
            hashed_password=hash_password("lexcore2026"),
            role=UserRole.admin,
            auth_provider=AuthProvider.email,
        )
        db.add(admin)
        db.flush()
        print("  ✓ Admin: Damian Gonzalez (ingonzalezdamian@gmail.com)")
    else:
        admin.tenant_id = sid
        db.flush()
        print("  → Admin existente: Damian Gonzalez")

    # Equipo del estudio
    def make_user(email, name, role):
        u = db.query(User).filter_by(email=email, tenant_id=sid).first()
        if not u:
            u = User(
                id=uid(), tenant_id=sid, email=email, full_name=name,
                hashed_password=hash_password("lexcore2026"),
                role=role, auth_provider=AuthProvider.email,
            )
            db.add(u)
            db.flush()
        return u

    sofia  = make_user("sofia.ramirez@demo.com", "Sofía Ramírez", UserRole.socio)
    martin = make_user("martin.vega@demo.com",   "Martín Vega",   UserRole.asociado)
    lucia  = make_user("lucia.torres@demo.com",  "Lucía Torres",  UserRole.asociado)
    print("  ✓ Equipo: Sofía Ramírez (socia), Martín Vega (asociado), Lucía Torres (asociada)")

    # ── 2. Clientes ───────────────────────────────────────────────────────────
    def make_cliente(nombre, tipo, cuit_dni, telefono, email, archivado=False):
        c = Cliente(
            id=uid(), tenant_id=sid, nombre=nombre, tipo=tipo,
            cuit_dni=cuit_dni, telefono=telefono, email=email, archivado=archivado,
        )
        db.add(c)
        db.flush()
        return c

    clientes_data = [
        # Personas jurídicas
        ("Constructora Mendoza S.A.",      TipoCliente.juridica, "30-71234567-1", "011-4555-1234", "legal@constructora-mendoza.com.ar"),
        ("Grupo Alimenticio Norte S.R.L.", TipoCliente.juridica, "30-68901234-5", "011-4666-5678", "abogados@grupanorte.com"),
        ("Farmacéutica del Plata S.A.",    TipoCliente.juridica, "30-55432109-8", "011-4777-9012", "legal@farmaplata.com.ar"),
        ("Transportes Unidos S.A.",        TipoCliente.juridica, "30-44321098-2", "011-4888-3456", "gerencia@transunidos.com.ar"),
        ("Banco Regional del Interior",    TipoCliente.juridica, "30-33210987-6", "011-4999-7890", "juridico@bancori.com.ar"),
        # Personas físicas
        ("García, Juan Alberto",   TipoCliente.fisica, "20-23456789-4", "11-3333-4567", "juan.garcia@gmail.com"),
        ("Rodríguez, María Elena", TipoCliente.fisica, "27-34567890-3", "11-4444-5678", "mrodriguez@hotmail.com"),
        ("López, Carlos Augusto",  TipoCliente.fisica, "20-45678901-2", "11-5555-6789", "carloslopez@yahoo.com.ar"),
        ("Fernández, Ana Paula",   TipoCliente.fisica, "27-56789012-1", "11-6666-7890", "anafernandez@gmail.com"),
        ("Martínez, Roberto Luis", TipoCliente.fisica, "20-67890123-4", "11-7777-8901", "roberto.martinez@outlook.com"),
        # Archivado (para testear el toggle)
        ("Negocios Antiguos S.R.L.", TipoCliente.juridica, "30-11111111-1", "011-0000-0000", "viejo@antiguo.com", True),
    ]

    clientes = [make_cliente(*d) for d in clientes_data]
    print(f"  ✓ {len(clientes)} clientes creados")

    csa, gnu, farm, trans, banco, garcia, rodriguez, lopez, fernandez, martinez, archivado = clientes

    # ── 3. Expedientes ────────────────────────────────────────────────────────
    def make_exp(numero, caratula, fuero, juzgado, estado, cliente):
        e = Expediente(
            id=uid(), tenant_id=sid, numero=numero, caratula=caratula,
            fuero=fuero, juzgado=juzgado, estado=estado, cliente_id=cliente.id,
        )
        db.add(e)
        db.flush()
        return e

    exp_data = [
        # Activos
        ("CIV-2024-001234-CABA", "Constructora Mendoza S.A. c/ Municipalidad CABA s/ Contrato de Obra Pública",
         "Civil", "Juzgado Civil y Comercial N°15, CABA", EstadoExpediente.activo, csa),

        ("LAB-2024-005678-CABA", "García, Juan A. c/ Constructora Mendoza S.A. s/ Despido",
         "Laboral", "Juzgado Nacional del Trabajo N°3", EstadoExpediente.activo, garcia),

        ("COM-2024-002345-CABA", "Grupo Alimenticio Norte S.R.L. c/ Distribuidora El Sur s/ Incumplimiento Contractual",
         "Comercial", "Juzgado Comercial N°8, CABA", EstadoExpediente.activo, gnu),

        ("PEN-2024-009876-CABA", "Rodríguez, María E. s/ Denuncia Penal — Estafa Informática",
         "Penal", "Fiscalía Penal N°12, CABA", EstadoExpediente.activo, rodriguez),

        ("FAM-2024-003456-CABA", "López, Carlos A. c/ Fernández, Ana P. s/ Divorcio y División Bienes",
         "Familia", "Juzgado de Familia N°6, CABA", EstadoExpediente.activo, lopez),

        ("CON-2024-007654-CABA", "Farmacéutica del Plata S.A. c/ AFIP s/ Repetición Tributaria",
         "Contencioso-Administrativo", "Cámara Contencioso Administrativo Federal", EstadoExpediente.activo, farm),

        ("CIV-2024-008901-CABA", "Martínez, Roberto L. c/ Aseguradora Nacional s/ Daños y Perjuicios",
         "Civil", "Juzgado Civil N°22, CABA", EstadoExpediente.activo, martinez),

        ("LAB-2024-001122-CABA", "Fernández, Ana P. c/ Banco Regional del Interior s/ Acoso Laboral",
         "Laboral", "Juzgado Nacional del Trabajo N°7", EstadoExpediente.activo, fernandez),

        ("COM-2024-004567-CABA", "Transportes Unidos S.A. c/ Logística del Sur s/ Cobro de Pesos",
         "Comercial", "Juzgado Comercial N°3, CABA", EstadoExpediente.activo, trans),

        # Cerrado
        ("CIV-2023-009991-CABA", "Banco Regional del Interior c/ García, Juan A. s/ Ejecución Hipotecaria",
         "Civil", "Juzgado Civil N°5, CABA", EstadoExpediente.cerrado, banco),

        # Archivado
        ("COM-2022-001001-CABA", "Negocios Antiguos S.R.L. c/ Proveedor XYZ s/ Nulidad de Contrato",
         "Comercial", "Juzgado Comercial N°1, CABA", EstadoExpediente.archivado, archivado),
    ]

    expedientes = [make_exp(*d) for d in exp_data]
    print(f"  ✓ {len(expedientes)} expedientes creados")

    e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11 = expedientes

    # ── 4. Asignación de abogados ─────────────────────────────────────────────
    def asignar(exp, user, rol):
        ea = ExpedienteAbogado(
            id=uid(), tenant_id=sid,
            expediente_id=exp.id, user_id=user.id, rol=rol,
        )
        db.add(ea)

    # Damian (admin) como responsable en la mayoría
    for exp in [e1, e3, e6, e9]:
        asignar(exp, admin, RolEnExpediente.responsable)
    for exp in [e2, e4, e7, e10]:
        asignar(exp, sofia, RolEnExpediente.responsable)
    for exp in [e5, e8, e11]:
        asignar(exp, martin, RolEnExpediente.responsable)

    # Colaboraciones cruzadas
    asignar(e1, sofia, RolEnExpediente.supervision)
    asignar(e2, martin, RolEnExpediente.colaborador)
    asignar(e3, lucia, RolEnExpediente.colaborador)
    asignar(e5, lucia, RolEnExpediente.colaborador)
    asignar(e6, admin, RolEnExpediente.supervision)
    asignar(e9, sofia, RolEnExpediente.colaborador)
    db.flush()
    print("  ✓ Abogados asignados a expedientes")

    # ── 5. Movimientos ────────────────────────────────────────────────────────
    def mov(exp, user, texto):
        m = Movimiento(
            id=uid(), tenant_id=sid,
            expediente_id=exp.id, user_id=user.id, texto=texto,
        )
        db.add(m)

    mov(e1, admin,  "Presentación de demanda con documentación adjunta. Firmada digitalmente por Dr. González.")
    mov(e1, sofia,  "Notificación de traslado recibida. Plazo de contestación: 15 días hábiles desde 03/04/2026.")
    mov(e1, admin,  "Contestación de demanda presentada. Se adjuntaron 8 pruebas documentales.")
    mov(e1, admin,  "Se solicita apertura de prueba pericial contable. Perito designado: Cr. Roberto Sánchez.")

    mov(e2, sofia,  "Demanda de despido injustificado iniciada. Rubros: indemnización, preaviso, integración mes despido, SAC proporcional.")
    mov(e2, martin, "Presentación de CD y telegramas originales. Autenticados ante escribano.")
    mov(e2, sofia,  "Audiencia de conciliación celebrada. Sin acuerdo. Se continúa con la prueba.")

    mov(e3, admin,  "Demanda por incumplimiento contractual. Monto reclamado: $8.500.000 ARS.")
    mov(e3, lucia,  "Se notificó al demandado. Plazo de contestación vencido. Se solicitó rebeldía.")
    mov(e3, admin,  "Sentencia de primera instancia: favorable al actor. Se condena al pago de $8.5M + intereses.")

    mov(e4, sofia,  "Denuncia penal presentada. Presunta estafa mediante phishing bancario. Monto: $450.000 ARS.")
    mov(e4, sofia,  "Fiscalía tomó intervención. Se solicitó medida cautelar de bloqueo de cuentas.")

    mov(e5, martin, "Presentación de acuerdo de divorcio consensual. Inventario de bienes incluido.")
    mov(e5, lucia,  "Audiencia de ratificación celebrada. Ambas partes presentes. Acuerdo homologado.")

    mov(e6, admin,  "Demanda de repetición tributaria por $2.300.000 ARS. Concepto: IVA indebidamente percibido 2022-2023.")
    mov(e6, admin,  "AFIP contestó demanda. Se opone a la devolución alegando prescripción parcial.")
    mov(e6, admin,  "Pericia contable presentada. Determina monto adeudado en $2.150.000 ARS.")

    mov(e7, sofia,  "Demanda por daños y perjuicios post-accidente vial. Monto estimado: $1.800.000 ARS.")
    mov(e7, sofia,  "Aseguradora rechazó oferta extrajudicial de $600.000 ARS. Se continúa en juicio.")

    mov(e8, martin, "Denuncia laboral por acoso ante el Ministerio de Trabajo. Conciliación previa obligatoria iniciada.")
    mov(e8, martin, "Conciliación obligatoria sin acuerdo. Se habilita la vía judicial.")
    mov(e8, martin, "Demanda judicial presentada. Se solicita reinstalación y daño moral ($500.000 ARS).")

    mov(e9, admin,  "Carta de deuda presentada. Monto: $3.200.000 ARS por servicio de transporte impago.")
    mov(e9, sofia,  "Intimación fehaciente enviada. Plazo de 10 días para pagar o responder.")

    mov(e10, sofia, "Sentencia favorable: hipoteca ejecutada. Remate programado para 15/01/2024.")
    mov(e10, sofia, "Remate realizado. Bien adjudicado. Expediente en etapa de liquidación.")

    db.flush()
    print("  ✓ Movimientos procesales creados")

    # ── 6. Vencimientos ───────────────────────────────────────────────────────
    def vcto(exp, descripcion, fecha_str, tipo="vencimiento", cumplido=False):
        v = Vencimiento(
            id=uid(), tenant_id=sid,
            expediente_id=exp.id,
            descripcion=descripcion,
            fecha=fecha_str,
            tipo=tipo,
            cumplido=cumplido,
        )
        db.add(v)

    # URGENTES (< 48hs) — para ver el banner rojo
    vcto(e2, "Presentar alegatos escritos — URGENTE",         dias(1),   "presentacion")
    vcto(e7, "Contestar traslado de pericia contable",         dias(1),   "vencimiento")

    # PRÓXIMOS esta semana
    vcto(e1, "Audiencia de vista de causa",                    dias(3),   "audiencia")
    vcto(e4, "Presentar prueba documental en fiscalía",        dias(4),   "presentacion")
    vcto(e8, "Audiencia preliminar — Juzgado Trabajo N°7",     dias(5),   "audiencia")
    vcto(e6, "Plazo para presentar memorial de agravios",      dias(6),   "vencimiento")

    # PRÓXIMOS este mes
    vcto(e3, "Pericia contable — fecha de inicio de trabajos", dias(10),  "pericia")
    vcto(e9, "Audiencia de mediación prejudicial",             dias(12),  "audiencia")
    vcto(e5, "Inscripción de divorcio en Registro Civil",      dias(15),  "presentacion")
    vcto(e1, "Vence plazo de prueba documental",               dias(18),  "vencimiento")
    vcto(e7, "Audiencia de conciliación con aseguradora",      dias(20),  "audiencia")
    vcto(e6, "Responder traslado de impugnación pericial",     dias(22),  "vencimiento")

    # MÁS ADELANTE
    vcto(e2, "Sentencia de primera instancia (estimada)",      dias(45),  "vencimiento")
    vcto(e4, "Indagatoria — convocatoria a declarar",          dias(60),  "audiencia")
    vcto(e8, "Plazo para ofrecer prueba testimonial",          dias(30),  "vencimiento")
    vcto(e3, "Presentación de informe pericial final",         dias(35),  "pericia")

    # CUMPLIDOS (para ver la sección histórica)
    vcto(e1, "Traslado de demanda — presentación inicial",    dias(-30),  "vencimiento", cumplido=True)
    vcto(e2, "Audiencia de conciliación obligatoria",         dias(-20),  "audiencia",   cumplido=True)
    vcto(e5, "Presentación acuerdo divorcio",                 dias(-15),  "presentacion", cumplido=True)
    vcto(e3, "Notificación al demandado",                     dias(-10),  "vencimiento",  cumplido=True)
    vcto(e6, "Presentación demanda AFIP",                     dias(-45),  "vencimiento",  cumplido=True)

    db.flush()
    print("  ✓ Vencimientos creados (2 urgentes, 6 esta semana, varios más adelante)")

    # ── 7. Honorarios ─────────────────────────────────────────────────────────
    def make_honorario(exp, concepto, monto, moneda, fecha_acuerdo, pagos=None):
        h = Honorario(
            id=uid(), tenant_id=sid,
            expediente_id=exp.id,
            concepto=concepto,
            monto_acordado=monto,
            moneda=moneda,
            fecha_acuerdo=fecha_acuerdo,
        )
        db.add(h)
        db.flush()
        if pagos:
            for importe, fecha_pago, comprobante in pagos:
                p = PagoHonorario(
                    id=uid(), tenant_id=sid,
                    honorario_id=h.id,
                    importe=importe,
                    moneda=moneda,
                    fecha=fecha_pago,
                    comprobante=comprobante,
                )
                db.add(p)
            db.flush()
        return h

    # e1: CSA c/ CABA — honorarios ARS, 50% cobrado
    make_honorario(e1, "Honorarios por demanda contencioso-administrativa", "850000.00", Moneda.ARS,
                   dias(-60),
                   [(425000, dias(-30), "REC-2026-001"), (212500, dias(-15), "REC-2026-002")])

    # e2: García c/ CSA — laboral, 2 cuotas de 3
    make_honorario(e2, "Honorarios por juicio laboral — pago en cuotas", "1200000.00", Moneda.ARS,
                   dias(-90),
                   [(400000, dias(-60), "REC-2026-003"), (400000, dias(-30), "REC-2026-004")])

    # e3: GNU — sentencia favorable, cobro pendiente
    make_honorario(e3, "Honorarios por juicio de incumplimiento contractual", "680000.00", Moneda.ARS,
                   dias(-45),
                   [])  # nada cobrado aún

    # e6: Farmacéutica — repetición tributaria, USD
    make_honorario(e6, "Honorarios por repetición tributaria AFIP — etapa cámara", "4500.00", Moneda.USD,
                   dias(-30),
                   [(1500, dias(-15), "REC-USD-001")])

    # e7: Martínez daños — en proceso
    make_honorario(e7, "Honorarios por daños y perjuicios — cuota inicial", "540000.00", Moneda.ARS,
                   dias(-20),
                   [(270000, dias(-10), "REC-2026-005")])

    # e9: Transportes — cobro de pesos, retención honorarios
    make_honorario(e9, "Honorarios por cobro ejecutivo — retención sobre recupero", "960000.00", Moneda.ARS,
                   dias(-15),
                   [])

    # e4: Rodríguez penal — USD (caso complejo)
    make_honorario(e4, "Honorarios por denuncia penal y seguimiento de investigación", "2800.00", Moneda.USD,
                   dias(-50),
                   [(700, dias(-40), "REC-USD-002"), (700, dias(-20), "REC-USD-003")])

    db.flush()
    print("  ✓ Honorarios creados (ARS + USD, varios estados de pago)")

    # ── 8. Commit y resumen ───────────────────────────────────────────────────
    db.commit()

    token = create_access_token(studio_id=sid, user_id=admin.id, role="admin")

    print(f"""
╔══════════════════════════════════════════════════════════════╗
║           LexCore — Seed completado exitosamente             ║
╠══════════════════════════════════════════════════════════════╣
║  Estudio:      González & Asociados                          ║
║  Studio ID:    {sid[:36]}   ║
╠══════════════════════════════════════════════════════════════╣
║  USUARIOS                                                    ║
║  admin    → ingonzalezdamian@gmail.com  / lexcore2026        ║
║  socio    → sofia.ramirez@demo.com      / lexcore2026        ║
║  asociado → martin.vega@demo.com        / lexcore2026        ║
║  asociado → lucia.torres@demo.com       / lexcore2026        ║
╠══════════════════════════════════════════════════════════════╣
║  DATOS                                                       ║
║  Clientes:     11 (9 activos + 1 archivado + 1 jurídico)     ║
║  Expedientes:  11 (9 activos + 1 cerrado + 1 archivado)      ║
║  Movimientos:  ~25 con texto procesal real                   ║
║  Vencimientos: 21 (2 urgentes <48hs, 6 esta semana)          ║
║  Honorarios:   7 (ARS + USD, estados mixtos de pago)         ║
╠══════════════════════════════════════════════════════════════╣
║  Login: http://localhost:3001/dev/autologin                  ║
╚══════════════════════════════════════════════════════════════╝
""")

    db.close()


if __name__ == "__main__":
    seed()
