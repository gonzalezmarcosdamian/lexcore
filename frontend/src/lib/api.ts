const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
  params?: Record<string, string | number | boolean | undefined>;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }

  let url = `${API_URL}${path}`;
  if (opts.params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    }
    const str = qs.toString();
    if (str) url += `?${str}`;
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Error desconocido" }));
    throw new Error(error.detail ?? "Error del servidor");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, token?: string, params?: RequestOptions["params"]) =>
    request<T>(path, { token, params }),
  post: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: "POST", body, token }),
  patch: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: "PATCH", body, token }),
  delete: <T>(path: string, token?: string) =>
    request<T>(path, { method: "DELETE", token }),
};

// ── Types ────────────────────────────────────────────────────────────────────

export type TipoCliente = "fisica" | "juridica";
export type EstadoExpediente = "activo" | "archivado" | "cerrado";
export type RolEnExpediente = "responsable" | "colaborador" | "supervision";
export type UserRole = "admin" | "socio" | "asociado" | "pasante";

export interface Cliente {
  id: string;
  tenant_id: string;
  nombre: string;
  tipo: TipoCliente;
  cuit_dni?: string;
  telefono?: string;
  email?: string;
  archivado: boolean;
  created_at: string;
  updated_at: string;
}

export interface AbogadoEnExpediente {
  id: string;
  user_id: string;
  rol: RolEnExpediente;
  full_name?: string;
}

export interface Expediente {
  id: string;
  tenant_id: string;
  numero: string;
  caratula: string;
  fuero?: string;
  juzgado?: string;
  estado: EstadoExpediente;
  cliente_id?: string;
  created_at: string;
  updated_at: string;
  abogados: AbogadoEnExpediente[];
}

export interface Movimiento {
  id: string;
  expediente_id: string;
  user_id: string;
  texto: string;
  created_at: string;
}

export interface Vencimiento {
  id: string;
  tenant_id: string;
  expediente_id: string;
  descripcion: string;
  fecha: string;
  tipo: string;
  cumplido: boolean;
  google_event_ids?: string;
  created_at: string;
  updated_at: string;
}

export type Moneda = "ARS" | "USD";

export interface PagoHonorario {
  id: string;
  honorario_id: string;
  importe: number;
  moneda: Moneda;
  fecha: string;
  comprobante?: string;
  tipo: "capital" | "interes";
  created_at: string;
}

export interface Honorario {
  id: string;
  tenant_id: string;
  expediente_id: string;
  concepto: string;
  monto_acordado: number;
  moneda: Moneda;
  fecha_acuerdo: string;
  notas?: string;
  pagos: PagoHonorario[];
  total_pagado: number;
  total_capital: number;
  total_intereses: number;
  saldo_pendiente: number;
  created_at: string;
  updated_at: string;
}

export interface HonorarioResumen {
  total_acordado_ars: number;
  total_acordado_usd: number;
  total_cobrado_ars: number;
  total_cobrado_usd: number;
  saldo_pendiente_ars: number;
  saldo_pendiente_usd: number;
  expedientes_con_deuda: number;
}

export interface SearchResult {
  expedientes: Array<{ id: string; numero: string; caratula: string; estado: string; fuero?: string }>;
  clientes: Array<{ id: string; nombre: string; tipo: string; cuit_dni?: string }>;
}

export interface StudioUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  auth_provider: string;
  created_at: string;
}

export interface Documento {
  id: string;
  expediente_id: string;
  nombre: string;
  descripcion?: string | null;
  file_key: string;
  size_bytes: number;
  content_type: string;
  uploaded_by: string;
  created_at: string;
}

export type GastoCategoria = "alquiler" | "sueldos" | "servicios" | "costos_judiciales" | "honorarios_terceros" | "otros";
export type GastoEstado = "pendiente" | "confirmado";

export interface Gasto {
  id: string;
  tenant_id: string;
  descripcion: string;
  categoria: GastoCategoria;
  monto: number;
  moneda: Moneda;
  fecha: string;
  mes: number;
  anio: number;
  estado: GastoEstado;
  expediente_id?: string;
  plantilla_id?: string;
  notas?: string;
  created_at: string;
  updated_at: string;
}

export interface GastoPlantilla {
  id: string;
  descripcion: string;
  categoria: GastoCategoria;
  monto_esperado: number;
  moneda: Moneda;
  dia_del_mes: number;
  activa: boolean;
  notas?: string;
}

export interface GastoResumen {
  total_ars: number;
  total_usd: number;
  cantidad: number;
}

export type IngresoCategoria = "honorarios_cobrados" | "reintegros" | "consultas" | "otros";

export interface Ingreso {
  id: string;
  tenant_id: string;
  descripcion: string;
  categoria: IngresoCategoria;
  monto: number;
  moneda: Moneda;
  fecha: string;
  mes: number;
  anio: number;
  expediente_id?: string;
  notas?: string;
  created_at: string;
  updated_at: string;
}

export interface IngresoResumen {
  total_ars: number;
  total_usd: number;
  cantidad: number;
}

export type TareaEstado = "pendiente" | "en_curso" | "hecha";

export interface Tarea {
  id: string;
  tenant_id: string;
  expediente_id: string;
  titulo: string;
  descripcion?: string | null;
  responsable_id?: string | null;
  responsable_nombre?: string | null;
  fecha_limite?: string | null;
  estado: TareaEstado;
  created_at: string;
  updated_at: string;
}

export interface Invitacion {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  rol: UserRole;
  usado: boolean;
  expires_at: string;
  created_at: string;
}
