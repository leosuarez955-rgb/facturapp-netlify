import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Building2, CheckCircle2, CircleAlert, LogOut, MessageCircle, Send, ShieldCheck, Sparkles, UserRound, LoaderCircle, FileText } from "lucide-react";
import { configReady, supabase } from "./lib/supabase";
import { Emisor, RespuestaChat, enviarMensaje, listarEmisores, numeroARS, textoSeguro } from "./lib/chat";

type ChatLine = { id: string; role: "user" | "assistant" | "error"; text: string; response?: RespuestaChat };
type AuthMode = "login" | "signup" | "reset";

function getError(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado. Probá nuevamente.";
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (!configReady) throw new Error("Falta configurar VITE_SUPABASE_ANON_KEY en las variables de entorno.");
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) setMessage("Cuenta creada. Revisá tu correo para confirmar el registro.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) throw error;
        setMessage("Si el correo está registrado, recibirás instrucciones para recuperar el acceso.");
      }
    } catch (err) { setError(getError(err)); }
    finally { setBusy(false); }
  }

  return <main className="auth-shell">
    <section className="auth-card">
      <div className="brand-mark"><Sparkles size={23} /></div>
      <p className="eyebrow">ASISTENTE DE FACTURACIÓN</p>
      <h1>Facturapp</h1>
      <p className="muted">Prepará borradores de facturación con ayuda conversacional.</p>
      <div className="auth-tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>Ingresar</button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>Crear cuenta</button>
      </div>
      <form onSubmit={submit} className="form-stack">
        <label>Correo electrónico<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@comercio.com" /></label>
        {mode !== "reset" && <label>Contraseña<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} value={password} onChange={e => setPassword(e.target.value)} required /></label>}
        {error && <div className="notice error"><CircleAlert size={17}/><span>{error}</span></div>}
        {message && <div className="notice success"><CheckCircle2 size={17}/><span>{message}</span></div>}
        <button className="primary-btn full" disabled={busy || !configReady}>{busy ? <LoaderCircle className="spin" size={18}/> : null}{mode === "login" ? "Ingresar" : mode === "signup" ? "Crear cuenta" : "Enviar instrucciones"}</button>
      </form>
      {mode === "login" && <button className="text-btn" onClick={() => { setMode("reset"); setError(""); setMessage(""); }}>Olvidé mi contraseña</button>}
      {mode === "reset" && <button className="text-btn" onClick={() => setMode("login")}>Volver a ingresar</button>}
      <div className="security-note"><ShieldCheck size={16}/> Acceso protegido por Supabase Auth</div>
    </section>
  </main>;
}

function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>(null);
  const [emisores, setEmisores] = useState<Emisor[]>([]);
  const [emisorId, setEmisorId] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [loadingEmisores, setLoadingEmisores] = useState(false);
  const [sending, setSending] = useState(false);
  const [screenError, setScreenError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setSessionReady(true); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setSessionReady(true); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) { setEmisores([]); setEmisorId(""); return; }
    let active = true;
    setLoadingEmisores(true); setScreenError("");
    listarEmisores().then(items => {
      if (!active) return;
      setEmisores(items);
      setEmisorId(current => items.some(e => e.id === current) ? current : (items[0]?.id ?? ""));
      if (!items.length) setScreenError("Tu cuenta no tiene emisores activos asignados. Contactá al administrador de Facturapp.");
    }).catch(err => { if (active) setScreenError(getError(err)); })
      .finally(() => { if (active) setLoadingEmisores(false); });
    return () => { active = false; };
  }, [session?.access_token]);

  useEffect(() => {
    // No se usa scrollIntoView: puede no estar disponible en ciertos navegadores/webviews.
    if (endRef.current) endRef.current.scrollTop = endRef.current.scrollHeight;
  }, [lines, sending]);

  async function send(textOverride?: string) {
    const message = (textOverride ?? draft).trim();
    if (!message || !emisorId || sending) return;
    setDraft(""); setSending(true); setScreenError("");
    const userLine: ChatLine = { id: crypto.randomUUID(), role: "user", text: message };
    setLines(prev => [...prev, userLine]);
    try {
      const result = await enviarMensaje(emisorId, message, conversationId);
      if (result.conversacion_id) setConversationId(result.conversacion_id);
      const parsed = result.resultado;
      const assistantText = textoSeguro(parsed?.mensaje_para_usuario, "Recibí la respuesta, pero no contiene un mensaje legible.");
      setLines(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", text: assistantText, response: result }]);
    } catch (err) {
      setLines(prev => [...prev, { id: crypto.randomUUID(), role: "error", text: getError(err) }]);
    } finally { setSending(false); }
  }

  async function logout() { await supabase.auth.signOut(); setLines([]); setConversationId(undefined); }

  if (!sessionReady) return <div className="loading-screen"><LoaderCircle className="spin" size={28}/> Cargando Facturapp…</div>;
  if (!session) return <AuthScreen />;

  const currentEmisor = emisores.find(e => e.id === emisorId);
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark small"><Sparkles size={19}/></div><div><strong>Facturapp</strong><span>Asistente de facturación</span></div></div>
      <div className="top-actions"><span className="connection"><span className="dot"/> Supabase conectado</span><button className="icon-btn" title="Cerrar sesión" onClick={logout}><LogOut size={18}/></button></div>
    </header>
    <main className="workspace">
      <aside className="sidebar">
        <div className="side-heading"><Building2 size={18}/><span>Emisor</span></div>
        {loadingEmisores ? <div className="skeleton"><span/><span/></div> :
          <select value={emisorId} onChange={e => { setEmisorId(e.target.value); setLines([]); setConversationId(undefined); }} disabled={!emisores.length} aria-label="Seleccionar emisor">
            {emisores.length ? emisores.map(e => <option key={e.id} value={e.id}>{e.razon_social || "Emisor"}{e.cuit ? ` · ${e.cuit}` : ""}</option>) : <option value="">Sin emisores disponibles</option>}
          </select>}
        {currentEmisor && <div className="issuer-card"><span className="issuer-label">CUIT</span><strong>{currentEmisor.cuit || "No informado"}</strong><span className="issuer-label">CONDICIÓN IVA</span><strong>{currentEmisor.condicion_iva || "No informada"}</strong><span className="issuer-label">PUNTO DE VENTA</span><strong>{currentEmisor.punto_venta ?? "No informado"}</strong></div>}
        <div className="side-tip"><ShieldCheck size={17}/><p>Los emisores se consultan con tu sesión y solo se muestran los que pertenecen a tu cuenta.</p></div>
        <button className="outline-btn" onClick={() => { setLines([]); setConversationId(undefined); }}>Nueva conversación</button>
      </aside>
      <section className="chat-panel">
        <div className="chat-heading"><div className="heading-icon"><MessageCircle size={20}/></div><div><h2>Asistente de facturación</h2><p>Describí la operación que necesitás preparar.</p></div><span className="status-pill"><span className="dot"/> En línea</span></div>
        {screenError && <div className="notice error global-notice"><CircleAlert size={18}/><span>{screenError}</span><button className="text-btn" onClick={() => { setScreenError(""); setLoadingEmisores(true); listarEmisores().then(setEmisores).catch(e => setScreenError(getError(e))).finally(() => setLoadingEmisores(false)); }}>Reintentar</button></div>}
        <div className="messages" ref={endRef} role="log" aria-live="polite">
          {!lines.length && <div className="welcome"><div className="welcome-icon"><Bot size={30}/></div><h3>¿Qué necesitás facturar?</h3><p>Contame la operación en lenguaje natural. Te ayudaré a reunir los datos para un borrador.</p><div className="quick-actions">{["Preparar una factura","Consultar datos necesarios","Hacer una nota de crédito"].map(text => <button key={text} onClick={() => void send(text)} disabled={!emisorId || sending}>{text}</button>)}</div></div>}
          {lines.map(line => <div key={line.id} className={`message-row ${line.role}`}>
            <div className="avatar">{line.role === "user" ? <UserRound size={17}/> : line.role === "error" ? <CircleAlert size={17}/> : <Bot size={18}/>}</div>
            <div className="message-content"><div className="bubble">{line.text}</div>
              {line.response?.resultado && <DraftCard response={line.response}/>}
            </div>
          </div>)}
          {sending && <div className="message-row assistant"><div className="avatar"><Bot size={18}/></div><div className="bubble typing"><span/><span/><span/></div></div>}
        </div>
        <form className="composer" onSubmit={e => { e.preventDefault(); void send(); }}>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Escribí o dictá tu factura aquí…" rows={1} maxLength={4000} disabled={!emisorId || sending} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <button className="send-btn" type="submit" aria-label="Enviar mensaje" disabled={!draft.trim() || !emisorId || sending}><Send size={18}/></button>
        </form>
        <p className="disclaimer"><ShieldCheck size={14}/> Solo prepara borradores. No autoriza ni emite comprobantes ante ARCA.</p>
      </section>
    </main>
  </div>;
}

function DraftCard({ response }: { response: RespuestaChat }) {
  const result = response.resultado;
  if (!result || typeof result !== "object") return null;
  const receptor = result.receptor && typeof result.receptor === "object" ? result.receptor : {};
  const missing = Array.isArray(result.campos_faltantes) ? result.campos_faltantes.filter((v): v is string => typeof v === "string") : [];
  return <div className="draft-card">
    <div className="draft-title"><FileText size={18}/><strong>Borrador preliminar</strong><span className="draft-tag">No emitido</span></div>
    <div className="draft-grid"><div><span>Comprobante</span><strong>{textoSeguro(result.tipo_comprobante, "A definir")}</strong></div><div><span>Concepto</span><strong>{textoSeguro(result.concepto, "A definir")}</strong></div><div><span>Receptor</span><strong>{textoSeguro(receptor.razon_social, "A definir")}</strong><small>{textoSeguro(receptor.cuit || receptor.dni, "CUIT/DNI pendiente")}</small></div></div>
    <div className="amount-row"><span>Total estimado</span><strong>{numeroARS(result.importe_total)}</strong></div>
    {missing.length > 0 && <div className="missing"><strong>Datos pendientes</strong><ul>{missing.slice(0, 8).map((v, i) => <li key={`${v}-${i}`}>{v}</li>)}</ul></div>}
    <div className="draft-footer"><span><ShieldCheck size={15}/> Revisión necesaria</span><button disabled title="La autorización de comprobantes está deshabilitada">Autorizar en ARCA · Deshabilitado</button></div>
  </div>;
}

export default App;