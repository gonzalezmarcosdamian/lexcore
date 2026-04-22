"use client";

import Link from "next/link";
import { Vencimiento, Tarea, Expediente } from "@/lib/api";

// ── helpers ───────────────────────────────────────────────────────────────────

const today = new Date().toISOString().split("T")[0];

function formatFechaLarga(fecha: string) {
  const d = new Date(fecha + "T12:00:00");
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function esVencida(fecha: string) { return fecha < today; }
function esUrgente(fecha: string) {
  const diff = new Date(fecha).getTime() - Date.now();
  return diff >= 0 && diff < 48 * 3600 * 1000;
}

const TIPO_LABEL: Record<string, string> = {
  judicial: "⚖️ Judicial", extrajudicial: "🤝 Extrajudicial",
  administrativa: "🏢 Administrativa", operativa: "🔧 Operativa",
  vencimiento: "Vencimiento", audiencia: "Audiencia",
  presentacion: "Presentación", pericia: "Pericia", otro: "Otro",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs font-semibold text-ink-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-ink-800 flex-1">{children}</span>
    </div>
  );
}

function ModalShell({ onClose, onEdit, children, title, accentColor }: {
  onClose: () => void;
  onEdit: () => void;
  children: React.ReactNode;
  title: string;
  accentColor: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between ${accentColor}`}>
          <span className="text-sm font-semibold text-white">{title}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              title="Editar"
              className="flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
              </svg>
              Editar
            </button>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none transition">×</button>
          </div>
        </div>
        {/* Body */}
        <div className="px-5 py-5 space-y-3.5">
          {children}
        </div>
        {/* Mobile handle */}
        <div className="h-5 sm:hidden" />
      </div>
    </div>
  );
}

// ── VencimientoDetailModal ────────────────────────────────────────────────────

export function VencimientoDetailModal({
  v, exp, onClose, onEdit,
}: {
  v: Vencimiento;
  exp?: Expediente;
  onClose: () => void;
  onEdit: () => void;
}) {
  const vencida = esVencida(v.fecha) && !v.cumplido;
  const urgente = esUrgente(v.fecha) && !v.cumplido;

  return (
    <ModalShell
      title="Vencimiento"
      accentColor={v.cumplido ? "bg-green-600" : vencida ? "bg-red-600" : urgente ? "bg-amber-500" : "bg-purple-600"}
      onClose={onClose}
      onEdit={() => { onClose(); onEdit(); }}
    >
      <div>
        <p className="text-base font-bold text-ink-900 leading-snug">{v.descripcion}</p>
        {(vencida || urgente) && (
          <span className={`inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
            vencida ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
          }`}>
            {vencida ? "Vencido" : "⚡ Urgente"}
          </span>
        )}
      </div>

      <div className="space-y-2.5 pt-1 border-t border-ink-50">
        <Row label="Estado">
          <span className={`font-semibold ${v.cumplido ? "text-green-600" : "text-amber-600"}`}>
            {v.cumplido ? "✓ Cumplido" : "Pendiente"}
          </span>
        </Row>
        <Row label="Fecha">
          <span className={vencida ? "text-red-600 font-semibold" : ""}>
            {formatFechaLarga(v.fecha)}
            {(v as any).hora ? <span className="ml-2 text-ink-400">· {(v as any).hora}</span> : ""}
          </span>
        </Row>
        <Row label="Tipo">{TIPO_LABEL[v.tipo] ?? v.tipo}</Row>
        {exp ? (
          <Row label="Expediente">
            <Link href={`/expedientes/${exp.id}`} onClick={onClose} className="text-brand-600 hover:underline font-medium">
              {exp.numero}{exp.cliente_nombre ? ` · ${exp.cliente_nombre}` : ""}
            </Link>
          </Row>
        ) : v.expediente_id ? (
          <Row label="Expediente">
            <Link href={`/expedientes/${v.expediente_id}`} onClick={onClose} className="text-brand-600 hover:underline font-medium">
              Ver expediente →
            </Link>
          </Row>
        ) : null}
      </div>
    </ModalShell>
  );
}

// ── TareaDetailModal ──────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "text-ink-500" },
  en_curso:  { label: "En curso",  color: "text-blue-600" },
  hecha:     { label: "✓ Hecha",   color: "text-green-600" },
};

export function TareaDetailModal({
  t, exp, onClose, onEdit,
}: {
  t: Tarea;
  exp?: Expediente;
  onClose: () => void;
  onEdit: () => void;
}) {
  const vencida = t.fecha_limite && esVencida(t.fecha_limite) && t.estado !== "hecha";
  const estado = ESTADO_LABEL[t.estado] ?? { label: t.estado, color: "text-ink-500" };

  return (
    <ModalShell
      title="Tarea"
      accentColor={t.estado === "hecha" ? "bg-green-600" : vencida ? "bg-red-600" : t.estado === "en_curso" ? "bg-blue-600" : "bg-ink-700"}
      onClose={onClose}
      onEdit={() => { onClose(); onEdit(); }}
    >
      <div>
        <p className={`text-base font-bold leading-snug ${t.estado === "hecha" ? "line-through text-ink-400" : "text-ink-900"}`}>
          {t.titulo}
        </p>
        {vencida && (
          <span className="inline-block mt-1 text-[10px] font-bold uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            Vencida
          </span>
        )}
      </div>

      <div className="space-y-2.5 pt-1 border-t border-ink-50">
        <Row label="Estado">
          <span className={`font-semibold ${estado.color}`}>{estado.label}</span>
        </Row>
        <Row label="Tipo">{TIPO_LABEL[t.tipo] ?? t.tipo}</Row>
        {t.fecha_limite && (
          <Row label="Fecha límite">
            <span className={vencida ? "text-red-600 font-semibold" : ""}>
              {formatFechaLarga(t.fecha_limite)}
              {(t as any).hora ? <span className="ml-2 text-ink-400">· {(t as any).hora}</span> : ""}
            </span>
          </Row>
        )}
        {t.responsable_nombre && (
          <Row label="Responsable">{t.responsable_nombre}</Row>
        )}
        {exp ? (
          <Row label="Expediente">
            <Link href={`/expedientes/${exp.id}`} onClick={onClose} className="text-brand-600 hover:underline font-medium">
              {exp.numero}{exp.cliente_nombre ? ` · ${exp.cliente_nombre}` : ""}
            </Link>
          </Row>
        ) : t.expediente_id ? (
          <Row label="Expediente">
            <Link href={`/expedientes/${t.expediente_id}`} onClick={onClose} className="text-brand-600 hover:underline font-medium">
              Ver expediente →
            </Link>
          </Row>
        ) : null}
        {(t as any).descripcion && (
          <Row label="Notas">
            <span className="text-ink-600 whitespace-pre-line">{(t as any).descripcion}</span>
          </Row>
        )}
      </div>
    </ModalShell>
  );
}
