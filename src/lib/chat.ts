import { supabase } from "./supabase";

export const CHAT_API_URL = "https://vjotksbiyfeuwgntxsww.supabase.co/functions/v1/chat-api";

export type Emisor = {
  id: string;
  cuit?: string | null;
  razon_social?: string | null;
  condicion_iva?: string | null;
  punto_venta?: number | string | null;
  activo?: boolean;
};

export type ResultadoChat = {
  accion?: string;
  mensaje_para_usuario?: string | null;
  concepto?: string | null;
  importe_neto?: number | null;
  importe_iva?: number | null;
  importe_total?: number | null;
  tipo_comprobante?: string | null;
  receptor?: { cuit?: string | null; dni?: string | null; razon_social?: string | null; condicion_iva?: string | null } | null;
  campos_faltantes?: unknown;
  supuestos?: unknown;
  requiere_confirmacion?: boolean;
  resumen_confirmacion?: string | null;
};

export type RespuestaChat = {
  ok?: boolean;
  conversacion_id?: string;
  resultado?: ResultadoChat;
  error?: string;
  aviso?: string;
  capacidades?: { borrador?: boolean; confirmacion?: boolean; emision?: boolean };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
  let response: Response;
  try {
    response = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error(navigator.onLine
      ? "No pudimos conectar con el servicio. Puede que el dominio de Netlify aún no esté autorizado en Supabase."
      : "No hay conexión a internet.");
  }

  let payload: unknown;
  try { payload = await response.json(); } catch { payload = null; }
  const record = asRecord(payload);
  if (!response.ok || !record || typeof record.error === "string") {
    const message = record && typeof record.error === "string" ? record.error : "";
    if (response.status === 401) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
    if (response.status === 403) throw new Error(message || "El sitio no está autorizado para comunicarse con el servicio.");
    if (response.status === 429) throw new Error(message || "Llegaste al límite temporal. Esperá un minuto.");
    throw new Error(message || `El servicio respondió con un error (${response.status || "respuesta inválida"}).`);
  }
  return record;
}

export async function listarEmisores(): Promise<Emisor[]> {
  const data = await post({ action: "listar_emisores" });
  if (!Array.isArray(data.emisores)) throw new Error("El servicio devolvió una lista de emisores inesperada.");
  return data.emisores.filter((e): e is Emisor => {
    const r = asRecord(e);
    return Boolean(r && typeof r.id === "string" && r.id.length > 0);
  });
}

export async function enviarMensaje(emisorId: string, mensaje: string, conversacionId?: string, nuevaConversacion = false): Promise<RespuestaChat> {
  const data = await post({
    action: "mensaje",
    emisor_id: emisorId,
    mensaje,
    ...(conversacionId ? { conversacion_id: conversacionId } : {}),
    ...(nuevaConversacion ? { nueva_conversacion: true } : {})
  });
  return data as RespuestaChat;
}

export function textoSeguro(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function numeroARS(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value)
    : "A confirmar";
}
