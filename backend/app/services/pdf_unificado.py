"""
PDF unificado ejecutivo del expediente.
Estructura: banda navy alta → número+carátula → 3 cards (Expediente / Cliente / Equipo)
Header/footer en todas las páginas.
"""
import io
from datetime import datetime
from typing import Optional

import httpx
from fpdf import FPDF
from pypdf import PdfReader, PdfWriter

# ── Layout ────────────────────────────────────────────────────────────────────
PLACEHOLDER = "-"
MAX_DOCS    = 30
PAGE_W      = 210
PAGE_H      = 297
MARGIN      = 18
CW          = PAGE_W - MARGIN * 2   # content width = 174

# ── Paleta ────────────────────────────────────────────────────────────────────
NAVY        = (22,  45,  85)
BRAND       = (37,  99, 235)
LIGHT_GRAY  = (243, 244, 246)
MID_GRAY    = (107, 114, 128)
DARK        = (17,  24,  39)
WHITE       = (255, 255, 255)
AMBER       = (180, 100,  10)

ESTADO_COLOR = {
    "activo":    (22, 163, 74),
    "archivado": (107, 114, 128),
    "cerrado":   (220, 38,  38),
}

ROL_LABEL = {
    "responsable":  "Responsable",
    "colaborador":  "Colaborador",
    "supervision":  "Supervision",
}

MESES = ["enero","febrero","marzo","abril","mayo","junio",
         "julio","agosto","septiembre","octubre","noviembre","diciembre"]


def _fecha_larga(dt: datetime) -> str:
    return f"{dt.day} de {MESES[dt.month - 1]} de {dt.year}"


def _safe(text: str) -> str:
    """Elimina caracteres fuera de latin-1 para compatibilidad con fuentes Helvetica de fpdf2."""
    return text.encode("latin-1", errors="replace").decode("latin-1")


def _val(v) -> str:
    raw = str(v).strip() if v and str(v).strip() else PLACEHOLDER
    return _safe(raw)


# ── Base FPDF: header/footer en páginas de contenido ─────────────────────────

class LexPDF(FPDF):
    def __init__(self, studio_name: str, numero: str, total_ref: list):
        super().__init__()
        self.studio_name = studio_name
        self.numero      = numero
        self.total_ref   = total_ref
        self.set_auto_page_break(auto=True, margin=16)

    def header(self):
        self.set_fill_color(*NAVY)
        self.rect(0, 0, PAGE_W, 11, "F")
        self.set_y(3)
        self.set_font("Helvetica", "B", 7.5)
        self.set_text_color(*WHITE)
        self.set_x(MARGIN)
        self.cell(CW / 2, 5, self.studio_name.upper(), align="L")
        self.set_font("Helvetica", "", 7)
        self.set_x(MARGIN + CW / 2)
        self.cell(CW / 2, 5, self.numero, align="R")
        self.set_text_color(*DARK)

    def footer(self):
        self.set_draw_color(*BRAND)
        self.set_line_width(0.4)
        self.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12)
        self.set_y(PAGE_H - 11)
        self.set_font("Helvetica", "", 6.5)
        self.set_text_color(*MID_GRAY)
        self.set_x(MARGIN)
        self.cell(CW / 2, 5, "Generado con LexCore - lexcore.app", align="L")
        total = self.total_ref[0] if self.total_ref[0] else "?"
        self.set_x(MARGIN + CW / 2)
        self.cell(CW / 2, 5, f"Pag. {self.page_no()} / {total}", align="R")
        self.set_text_color(*DARK)


# ── Helper: card con título navy y filas alternadas ───────────────────────────

def _data_card(pdf: FPDF, title: str, rows: list[tuple[str, str]],
               x: float, y: float, w: float, label_w: float = 32) -> float:
    row_h = 6.5
    # Header
    pdf.set_xy(x, y)
    pdf.set_fill_color(*NAVY)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.cell(w, 7, f"  {title}", fill=True)
    card_y = y + 7
    # Filas
    for i, (lbl, val) in enumerate(rows):
        ry = card_y + i * row_h
        pdf.set_xy(x, ry)
        pdf.set_fill_color(*LIGHT_GRAY if i % 2 == 0 else WHITE)
        pdf.cell(w, row_h, "", fill=True)
        pdf.set_xy(x + 3, ry + 0.8)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(*MID_GRAY)
        pdf.cell(label_w, row_h - 1, lbl)
        pdf.set_font("Helvetica", "", 7.5)
        pdf.set_text_color(*DARK)
        # Truncar valores muy largos
        display_val = val if len(val) <= 38 else val[:36] + "…"
        pdf.cell(w - label_w - 4, row_h - 1, display_val, align="R")
    # Borde + accent izquierdo
    total_h = 7 + len(rows) * row_h
    pdf.set_draw_color(*LIGHT_GRAY)
    pdf.set_line_width(0.3)
    pdf.rect(x, y, w, total_h)
    pdf.set_draw_color(*BRAND)
    pdf.set_line_width(1.2)
    pdf.line(x, y, x, y + total_h)
    pdf.set_line_width(0.2)
    return y + total_h


# ── Carátula ──────────────────────────────────────────────────────────────────

def _build_caratula(exp_data: dict, docs_count: int) -> bytes:
    total_ref = [0]
    studio    = exp_data.get("studio_name") or "LexCore"
    numero    = exp_data["numero"]

    pdf = FPDF()   # carátula sin header/footer automático — los dibujamos manualmente
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()

    # ── BANDA SUPERIOR NAVY (alta) ────────────────────────────────────────────
    band_h = 38
    pdf.set_fill_color(*NAVY)
    pdf.rect(0, 0, PAGE_W, band_h, "F")

    # Nombre del estudio — grande y centrado en la banda
    pdf.set_xy(MARGIN, 8)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*WHITE)
    pdf.cell(CW, 10, studio.upper(), align="L")

    # Contacto debajo del nombre
    contacto = []
    if exp_data.get("studio_email"):
        contacto.append(exp_data["studio_email"])
    if exp_data.get("studio_telefono"):
        contacto.append(exp_data["studio_telefono"])
    pdf.set_xy(MARGIN, 20)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(180, 200, 240)
    pdf.cell(CW, 6, "  |  ".join(contacto) if contacto else "lexcore.app", align="L")

    # Línea accent al pie de la banda
    pdf.set_draw_color(*BRAND)
    pdf.set_line_width(1.5)
    pdf.line(0, band_h, PAGE_W, band_h)

    # ── NÚMERO + CARÁTULA ─────────────────────────────────────────────────────
    y = band_h + 10
    pdf.set_xy(MARGIN, y)
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(*NAVY)
    pdf.cell(CW - 30, 12, numero, align="L")

    # Badge estado — alineado a la derecha del número
    estado       = (exp_data.get("estado") or "").lower()
    badge_color  = ESTADO_COLOR.get(estado, MID_GRAY)
    badge_label  = estado.upper() or "—"
    pdf.set_xy(PAGE_W - MARGIN - 28, y + 2)
    pdf.set_fill_color(*badge_color)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.cell(28, 7, badge_label, fill=True, align="C")

    # Carátula (texto completo, puede ser largo)
    y += 13
    pdf.set_xy(MARGIN, y)
    pdf.set_font("Helvetica", "", 13)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(CW, 7, exp_data["caratula"])
    y = pdf.get_y() + 4

    # Línea separadora fina
    pdf.set_draw_color(*LIGHT_GRAY)
    pdf.set_line_width(0.4)
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y)
    y += 8

    # ── CARDS: Expediente | Cliente ───────────────────────────────────────────
    col_w = (CW - 5) / 2

    rows_exp = [
        ("Nº judicial",  _val(exp_data.get("numero_judicial"))),
        ("Fuero",        _val(exp_data.get("fuero"))),
        ("Juzgado",      _val(exp_data.get("juzgado"))),
        ("Localidad",    _val(exp_data.get("localidad"))),
        ("Apertura",     _val(exp_data.get("fecha_apertura"))),
    ]

    cliente = exp_data.get("cliente") or {}
    rows_cli = [
        ("Nombre",    _val(cliente.get("nombre"))),
        ("Tipo",      _val(cliente.get("tipo"))),
        ("DNI",       _val(cliente.get("dni"))),
        ("CUIT",      _val(cliente.get("cuit"))),
        ("Teléfono",  _val(cliente.get("telefono"))),
        ("Email",     _val(cliente.get("email"))),
        ("Domicilio", _val(cliente.get("domicilio"))),
    ]

    end_exp = _data_card(pdf, "EXPEDIENTE", rows_exp, MARGIN,          y, col_w)
    end_cli = _data_card(pdf, "CLIENTE",    rows_cli, MARGIN + col_w + 5, y, col_w)
    y = max(end_exp, end_cli) + 6

    # ── CARD: Equipo ──────────────────────────────────────────────────────────
    equipo = exp_data.get("equipo") or []
    if not equipo:
        equipo = [{"nombre": "—", "rol": "responsable"}]
    rows_eq = [(ROL_LABEL.get(m["rol"], m["rol"].capitalize()), _val(m["nombre"])) for m in equipo]
    end_eq = _data_card(pdf, "EQUIPO", rows_eq, MARGIN, y, CW, label_w=40)
    y = end_eq + 8

    # ── PIE DE GENERACIÓN ─────────────────────────────────────────────────────
    pdf.set_draw_color(*LIGHT_GRAY)
    pdf.set_line_width(0.3)
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y)
    y += 5
    now  = datetime.now()
    hora = now.strftime("%H:%M")
    pdf.set_xy(MARGIN, y)
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(*MID_GRAY)
    autor = _val(exp_data.get("autor_nombre"))
    pdf.cell(CW, 5,
        f"Generado por {autor}  |  {_fecha_larga(now)} a las {hora}  |  {docs_count} documento{'s' if docs_count != 1 else ''} incluido{'s' if docs_count != 1 else ''}",
        align="L")

    if docs_count == MAX_DOCS:
        pdf.set_xy(MARGIN, y + 5)
        pdf.set_font("Helvetica", "I", 7)
        pdf.set_text_color(*AMBER)
        pdf.cell(CW, 5, f"Nota: se incluyen los primeros {MAX_DOCS} documentos (límite v1).")

    # ── BANDA INFERIOR NAVY ───────────────────────────────────────────────────
    foot_y = PAGE_H - 18
    pdf.set_fill_color(*NAVY)
    pdf.rect(0, foot_y, PAGE_W, 18, "F")
    pdf.set_xy(MARGIN, foot_y + 6)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*WHITE)
    pdf.cell(CW / 2, 5, studio.upper(), align="L")
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_x(MARGIN + CW / 2)
    pdf.cell(CW / 2, 5, "Generado con LexCore - lexcore.app", align="R")

    total_ref[0] = pdf.page
    return pdf.output()


# ── Separador ─────────────────────────────────────────────────────────────────

def _separator_page(index: int, total: int, nombre: str,
                    studio: str, numero: str, total_ref: list) -> bytes:
    pdf = LexPDF(studio, numero, total_ref)
    pdf.add_page()
    mid = PAGE_H / 2
    pdf.set_fill_color(*BRAND)
    pdf.rect(0, mid - 20, PAGE_W, 40, "F")
    pdf.set_y(mid - 13)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(180, 210, 255)
    pdf.cell(0, 6, f"Documento {index} de {total}", align="C", ln=True)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*WHITE)
    pdf.multi_cell(0, 8, nombre, align="C")
    return pdf.output()


# ── Página de aviso ───────────────────────────────────────────────────────────

def _unavailable_page(nombre: str, motivo: str,
                      studio: str, numero: str, total_ref: list) -> bytes:
    pdf = LexPDF(studio, numero, total_ref)
    pdf.add_page()
    bx, bw = MARGIN + 20, CW - 40
    by = PAGE_H / 2 - 16
    pdf.set_fill_color(255, 247, 237)
    pdf.set_draw_color(*AMBER)
    pdf.set_line_width(0.5)
    pdf.rect(bx, by, bw, 32, "FD")
    pdf.set_xy(bx, by + 7)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*AMBER)
    pdf.cell(bw, 6, "Documento no incluido", align="C", ln=True)
    pdf.set_xy(bx, pdf.get_y())
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(60, 40, 0)
    pdf.multi_cell(bw, 5, f"{nombre}\n{motivo}", align="C")
    return pdf.output()


# ── Imagen → PDF ──────────────────────────────────────────────────────────────

def _image_to_pdf(img_bytes: bytes, studio: str, numero: str, total_ref: list) -> bytes:
    from PIL import Image
    img   = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    max_w = CW
    max_h = PAGE_H - 30
    iw    = min(max_w, img.width * 25.4 / 96)
    ih    = iw * img.height / img.width
    if ih > max_h:
        ih = max_h
        iw = ih * img.width / img.height
    pdf = LexPDF(studio, numero, total_ref)
    pdf.add_page()
    tmp = io.BytesIO()
    img.save(tmp, format="JPEG", quality=85)
    tmp.seek(0)
    pdf.image(tmp, x=(PAGE_W - iw) / 2, y=(PAGE_H - ih) / 2, w=iw, h=ih)
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
    docs       = sorted(documentos, key=lambda d: d["orden"])[:MAX_DOCS]
    docs_count = len(docs)
    numero     = exp_data["numero"]
    studio     = exp_data.get("studio_name") or "LexCore"
    total_ref  = [0]

    writer = PdfWriter()
    writer.append(PdfReader(io.BytesIO(_build_caratula(exp_data, docs_count))))

    skipped = []

    for i, doc in enumerate(docs, start=1):
        nombre = doc["nombre"]
        ct     = (doc.get("content_type") or "").lower()

        writer.append(PdfReader(io.BytesIO(
            _separator_page(i, docs_count, nombre, studio, numero, total_ref)
        )))

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
