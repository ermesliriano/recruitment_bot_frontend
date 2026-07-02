import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { getConversationFlow, updateConversationFlow } from "../lib/api";

const DEFAULT_CONTRACT_PLACEHOLDER = `{
  "intent": "provide_input | clarify | restart | passthrough",
  "normalized_input": "string o null",
  "reply": "string o null"
}`;

export default function ConversationFlowPage() {
  const { tenantId } = useAppContext();

  const [mode, setMode] = useState("classic");
  const [prompt, setPrompt] = useState("");
  const [contractText, setContractText] = useState("");
  const [rewriteMessages, setRewriteMessages] = useState(true);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!tenantId) return;
      try {
        setLoading(true);
        setError("");
        setSuccess("");
        const flow = await getConversationFlow(tenantId);
        if (ignore) return;
        setMode(flow?.conversation_mode || "classic");
        setPrompt(flow?.llm_flow_prompt || "");
        setContractText(
          flow?.llm_flow_contract
            ? JSON.stringify(flow.llm_flow_contract, null, 2)
            : ""
        );
        setRewriteMessages(flow?.llm_rewrite_messages !== false);
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError.message || "No se pudo cargar la configuración del flujo."
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [tenantId]);

  async function handleSave() {
    setError("");
    setSuccess("");

    let contract = null;
    const trimmedContract = contractText.trim();
    if (trimmedContract) {
      try {
        contract = JSON.parse(trimmedContract);
        if (typeof contract !== "object" || Array.isArray(contract)) {
          throw new Error("El contrato debe ser un objeto JSON.");
        }
      } catch (parseError) {
        setError(
          `El contrato JSON no es válido: ${parseError.message || parseError}`
        );
        return;
      }
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt && !trimmedPrompt.includes("{contract}")) {
      setError(
        "El prompt personalizado debe incluir el marcador {contract} donde se insertará el contrato JSON."
      );
      return;
    }

    try {
      setSaving(true);
      const flow = await updateConversationFlow(tenantId, {
        conversation_mode: mode,
        llm_flow_prompt: trimmedPrompt || null,
        llm_flow_contract: contract,
        llm_rewrite_messages: rewriteMessages,
      });
      setMode(flow?.conversation_mode || mode);
      setSuccess("Configuración guardada correctamente.");
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="card">
        <div className="row-space">
          <div>
            <h1 className="h1">Flujo de conversación</h1>
            <p className="muted">
              Elige si los candidatos de este tenant conversan con el bot clásico
              (máquina de estados) o con el flujo guiado por IA. Sección reservada a
              los máximos administradores de Cesar IA.
            </p>
          </div>
          <div className="row">
            <Link className="btn" to="/dashboard">Dashboard</Link>
          </div>
        </div>
      </section>

      {!tenantId ? (
        <div className="warning-box">
          Selecciona un tenant en el dashboard antes de configurar su flujo.
        </div>
      ) : null}

      {error ? <div className="error-box">{error}</div> : null}
      {success ? <div className="success-box">{success}</div> : null}

      {loading ? (
        <section className="card">
          <p className="muted">Cargando configuración...</p>
        </section>
      ) : null}

      {tenantId && !loading ? (
        <section className="card">
          <h2 className="h2">Modo de conversación</h2>

          <div className="field">
            <label className="field-label">
              <input
                type="radio"
                name="conversation_mode"
                value="classic"
                checked={mode === "classic"}
                onChange={() => setMode("classic")}
              />{" "}
              Bot clásico — flujo determinista por máquina de estados (actual).
            </label>
            <label className="field-label">
              <input
                type="radio"
                name="conversation_mode"
                value="llm"
                checked={mode === "llm"}
                onChange={() => setMode("llm")}
              />{" "}
              Flujo IA — un LLM interpreta las respuestas del candidato, gestiona
              respuestas equivocadas con naturalidad y redacta los mensajes. La
              recolección de respuestas, la evaluación del CV y el scoring no cambian.
            </label>
          </div>

          {mode === "llm" ? (
            <>
              <div className="field">
                <label className="field-label" htmlFor="llm-flow-prompt">
                  Prompt del guía conversacional (opcional)
                </label>
                <p className="muted">
                  Si lo dejas vacío se usa el prompt por defecto. Si lo personalizas,
                  debe incluir el marcador <code>{"{contract}"}</code>, que será
                  sustituido por el contrato JSON de salida.
                </p>
                <textarea
                  id="llm-flow-prompt"
                  className="input"
                  rows={12}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="(vacío = prompt por defecto)"
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="llm-flow-contract">
                  Contrato JSON de salida (opcional)
                </label>
                <p className="muted">
                  Estructura JSON que el LLM debe devolver en cada turno. Si lo dejas
                  vacío se usa el contrato por defecto. El backend siempre espera los
                  campos <code>intent</code>, <code>normalized_input</code> y{" "}
                  <code>reply</code>.
                </p>
                <textarea
                  id="llm-flow-contract"
                  className="input"
                  rows={7}
                  value={contractText}
                  onChange={(e) => setContractText(e.target.value)}
                  placeholder={DEFAULT_CONTRACT_PLACEHOLDER}
                />
              </div>

              <div className="field">
                <label className="field-label">
                  <input
                    type="checkbox"
                    checked={rewriteMessages}
                    onChange={(e) => setRewriteMessages(e.target.checked)}
                  />{" "}
                  Reescribir también los mensajes salientes del bot con tono natural
                  (recomendado). Si se desactiva, el LLM solo interpreta las
                  respuestas del candidato.
                </label>
              </div>
            </>
          ) : null}

          <div className="row">
            <button
              className="btn primary"
              type="button"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Guardando..." : "Guardar configuración"}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
