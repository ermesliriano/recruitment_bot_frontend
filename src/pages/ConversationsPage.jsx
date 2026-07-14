import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  getConversationMessages,
  getConversations,
  sendConversationMessage,
} from "../lib/api";

const PLATFORM_LABELS = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  email: "Email",
};

const POLL_MS = 15000;

function initialsOf(name, fallback) {
  const source = (name || fallback || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function formatTime(iso) {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso) {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const today = new Date();
  const sameDay =
    parsed.getDate() === today.getDate() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getFullYear() === today.getFullYear();
  if (sameDay) return formatTime(iso);
  return parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function threadKey(thread) {
  return `${thread.platform}::${thread.chat_id}`;
}

export default function ConversationsPage() {
  const { tenantId } = useAppContext();

  const [threads, setThreads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef(null);
  const selectedRef = useRef(null);
  selectedRef.current = selected;

  const loadThreads = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoadingThreads(true);
      const data = await getConversations(tenantId);
      setThreads(Array.isArray(data?.items) ? data.items : []);
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar las conversaciones.");
    } finally {
      setLoadingThreads(false);
    }
  }, [tenantId]);

  const loadMessages = useCallback(
    async (thread, { silent = false } = {}) => {
      if (!tenantId || !thread) return;
      try {
        if (!silent) setLoadingMessages(true);
        const data = await getConversationMessages(
          tenantId,
          thread.platform,
          thread.chat_id,
          { limit: 200 }
        );
        // Evita pisar el panel si el usuario cambió de hilo mientras cargaba.
        if (
          selectedRef.current &&
          threadKey(selectedRef.current) === threadKey(thread)
        ) {
          setMessages(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (loadError) {
        if (!silent) {
          setError(loadError.message || "No se pudo cargar la conversación.");
        }
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    [tenantId]
  );

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Auto-refresco suave del hilo abierto y del listado.
  useEffect(() => {
    if (!tenantId) return undefined;
    const interval = setInterval(() => {
      loadThreads();
      if (selectedRef.current) {
        loadMessages(selectedRef.current, { silent: true });
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [tenantId, loadThreads, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSelect(thread) {
    setSelected(thread);
    setMessages([]);
    setError("");
    loadMessages(thread);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || !selected || sending) return;

    try {
      setSending(true);
      setError("");
      await sendConversationMessage(tenantId, selected.platform, selected.chat_id, text);
      setDraft("");
      await loadMessages(selected, { silent: true });
      await loadThreads();
    } catch (sendError) {
      setError(sendError.message || "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  function handleDraftKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <section className="card">
        <div className="row-space">
          <div>
            <h1 className="h1">Conversaciones</h1>
            <p className="muted">
              Conversaciones del asistente con los candidatos. Selecciona un
              candidato para ver el historial y escribirle directamente.
            </p>
          </div>
          <div className="row">
            <Link className="btn" to="/dashboard">Dashboard</Link>
          </div>
        </div>
      </section>

      {!tenantId ? (
        <div className="warning-box">
          Selecciona una empresa en el dashboard para ver sus conversaciones.
        </div>
      ) : null}

      {error ? <div className="error-box">{error}</div> : null}

      {tenantId ? (
        <section className="card chat-shell">
          <aside className="chat-sidebar">
            <div className="chat-sidebar-header">
              <span>Candidatos</span>
              <button
                className="btn small"
                type="button"
                onClick={loadThreads}
                disabled={loadingThreads}
              >
                {loadingThreads ? "…" : "⟳"}
              </button>
            </div>
            <div className="chat-thread-list">
              {threads.length === 0 && !loadingThreads ? (
                <p className="muted chat-empty">Aún no hay conversaciones registradas.</p>
              ) : null}
              {threads.map((thread) => {
                const isActive = selected && threadKey(selected) === threadKey(thread);
                const name = thread.candidate_full_name || thread.chat_id;
                return (
                  <button
                    key={threadKey(thread)}
                    type="button"
                    className={`chat-thread${isActive ? " active" : ""}`}
                    onClick={() => handleSelect(thread)}
                  >
                    <span className="chat-avatar">{initialsOf(thread.candidate_full_name, thread.chat_id)}</span>
                    <span className="chat-thread-info">
                      <span className="chat-thread-top">
                        <span className="chat-thread-name">{name}</span>
                        <span className="chat-thread-time">{formatDay(thread.last_message_at)}</span>
                      </span>
                      <span className="chat-thread-preview">
                        {thread.last_message_direction === "out" ? "Tú: " : ""}
                        {thread.last_message_type !== "text" && !thread.last_message_text
                          ? "📎 Adjunto"
                          : thread.last_message_text || "—"}
                      </span>
                      <span className="chat-thread-channel">
                        {PLATFORM_LABELS[thread.platform] || thread.platform}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="chat-main">
            {!selected ? (
              <div className="chat-placeholder muted">
                Selecciona una conversación para ver el historial.
              </div>
            ) : (
              <>
                <div className="chat-header">
                  <span className="chat-avatar">{initialsOf(selected.candidate_full_name, selected.chat_id)}</span>
                  <div>
                    <div className="chat-header-name">
                      {selected.candidate_full_name || selected.chat_id}
                    </div>
                    <div className="chat-header-meta muted">
                      {PLATFORM_LABELS[selected.platform] || selected.platform}
                      {selected.candidate_phone ? ` · ${selected.candidate_phone}` : ""}
                    </div>
                  </div>
                </div>

                <div className="chat-messages">
                  {loadingMessages ? (
                    <p className="muted chat-empty">Cargando conversación...</p>
                  ) : null}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`chat-bubble-row ${message.direction === "out" ? "out" : "in"}`}
                    >
                      <div className={`chat-bubble ${message.direction === "out" ? "out" : "in"}`}>
                        {message.type !== "text" && message.attachment_filename ? (
                          <div className="chat-attachment">📎 {message.attachment_filename}</div>
                        ) : null}
                        {message.text ? (
                          <div className="chat-bubble-text">{message.text}</div>
                        ) : null}
                        <div className="chat-bubble-time">{formatTime(message.created_at)}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="chat-composer">
                  <textarea
                    className="input chat-composer-input"
                    rows={1}
                    placeholder="Escribe un mensaje..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleDraftKeyDown}
                    disabled={sending}
                  />
                  <button
                    className="btn primary"
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                  >
                    {sending ? "…" : "Enviar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}
