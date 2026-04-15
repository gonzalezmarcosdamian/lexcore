"""
Seed de documentos PDF para LexCore.
Genera PDFs legales realistas y los sube a MinIO, guardando metadata en la DB.

Uso:
    docker compose exec backend python scripts/seed_documentos.py
    docker compose exec backend python scripts/seed_documentos.py --reset
"""
import io
import sys
import uuid
from datetime import date

sys.path.insert(0, "/app")

import boto3
from fpdf import FPDF
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.documento import Documento
from app.models.expediente import Expediente
from app.models.studio import Studio
from app.models.user import User

DATABASE_URL = settings.DATABASE_URL
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)


# ── Storage ───────────────────────────────────────────────────────────────────

def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL or f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID or "minioadmin",
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY or "minioadmin",
        region_name="us-east-1",
    )


def upload_pdf(s3, tenant_id: str, expediente_id: str, filename: str, content: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    file_key = f"{tenant_id}/{expediente_id}/{uuid.uuid4()}.{ext}"
    s3.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=file_key,
        Body=content,
        ContentType="application/pdf",
    )
    return file_key


# ── PDF Factory ───────────────────────────────────────────────────────────────

class LexPDF(FPDF):
    """PDF con header/footer estilo LexCore."""

    def __init__(self, titulo: str, expediente: str):
        super().__init__()
        self._titulo = titulo
        self._expediente = expediente

    def header(self):
        self.set_font("Helvetica", "B", 11)
        self.set_fill_color(15, 28, 46)    # ink-900
        self.set_text_color(255, 255, 255)
        self.rect(0, 0, 210, 18, "F")
        self.set_xy(10, 4)
        self.cell(80, 10, "LEXCORE", ln=False)
        self.set_font("Helvetica", "", 9)
        self.set_x(100)
        self.cell(100, 10, self._expediente, align="R", ln=True)
        self.set_text_color(0, 0, 0)
        self.ln(8)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Pág. {self.page_no()} - Documento generado por LexCore - {date.today().isoformat()}", align="C")

    def titulo_doc(self, texto: str):
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(15, 28, 46)
        self.cell(0, 10, texto, ln=True, align="C")
        self.ln(4)
        self.set_draw_color(43, 77, 212)
        self.set_line_width(0.8)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(6)
        self.set_text_color(0, 0, 0)

    def subtitulo(self, texto: str):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(43, 77, 212)
        self.cell(0, 8, texto, ln=True)
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def parrafo(self, texto: str, justify: bool = True):
        self.set_font("Helvetica", "", 10)
        align = "J" if justify else "L"
        self.multi_cell(0, 6, texto, align=align)
        self.ln(3)

    def firma(self, nombre: str, cargo: str, lugar: str = "Ciudad Autónoma de Buenos Aires"):
        self.ln(10)
        self.set_draw_color(200, 200, 200)
        self.line(30, self.get_y(), 100, self.get_y())
        self.ln(4)
        self.set_font("Helvetica", "B", 10)
        self.cell(0, 5, nombre, ln=True)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, cargo, ln=True)
        self.cell(0, 5, lugar, ln=True)
        self.set_text_color(0, 0, 0)


def make_bytes(pdf: LexPDF) -> bytes:
    return bytes(pdf.output())


# ── Documentos por tipo ───────────────────────────────────────────────────────

def pdf_demanda(caratula: str, expediente_num: str, monto: str = "$2.500.000") -> bytes:
    pdf = LexPDF("Escrito de Demanda", expediente_num)
    pdf.add_page()
    pdf.titulo_doc("DEMANDA")

    pdf.subtitulo("I. OBJETO")
    pdf.parrafo(
        f"Que venimos a interponer formal demanda en los autos caratulados \"{caratula}\", "
        f"reclamando la suma de {monto} en concepto de daños y perjuicios derivados de "
        f"los hechos que se relatarán en el presente escrito, más intereses, costas y costos "
        f"del proceso."
    )

    pdf.subtitulo("II. HECHOS")
    pdf.parrafo(
        "Con fecha 15 de enero de 2024, las partes suscribieron un contrato de prestación "
        "de servicios profesionales. El demandado incumplió las obligaciones allí establecidas "
        "sin causa que lo justifique, generando los daños cuya reparación aquí se persigue."
    )
    pdf.parrafo(
        "Pese a las reiteradas intimaciones fehacientes cursadas con fechas 10/02/2024, "
        "25/02/2024 y 15/03/2024, el demandado no procedió a cumplir con sus obligaciones "
        "contractuales ni a resarcir los daños causados, motivo por el cual se promueve "
        "la presente acción judicial."
    )

    pdf.subtitulo("III. DERECHO")
    pdf.parrafo(
        "Fundan la presente acción en los artículos 730, 1082, 1716, 1717, 1724 y concordantes "
        "del Código Civil y Comercial de la Nación, en cuanto establecen la responsabilidad "
        "civil por incumplimiento contractual y la obligación de resarcir íntegramente "
        "los daños causados."
    )

    pdf.subtitulo("IV. PRUEBA")
    pdf.set_font("Helvetica", "", 10)
    pruebas = [
        "a) Documental: Contrato original, telegramas de intimación, facturas impagas.",
        "b) Pericial contable: Para determinar el monto exacto del perjuicio patrimonial.",
        "c) Testimonial: Tres testigos que presenciaron el incumplimiento.",
        "d) Informativa: Al Banco Central, AFIP y Registro de la Propiedad.",
    ]
    for p in pruebas:
        pdf.cell(0, 7, p, ln=True)
    pdf.ln(4)

    pdf.subtitulo("V. PETITORIO")
    pdf.parrafo(
        f"Por todo lo expuesto, solicitamos: 1) Se tenga por interpuesta la presente demanda. "
        f"2) Se corra traslado al demandado por el término de ley. 3) Oportunamente se dicte "
        f"sentencia condenando al demandado al pago de la suma de {monto} más intereses "
        f"y con expresa imposición de costas."
    )

    pdf.firma("Dr. Damian González", "Abogado - T° 45 F° 892 CPACF")
    return make_bytes(pdf)


def pdf_contestacion(caratula: str, expediente_num: str) -> bytes:
    pdf = LexPDF("Contestación de Demanda", expediente_num)
    pdf.add_page()
    pdf.titulo_doc("CONTESTACIÓN DE DEMANDA")

    pdf.subtitulo("I. OBJETO")
    pdf.parrafo(
        f"Que en autos \"{caratula}\", en legal tiempo y forma venimos a contestar la demanda "
        f"interpuesta en nuestra contra, solicitando su rechazo en todas sus partes con "
        f"expresa imposición de costas a la actora."
    )

    pdf.subtitulo("II. NEGATIVA GENERAL Y ESPECIAL")
    pdf.parrafo(
        "Negamos todos y cada uno de los hechos alegados en el escrito de demanda que no "
        "sean objeto de expreso reconocimiento en el presente. Negamos que se haya producido "
        "incumplimiento contractual alguno de nuestra parte. Negamos que la actora haya "
        "sufrido daño alguno imputable a nuestra conducta."
    )

    pdf.subtitulo("III. HECHOS")
    pdf.parrafo(
        "Los hechos acontecieron de manera diametralmente opuesta a lo relatado por la actora. "
        "Con fecha 15 de enero de 2024 se suscribió el contrato referido, siendo la actora "
        "quien incumplió las prestaciones a su cargo al no abonar las cuotas pactadas, "
        "generando la resolución contractual por su propia culpa."
    )

    pdf.subtitulo("IV. DERECHO")
    pdf.parrafo(
        "Arts. 1083, 1084, 1085, 1086 y cc. del CCyCN. La excepción de incumplimiento "
        "contractual (exceptio non adimpleti contractus) ampara la conducta de esta parte. "
        "La actora no puede reclamar el cumplimiento de obligaciones ajenas cuando ella "
        "misma incumplió las propias."
    )

    pdf.subtitulo("V. PETITORIO")
    pdf.parrafo(
        "Solicita: 1) Se rechace la demanda en todas sus partes. 2) Se impongan las costas "
        "a la parte actora por su temeraria conducta procesal. 3) Se reserve el derecho "
        "de reconvenir en caso de ser necesario."
    )

    pdf.firma("Dra. Sofía Ramírez", "Abogada - T° 52 F° 134 CPACF")
    return make_bytes(pdf)


def pdf_pericia(caratula: str, expediente_num: str, monto_periciado: str = "$1.850.000") -> bytes:
    pdf = LexPDF("Informe Pericial Contable", expediente_num)
    pdf.add_page()
    pdf.titulo_doc("INFORME PERICIAL CONTABLE")

    pdf.set_font("Helvetica", "", 10)
    pdf.set_fill_color(240, 245, 250)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 7, "DATOS DE LA PERICIA", ln=True, fill=True)
    pdf.set_font("Helvetica", "", 9)
    datos = [
        ("Autos:", caratula),
        ("Expediente:", expediente_num),
        ("Perito designado:", "Cr. Roberto Sánchez - T° 18 F° 447 CPCECABA"),
        ("Fecha de presentación:", date.today().strftime("%d/%m/%Y")),
        ("Puntos de pericia:", "3"),
    ]
    for label, valor in datos:
        pdf.cell(45, 6, label, ln=False)
        pdf.cell(0, 6, valor, ln=True)
    pdf.ln(5)

    pdf.subtitulo("PUNTO 1 - Determinación del daño patrimonial")
    pdf.parrafo(
        "Analizada la documentación aportada por ambas partes - libros contables, facturas, "
        "estados de cuenta bancarios y comprobantes de pago - se determinó que el monto "
        f"del perjuicio patrimonial sufrido por la actora asciende a {monto_periciado} "
        f"a valores del {date.today().strftime('%d/%m/%Y')}."
    )

    pdf.subtitulo("PUNTO 2 - Existencia de deuda")
    pdf.parrafo(
        "Se verificó la existencia de deuda exigible a cargo del demandado por concepto "
        "de prestaciones no abonadas. La documentación contable respalda el reclamo "
        "en su totalidad. Los registros contables del demandado evidencian el pasivo "
        "reconocido internamente."
    )

    pdf.subtitulo("PUNTO 3 - Tasa de interés aplicable")
    pdf.parrafo(
        "Corresponde aplicar la tasa activa del Banco de la Nación Argentina para "
        "operaciones de descuento de documentos a 30 días, conforme la doctrina "
        "plenaria 'Samudio de Martínez c/ Transportes Doscientos Setenta S.A.' "
        "de la Cámara Nacional de Apelaciones en lo Civil."
    )

    # Tabla resumen
    pdf.ln(3)
    pdf.set_fill_color(15, 28, 46)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(100, 8, "CONCEPTO", fill=True, border=1)
    pdf.cell(0, 8, "MONTO", fill=True, border=1, align="R", ln=True)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 10)
    items = [
        ("Capital reclamado", monto_periciado),
        ("Intereses devengados", "$ 412.500"),
        ("TOTAL", f"$ {int(monto_periciado.replace('$','').replace('.','').strip()) + 412500:,}".replace(",", ".")),
    ]
    for i, (concepto, monto) in enumerate(items):
        fill = i % 2 == 0
        pdf.set_fill_color(240, 245, 250)
        bold = concepto == "TOTAL"
        pdf.set_font("Helvetica", "B" if bold else "", 10)
        pdf.cell(100, 7, concepto, border=1, fill=fill)
        pdf.cell(0, 7, monto, border=1, fill=fill, align="R", ln=True)

    pdf.firma("Cr. Roberto Sánchez", "Perito Contable Oficial")
    return make_bytes(pdf)


def pdf_poder(caratula: str, expediente_num: str) -> bytes:
    pdf = LexPDF("Poder Especial Judicial", expediente_num)
    pdf.add_page()
    pdf.titulo_doc("PODER ESPECIAL JUDICIAL")

    pdf.subtitulo("OTORGANTE")
    pdf.parrafo(
        "CONSTE por el presente instrumento que yo, JUAN ALBERTO GARCÍA, DNI 23.456.789, "
        "con domicilio en Av. Corrientes 1234, Piso 3° Depto. B, Ciudad Autónoma de "
        "Buenos Aires, en adelante 'el poderdante', por este acto otorgo PODER ESPECIAL "
        "JUDICIAL a favor del Dr. Damian González, CUIT 20-31234567-8, Abogado, "
        "con domicilio constituido en Av. Santa Fe 987 Piso 5°, CABA."
    )

    pdf.subtitulo("OBJETO DEL PODER")
    pdf.parrafo(
        f"El presente poder se otorga especialmente para representar al poderdante en "
        f"todos los trámites judiciales y extrajudiciales relacionados con los autos "
        f"caratulados \"{caratula}\", Expediente N° {expediente_num}, y en todos los "
        f"incidentes, recursos y actuaciones que se originen en dicho proceso."
    )

    pdf.subtitulo("FACULTADES CONFERIDAS")
    pdf.set_font("Helvetica", "", 10)
    facultades = [
        "[v] Demandar, reconvenir y contestar demandas.",
        "[v] Ofrecer y producir toda clase de pruebas.",
        "[v] Interponer recursos ordinarios y extraordinarios.",
        "[v] Transigir, conciliar y percibir sumas de dinero.",
        "[v] Constituir y variar domicilios procesales.",
        "[v] Designar peritos y absolver posiciones.",
        "[v] Todos los actos necesarios para el mejor desempeño del mandato.",
    ]
    for f in facultades:
        pdf.cell(0, 7, f, ln=True)
    pdf.ln(4)

    pdf.subtitulo("DURACIÓN")
    pdf.parrafo(
        "El presente poder tendrá vigencia hasta la finalización del proceso indicado "
        "o hasta su revocación expresa por parte del poderdante, lo que ocurra primero."
    )

    pdf.firma("Juan Alberto García", "Poderdante - DNI 23.456.789")
    return make_bytes(pdf)


def pdf_acuerdo_honorarios(caratula: str, expediente_num: str, monto: str = "U$D 3.500") -> bytes:
    pdf = LexPDF("Acuerdo de Honorarios", expediente_num)
    pdf.add_page()
    pdf.titulo_doc("ACUERDO DE HONORARIOS PROFESIONALES")

    pdf.subtitulo("PARTES")
    pdf.parrafo(
        "Entre el Dr. Damian González (en adelante 'el Profesional') y Juan Alberto García, "
        f"DNI 23.456.789 (en adelante 'el Cliente'), se celebra el presente acuerdo de "
        f"honorarios profesionales en relación a la causa caratulada \"{caratula}\"."
    )

    pdf.subtitulo("HONORARIOS PACTADOS")
    pdf.parrafo(
        f"Las partes acuerdan que los honorarios por la representación y patrocinio legal "
        f"en la causa de referencia ascienden a la suma de {monto}, los cuales serán "
        f"abonados según el siguiente cronograma:"
    )
    pdf.set_font("Helvetica", "", 10)
    cuotas = [
        "- 1° cuota: 30% al momento de la firma del presente acuerdo.",
        "- 2° cuota: 40% al momento de la notificación de la sentencia de primera instancia.",
        "- 3° cuota: 30% al momento del efectivo cobro de la condena.",
    ]
    for c in cuotas:
        pdf.cell(0, 7, c, ln=True)
    pdf.ln(4)

    pdf.subtitulo("GASTOS")
    pdf.parrafo(
        "Los gastos de sellados, tasas de justicia, gastos de correo y traslados "
        "serán por cuenta exclusiva del Cliente y deberán ser abonados dentro de "
        "las 48 horas de ser requeridos por el Profesional."
    )

    pdf.subtitulo("FIRMA")
    pdf.ln(5)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(90, 6, f"Ciudad Autónoma de Buenos Aires, {date.today().strftime('%d de %B de %Y')}", ln=True)
    pdf.ln(8)
    pdf.cell(0, 6, "Firman en conformidad:", ln=True)
    pdf.ln(4)
    pdf.firma("Dr. Damian González", "Profesional - T° 45 F° 892 CPACF")

    return make_bytes(pdf)


# ── Seed principal ────────────────────────────────────────────────────────────

DOCS_POR_EXPEDIENTE = {
    # (número parcial del expediente, [(nombre_archivo, generador)])
    "CIV-2024-001234": [
        ("01_demanda_inicial.pdf",      lambda e, n: pdf_demanda(e, n, "$850.000")),
        ("02_contestacion_demanda.pdf", lambda e, n: pdf_contestacion(e, n)),
        ("03_informe_pericial.pdf",     lambda e, n: pdf_pericia(e, n, "$850.000")),
        ("04_poder_especial.pdf",       lambda e, n: pdf_poder(e, n)),
    ],
    "LAB-2024-005678": [
        ("01_demanda_laboral.pdf",      lambda e, n: pdf_demanda(e, n, "$1.200.000")),
        ("02_acuerdo_honorarios.pdf",   lambda e, n: pdf_acuerdo_honorarios(e, n, "U$D 2.800")),
        ("03_poder_judicial.pdf",       lambda e, n: pdf_poder(e, n)),
    ],
    "COM-2024-002345": [
        ("01_demanda_comercial.pdf",    lambda e, n: pdf_demanda(e, n, "$8.500.000")),
        ("02_pericia_contable.pdf",     lambda e, n: pdf_pericia(e, n, "$8.500.000")),
    ],
    "CON-2024-007654": [
        ("01_demanda_afip.pdf",         lambda e, n: pdf_demanda(e, n, "$2.300.000")),
        ("02_pericia_tributaria.pdf",   lambda e, n: pdf_pericia(e, n, "$2.150.000")),
        ("03_acuerdo_honorarios.pdf",   lambda e, n: pdf_acuerdo_honorarios(e, n, "U$D 4.500")),
    ],
    "CIV-2024-008901": [
        ("01_demanda_danos.pdf",        lambda e, n: pdf_demanda(e, n, "$1.800.000")),
        ("02_acuerdo_honorarios.pdf",   lambda e, n: pdf_acuerdo_honorarios(e, n, "U$D 1.800")),
    ],
}


def seed():
    db = Session()
    do_reset = "--reset" in sys.argv

    print("\n📄 LexCore - Seed de documentos PDF\n")

    # Buscar el studio del seed
    studio = db.query(Studio).filter_by(slug="demo-estudio").first()
    if not studio:
        print("  ❌ Studio 'demo-estudio' no encontrado. Corré seed_demo.py primero.")
        db.close()
        return

    # Buscar admin para uploaded_by
    admin = db.query(User).filter_by(email="ingonzalezdamian@gmail.com").first()
    if not admin:
        print("  ❌ Admin no encontrado.")
        db.close()
        return

    s3 = s3_client()

    if do_reset:
        print("  Borrando documentos existentes del seed...")
        docs = db.query(Documento).filter_by(tenant_id=studio.id).all()
        for doc in docs:
            try:
                s3.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=doc.file_key)
            except Exception:
                pass
            db.delete(doc)
        db.commit()
        print(f"  [v] {len(docs)} documentos eliminados")

    total = 0
    for numero_parcial, archivos in DOCS_POR_EXPEDIENTE.items():
        exp = db.query(Expediente).filter(
            Expediente.numero.like(f"{numero_parcial}%"),
            Expediente.tenant_id == studio.id,
        ).first()

        if not exp:
            print(f"  ⚠ Expediente {numero_parcial} no encontrado - saltando")
            continue

        print(f"\n  📁 {exp.numero}")
        for nombre_archivo, generador in archivos:
            try:
                pdf_bytes = generador(exp.caratula, exp.numero)
                file_key = upload_pdf(s3, studio.id, exp.id, nombre_archivo, pdf_bytes)

                doc = Documento(
                    id=str(uuid.uuid4()),
                    tenant_id=studio.id,
                    expediente_id=exp.id,
                    nombre=nombre_archivo.replace("_", " ").replace(".pdf", "").title() + ".pdf",
                    file_key=file_key,
                    size_bytes=len(pdf_bytes),
                    content_type="application/pdf",
                    uploaded_by=admin.id,
                )
                db.add(doc)
                total += 1
                print(f"     [v] {doc.nombre} ({len(pdf_bytes) // 1024} KB)")
            except Exception as e:
                print(f"     ❌ Error en {nombre_archivo}: {e}")

    db.commit()
    db.close()

    print(f"""
╔══════════════════════════════════════════════════════════════╗
║        LexCore - Seed de documentos completado               ║
╠══════════════════════════════════════════════════════════════╣
║  PDFs generados y subidos a MinIO: {total:<26} ║
║  Consola MinIO: http://localhost:9001                        ║
║  Usuario/pass:  minioadmin / minioadmin                      ║
╚══════════════════════════════════════════════════════════════╝
""")


if __name__ == "__main__":
    seed()
