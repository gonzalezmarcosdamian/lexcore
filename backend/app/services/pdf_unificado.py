"""
PDF unificado ejecutivo del expediente.
Layout: banda de color + dos columnas de datos + header/footer en todas las páginas.
"""
import io
from datetime import datetime
from typing import Optional

import httpx
from fpdf import FPDF
from pypdf import PdfReader, PdfWriter

# ── Constantes de layout ─────────────────────────────────────────────────────
PLACEHOLDER = "—"
MAX_DOCS    = 30
PAGE_W      = 210
PAGE_H      = 297
MARGIN      = 18
CONTENT_W   = PAGE_W - MARGIN * 2

# ── Paleta ────────────────────────────────────────────────────────────────────
NAVY        = (22,  45,  85)   # banda principal
BRAND       = (37,  99, 235)   # acento azul
LIGHT_GRAY  = (243, 244, 246)  # fondo celdas
MID_GRAY    = (107, 114, 128)  # texto secundario
DARK        = (17,  24,  39)   # texto principal
WHITE       = (255, 255, 255)
AMBER       = (180, 100,  10)  # aviso

MESES = ["enero","febrero","marzo","abril","mayo","junio",
         "julio","agosto","septiembre","octubre","noviembre","diciembre"]

ESTADO_COLOR = {
    "activo":    (22, 163, 74),   # green-600
    "archivado": (107, 114, 128), # gray-500
    "cerrado":   (220, 38,  38),  # red-600
}


def _fecha_larga(dt: datetime) -> str:
    return f"{dt.day} de {MESES[dt.month - 1]} de {dt.year}"


def _val(v) -> str:
    return str(v).strip() if v and str(v).strip() else PLACEHOLDER


# ── Clase base FPDF con header/footer ────────────────────────────────────────

class LexPDF(FPDF):
    def __init__(self, studio_name: str, numero_expediente: str, total_ref: list):
        super().__init__()
        self.studio_name      = studio_name
        self.numero_expediente = numero_expediente
        self.total_ref        = total_ref
        self.set_auto_page_break(auto=True, margin=16)

    def header(self):
        # Banda superior azul marino
        self.set_fill_color(*NAVY)
        self.rect(0, 0, PAGE_W, 11, "F")
        self.set_y(3)
        self.set_font("Helvetica", "B", 7.5)
        self.set_text_color(*WHITE)
        self.set_x(MARGIN)
        self.cell(CONTENT_W / 2, 5, self.studio_name.upper(), align="L")
        self.set_font("Helvetica", "", 7)
        self.set_x(MARGIN + CONTENT_W / 2)
        self.cell(CONTENT_W / 2, 5, self.numero_expediente, align="R")
        self.set_text_color(*DARK)
        self.ln(1)

    def footer(self):
        # Línea accent
        self.set_draw_color(*BRAND)
        self.set_line_width(0.4)
        self.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12)
        self.set_y(PAGE_H - 11)
        self.set_font("Helvetica", "", 6.5)
        self.set_text_color(*MID_GRAY)
        self.set_x(MARGIN)
        self.cell(CONTENT_W / 2, 5, "Generado con LexCore · lexcore.app", align="L")
        total = self.total_ref[0] if self.total_ref[0] else "?"
        self.set_x(MARGIN + CONTENT_W / 2)
        self.cell(CONTENT_W / 2, 5, f"Pág. {self.page_no()} / {total}", align="R")
        self.set_text_color(*DARK)


# ── Carátula ejecutiva ────────────────────────────────────────────────────────

def _build_caratula(exp_data: dict, docs_count: int) -> bytes:
    total_ref = [0]
    studio    = exp_data.get("studio_name", "LexCore")
    numero    = exp_data["numero"]

    pdf = LexPDF(studio, numero, total_ref)
    pdf.add_page()

    # ── Bloque identidad del estudio ──────────────────────────────────────────
    y0 = 17
    pdf.set_xy(MARGIN, y0)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 9, studio.upper(), ln=True)

    # Subtítulo contacto
    contacto_parts = []
    if exp_data.get("studio_email"):
        contacto_parts.append(exp_data["studio_email"])
    if exp_data.get("studio_telefono"):
        contacto_parts.append(exp_data["studio_telefono"])
    if contacto_parts:
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*MID_GRAY)
        pdf.set_x(MARGIN)
        pdf.cell(0, 5, "  ·  ".join(contacto_parts), ln=True)

    # Línea accent debajo del nombre del estudio
    pdf.ln(2)
    y_line = pdf.get_y()
    pdf.set_draw_color(*BRAND)
    pdf.set_line_width(0.8)
    pdf.line(MARGIN, y_line, MARGIN + 60, y_line)
    pdf.set_line_width(0.2)
    pdf.set_draw_color(*LIGHT_GRAY)
    pdf.line(MARGIN + 62, y_line, PAGE_W - MARGIN, y_line)
    pdf.ln(8)

    # ── Número y carátula del expediente ─────────────────────────────────────
    pdf.set_x(MARGIN)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*DARK)
    pdf.cell(0, 10, numero, ln=True)

    pdf.set_x(MARGIN)
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(CONTENT_W, 7, exp_data["caratula"])
    pdf.ln(6)

    # Badge de estado
    estado = (exp_data.get("estado") or "").lower()
    estado_label = estado.upper() if estado else "—"
    badge_color = ESTADO_COLOR.get(estado, MID_GRAY)
    pdf.set_x(MARGIN)
    pdf.set_fill_color(*badge_color)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(22, 5, f"  {estado_label}  ", fill=True, align="C")
    pdf.ln(10)

    # ── Dos columnas de datos ─────────────────────────────────────────────────
    col_w   = (CONTENT_W - 6) / 2
    col2_x  = MARGIN + col_w + 6
    row_h   = 6.5
    label_w = 28

    def data_card(title: str, rows: list[tuple[str, str]], x: float, y: float, w: float):
        pdf.set_xy(x, y)
        # Header de la card
        pdf.set_fill_color(*NAVY)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 7.5)
        pdf.cell(w, 6, f"  {title}", fill=True, ln=True)
        card_start_y = pdf.get_y()
        # Filas alternadas
        for i, (lbl, val) in enumerate(rows):
            row_y = card_start_y + i * row_h
            pdf.set_xy(x, row_y)
            # Fondo alternado
            if i % 2 == 0:
                pdf.set_fill_color(*LIGHT_GRAY)
            else:
                pdf.set_fill_color(*WHITE)
            pdf.cell(w, row_h, "", fill=True)
            # Label
            pdf.set_xy(x + 2, row_y + 0.5)
            pdf.set_font("Helvetica", "B", 7)
            pdf.set_text_color(*MID_GRAY)
            pdf.cell(label_w, row_h - 1, lbl)
            # Valor
            pdf.set_font("Helvetica", "", 7.5)
            pdf.set_text_color(*DARK)
            pdf.cell(w - label_w - 2, row_h - 1, val, align="R")
        # Borde card
        total_h = 6 + len(rows) * row_h
        pdf.set_draw_color(*BRAND)
        pdf.set_line_width(0.3)
        pdf.rect(x, y, w, total_h)
        # Línea accent izquierda
        pdf.set_line_width(1.2)
        pdf.line(x, y, x, y + total_h)
        pdf.set_line_width(0.2)
        return y + total_h

    card_y = pdf.get_y()

    rows_judicial = [
        ("Nº judicial",  _val(exp_data.get("numero_judicial"))),
        ("Fuero",        _val(exp_data.get("fuero"))),
        ("Juzgado",      _val(exp_data.get("juzgado"))),
        ("Localidad",    _val(exp_data.get("localidad"))),
    ]
    rows_partes = [
        ("Cliente",      _val(exp_data.get("cliente_nombre"))),
        ("Responsable",  _val(exp_data.get("responsable_nombre"))),
        ("Apertura",     _val(exp_data.get("fecha_apertura"))),
        ("Estado",       _val(exp_data.get("estado"))),
    ]

    end_y1 = data_card("DATOS JUDICIALES", rows_judicial, MARGIN,  card_y, col_w)
    end_y2 = data_card("PARTES",           rows_partes,   col2_x, card_y, col_w)
    pdf.set_y(max(end_y1, end_y2) + 10)

    # ── Pie de generación ─────────────────────────────────────────────────────
    pdf.set_draw_color(*LIGHT_GRAY)
    pdf.set_line_width(0.3)
    y_sep = pdf.get_y()
    pdf.line(MARGIN, y_sep, PAGE_W - MARGIN, y_sep)
    pdf.ln(5)

    now  = datetime.now()
    hora = now.strftime("%H:%M")
    autor = _val(exp_data.get("autor_nombre"))

    pdf.set_x(MARGIN)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*MID_GRAY)
    pdf.cell(0, 5, f"Generado por {autor}  ·  {_fecha_larga(now)} a las {hora}  ·  {docs_count} documento{'s' if docs_count != 1 else ''} incluido{'s' if docs_count != 1 else ''}", ln=True)

    if docs_count == MAX_DOCS:
        pdf.set_x(MARGIN)
        pdf.set_font("Helvetica", "I", 7.5)
        pdf.set_text_color(*AMBER)
        pdf.cell(0, 5, f"Nota: se incluyen los primeros {MAX_DOCS} documentos (límite de esta versión).", ln=True)

    # ── Banda inferior navy ───────────────────────────────────────────────────
    band_y = PAGE_H - 22
    pdf.set_fill_color(*NAVY)
    pdf.rect(0, band_y, PAGE_W, 22, "F")
    pdf.set_y(band_y + 7)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*WHITE)
    pdf.set_x(MARGIN)
    pdf.cell(CONTENT_W / 2, 5, studio.upper(), align="L")
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_x(MARGIN + CONTENT_W / 2)
    pdf.cell(CONTENT_W / 2, 5, "Generado con LexCore · lexcore.app", align="R")

    total_ref[0] = pdf.page
    return pdf.output()


# ── Página separadora ─────────────────────────────────────────────────────────

def _separator_page(index: int, total: int, nombre: str,
                    studio: str, numero: str, total_ref: list) -> bytes:
    pdf = LexPDF(studio, numero, total_ref)
    pdf.add_page()

    # Banda accent centrada verticalmente
    mid = PAGE_H / 2
    pdf.set_fill_color(*BRAND)
    pdf.rect(0, mid - 18, PAGE_W, 36, "F")

    # Número de documento
    pdf.set_y(mid - 13)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*WHITE)
    pdf.set_text_color(200, 220, 255)
    pdf.cell(0, 6, f"Documento {index} de {total}", align="C", ln=True)

    # Nombre del documento
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(*WHITE)
    pdf.multi_cell(0, 8, nombre, align="C")

    return pdf.output()


# ── Página de documento no disponible ────────────────────────────────────────

def _unavailable_page(nombre: str, motivo: str,
                      studio: str, numero: str, total_ref: list) -> bytes:
    pdf = LexPDF(studio, numero, total_ref)
    pdf.add_page()
    pdf.set_y(PAGE_H / 2 - 12)

    # Recuadro aviso
    box_x = MARGIN + 20
    box_w = CONTENT_W - 40
    pdf.set_fill_color(255, 247, 237)
    pdf.set_draw_color(*AMBER)
    pdf.set_line_width(0.5)
    pdf.rect(box_x, PAGE_H / 2 - 14, box_w, 28, "FD")

    pdf.set_xy(box_x, PAGE_H / 2 - 9)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*AMBER)
    pdf.cell(box_w, 6, "Documento no incluido", align="C", ln=True)
    pdf.set_xy(box_x, pdf.get_y())
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(60, 40, 0)
    pdf.multi_cell(box_w, 5, f"{nombre}\n{motivo}", align="C")

    return pdf.output()


# ── Imagen → PDF ──────────────────────────────────────────────────────────────

def _image_to_pdf(img_bytes: bytes, studio: str, numero: str, total_ref: list) -> bytes:
    from PIL import Image
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    max_w = CONTENT_W
    max_h = PAGE_H - 30   # header + footer
    img_w = min(max_w, img.width * 25.4 / 96)
    img_h = img_w * img.height / img.width
    if img_h > max_h:
        img_h = max_h
        img_w = img_h * img.width / img.height

    pdf = LexPDF(studio, numero, total_ref)
    pdf.add_page()
    x = (PAGE_W - img_w) / 2
    y = (PAGE_H - img_h) / 2

    tmp = io.BytesIO()
    img.save(tmp, format="JPEG", quality=85)
    tmp.seek(0)
    pdf.image(tmp, x=x, y=y, w=img_w, h=img_h)
    return pdf.output()


# ── Descarga ──────────────────────────────────────────────────────────────────

def _download_bytes(url: str) -> Optional[bytes]:
    try:
        r = httpx.get(url, timeout=30, follow_redirects=True)
        r.raise_for_status()
        return r.content
    except Exception:
        return None


# ── Punto de entrada ──────────────────────────────────────────────────────────

def generar_pdf_unificado(exp_data: dict, documentos: list, get_download_url) -> tuple[bytes, list]:
    """
    exp_data: campos del expediente + studio_name, studio_email, studio_telefono, autor_nombre
    documentos: lista de dicts {id, nombre, content_type, file_key, orden}
    get_download_url: callable(file_key, nombre) -> str
    Retorna (pdf_bytes, skipped_nombres)
    """
    docs        = sorted(documentos, key=lambda d: d["orden"])[:MAX_DOCS]
    docs_count  = len(docs)
    numero      = exp_data["numero"]
    studio      = exp_data.get("studio_name", "LexCore")
    total_ref   = [0]

    writer = PdfWriter()

    # Carátula
    writer.append(PdfReader(io.BytesIO(_build_caratula(exp_data, docs_count))))

    skipped = []

    for i, doc in enumerate(docs, start=1):
        nombre = doc["nombre"]
        ct     = (doc.get("content_type") or "").lower()

        # Separador
        sep = _separator_page(i, docs_count, nombre, studio, numero, total_ref)
        writer.append(PdfReader(io.BytesIO(sep)))

        # Descargar
        url        = get_download_url(doc["file_key"], nombre)
        file_bytes = _download_bytes(url)

        if file_bytes is None:
            writer.append(PdfReader(io.BytesIO(
                _unavailable_page(nombre, "No fue posible descargar el archivo.", studio, numero, total_ref)
            )))
            skipped.append(nombre)
            continue

        if "pdf" in ct:
            try:
                writer.append(PdfReader(io.BytesIO(file_bytes)))
            except Exception:
                writer.append(PdfReader(io.BytesIO(
                    _unavailable_page(nombre, "El archivo PDF está dañado.", studio, numero, total_ref)
                )))
                skipped.append(nombre)

        elif ct.startswith("image/"):
            try:
                writer.append(PdfReader(io.BytesIO(
                    _image_to_pdf(file_bytes, studio, numero, total_ref)
                )))
            except Exception:
                writer.append(PdfReader(io.BytesIO(
                    _unavailable_page(nombre, "No se pudo convertir la imagen.", studio, numero, total_ref)
                )))
                skipped.append(nombre)
        else:
            writer.append(PdfReader(io.BytesIO(
                _unavailable_page(nombre, f"Formato no soportado ({ct or 'desconocido'}).", studio, numero, total_ref)
            )))
            skipped.append(nombre)

    out = io.BytesIO()
    writer.write(out)
    out.seek(0)
    return out.read(), skipped
