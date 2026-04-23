"""
Genera el PDF unificado de un expediente:
  - Página de carátula con todos los datos del expediente
  - Separador por cada documento
  - Documentos PDF concatenados
  - Imágenes convertidas a página A4
  - Docs no soportados → página de aviso
  - Header y footer en todas las páginas
"""
import io
from datetime import datetime
from typing import Optional

import httpx
from fpdf import FPDF
from pypdf import PdfReader, PdfWriter

PLACEHOLDER = "—"
MAX_DOCS = 30
PAGE_W = 210
PAGE_H = 297
MARGIN = 20
HEADER_H = 10
FOOTER_H = 10

MESES = ["enero","febrero","marzo","abril","mayo","junio",
         "julio","agosto","septiembre","octubre","noviembre","diciembre"]


def _fecha_larga(dt: datetime) -> str:
    return f"{dt.day} de {MESES[dt.month - 1]} de {dt.year}"


def _val(v) -> str:
    return str(v).strip() if v and str(v).strip() else PLACEHOLDER


class LexPDF(FPDF):
    def __init__(self, numero_expediente: str, total_pages_ref: list):
        super().__init__()
        self.numero_expediente = numero_expediente
        self.total_pages_ref = total_pages_ref  # mutable list so we can update after render
        self.set_auto_page_break(auto=True, margin=FOOTER_H + 8)

    def header(self):
        self.set_y(6)
        self.set_font("Helvetica", "B", 7)
        self.set_text_color(120, 120, 120)
        self.cell(0, 4, "LexCore · Gestión para estudios de abogados", align="L")
        self.set_font("Helvetica", "", 7)
        self.set_xy(MARGIN, 6)
        self.cell(0, 4, self.numero_expediente, align="R")
        self.set_draw_color(220, 220, 220)
        self.set_line_width(0.2)
        self.line(MARGIN, 12, PAGE_W - MARGIN, 12)
        self.set_text_color(0, 0, 0)

    def footer(self):
        self.set_y(-14)
        self.set_draw_color(220, 220, 220)
        self.set_line_width(0.2)
        self.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(120, 120, 120)
        total = self.total_pages_ref[0] if self.total_pages_ref[0] else "?"
        self.cell(0, 4, f"Generado por LexCore · lexcore.app", align="L")
        self.set_xy(MARGIN, PAGE_H - 14)
        self.cell(0, 4, f"Pág. {self.page_no()} / {total}", align="R")
        self.set_text_color(0, 0, 0)


def _build_caratula_pdf(exp_data: dict, docs_count: int) -> bytes:
    total_ref = [0]
    pdf = LexPDF(exp_data["numero"], total_ref)
    pdf.add_page()

    content_y = 22
    pdf.set_xy(MARGIN, content_y)

    # Logo / título
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 10, "LexCore", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 5, "Gestión para estudios de abogados", ln=True)
    pdf.ln(6)

    # Línea separadora
    pdf.set_draw_color(200, 200, 200)
    pdf.set_line_width(0.4)
    x = pdf.get_x()
    y = pdf.get_y()
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y)
    pdf.ln(6)

    # Número y carátula
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(0, 0, 0)
    pdf.multi_cell(0, 8, exp_data["numero"], ln=True)
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(0, 7, exp_data["caratula"], ln=True)
    pdf.ln(8)

    # Línea separadora
    y = pdf.get_y()
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y)
    pdf.ln(6)

    # Datos del expediente
    def row(label: str, value: str):
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(55, 6, label, ln=False)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(20, 20, 20)
        pdf.multi_cell(0, 6, value, ln=True)

    row("Número judicial:", _val(exp_data.get("numero_judicial")))
    row("Fuero:", _val(exp_data.get("fuero")))
    row("Juzgado:", _val(exp_data.get("juzgado")))
    row("Localidad:", _val(exp_data.get("localidad")))
    row("Estado:", _val(exp_data.get("estado")))
    pdf.ln(4)

    y = pdf.get_y()
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y)
    pdf.ln(6)

    row("Cliente:", _val(exp_data.get("cliente_nombre")))
    row("Responsable:", _val(exp_data.get("responsable_nombre")))
    row("Apertura:", _val(exp_data.get("fecha_apertura")))
    pdf.ln(4)

    y = pdf.get_y()
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y)
    pdf.ln(6)

    # Docs incluidos y fecha generación
    now = datetime.now()
    hora = now.strftime("%H:%M")
    row("Documentos incluidos:", str(docs_count))
    row("Generado:", f"{_fecha_larga(now)} · {hora}")

    if docs_count == MAX_DOCS:
        pdf.ln(3)
        pdf.set_font("Helvetica", "I", 8)
        pdf.set_text_color(150, 80, 0)
        pdf.cell(0, 5, f"Nota: se incluyen los primeros {MAX_DOCS} documentos (límite de esta versión).", ln=True)

    total_ref[0] = pdf.page
    return pdf.output()


def _separator_page_pdf(index: int, total: int, nombre: str, total_pages_ref: list, numero_exp: str) -> bytes:
    pdf = LexPDF(numero_exp, total_pages_ref)
    pdf.add_page()
    pdf.set_y(PAGE_H / 2 - 15)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 5, f"Documento {index} de {total}", align="C", ln=True)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(30, 30, 30)
    pdf.multi_cell(0, 8, nombre, align="C")
    return pdf.output()


def _unavailable_page_pdf(nombre: str, motivo: str, total_pages_ref: list, numero_exp: str) -> bytes:
    pdf = LexPDF(numero_exp, total_pages_ref)
    pdf.add_page()
    pdf.set_y(PAGE_H / 2 - 10)
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(150, 80, 0)
    pdf.multi_cell(0, 7, f"Documento no incluido: {nombre}\n{motivo}", align="C")
    return pdf.output()


def _image_to_pdf(img_bytes: bytes, nombre: str, total_pages_ref: list, numero_exp: str) -> bytes:
    from PIL import Image
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    # Fit dentro de área de contenido (A4 menos márgenes y header/footer)
    max_w = PAGE_W - MARGIN * 2
    max_h = PAGE_H - MARGIN * 2 - HEADER_H - FOOTER_H
    img_w_mm = min(max_w, img.width * 25.4 / 96)
    img_h_mm = img_w_mm * img.height / img.width
    if img_h_mm > max_h:
        img_h_mm = max_h
        img_w_mm = img_h_mm * img.width / img.height

    pdf = LexPDF(numero_exp, total_pages_ref)
    pdf.add_page()
    x = (PAGE_W - img_w_mm) / 2
    y = (PAGE_H - img_h_mm) / 2

    tmp = io.BytesIO()
    img.save(tmp, format="JPEG", quality=85)
    tmp.seek(0)
    pdf.image(tmp, x=x, y=y, w=img_w_mm, h=img_h_mm)
    return pdf.output()


def _download_bytes(url: str) -> Optional[bytes]:
    try:
        r = httpx.get(url, timeout=30, follow_redirects=True)
        r.raise_for_status()
        return r.content
    except Exception:
        return None


def generar_pdf_unificado(exp_data: dict, documentos: list, get_download_url) -> bytes:
    """
    exp_data: dict con campos del expediente
    documentos: lista de dicts {id, nombre, content_type, file_key, orden}
    get_download_url: callable(file_key, nombre) -> str
    """
    docs = sorted(documentos, key=lambda d: d["orden"])[:MAX_DOCS]
    docs_count = len(docs)
    numero_exp = exp_data["numero"]

    writer = PdfWriter()
    total_pages_ref = [0]  # se actualiza al final

    # 1. Carátula
    caratula_bytes = _build_caratula_pdf(exp_data, docs_count)
    writer.append(PdfReader(io.BytesIO(caratula_bytes)))

    skipped = []

    for i, doc in enumerate(docs, start=1):
        nombre = doc["nombre"]
        ct = (doc.get("content_type") or "").lower()

        # Separador
        sep_bytes = _separator_page_pdf(i, docs_count, nombre, total_pages_ref, numero_exp)
        writer.append(PdfReader(io.BytesIO(sep_bytes)))

        # Descargar archivo
        url = get_download_url(doc["file_key"], nombre)
        file_bytes = _download_bytes(url)

        if file_bytes is None:
            unavail = _unavailable_page_pdf(nombre, "No fue posible descargar el archivo.", total_pages_ref, numero_exp)
            writer.append(PdfReader(io.BytesIO(unavail)))
            skipped.append(nombre)
            continue

        if "pdf" in ct:
            try:
                writer.append(PdfReader(io.BytesIO(file_bytes)))
            except Exception:
                unavail = _unavailable_page_pdf(nombre, "El archivo PDF está dañado o no es válido.", total_pages_ref, numero_exp)
                writer.append(PdfReader(io.BytesIO(unavail)))
                skipped.append(nombre)

        elif ct.startswith("image/"):
            try:
                img_pdf = _image_to_pdf(file_bytes, nombre, total_pages_ref, numero_exp)
                writer.append(PdfReader(io.BytesIO(img_pdf)))
            except Exception:
                unavail = _unavailable_page_pdf(nombre, "No se pudo convertir la imagen.", total_pages_ref, numero_exp)
                writer.append(PdfReader(io.BytesIO(unavail)))
                skipped.append(nombre)
        else:
            unavail = _unavailable_page_pdf(nombre, f"Formato no soportado ({ct or 'desconocido'}).", total_pages_ref, nombre)
            writer.append(PdfReader(io.BytesIO(unavail)))
            skipped.append(nombre)

    out = io.BytesIO()
    writer.write(out)
    out.seek(0)
    return out.read(), skipped
