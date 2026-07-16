import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { getConversationFlow, updateConversationFlow } from "../lib/api";

export default function ConversationFlowPage() {
  const { tenantId } = useAppContext();

  const [mode, setMode] = useState("classic");
  const [guidePrompt, setGuidePrompt] = useState("");
  const [personalityPrompt, setPersonalityPrompt] = useState("");
  const [contractText, setContractText] = useState("");
  const [rewriteMessages, setRewriteMessages] = useState(true);
  const [postCompletionMode, setPostCompletionMode] = useState("silent_forever");
  const [defaults, setDefaults] = useState(null);

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

        const flowDefaults = flow?.defaults || {};
        setDefaults(flowDefaults);
        setMode(flow?.conversation_mode || "classic");
        // Se muestra siempre el texto EFECTIVO: el personalizado si existe,
        // o el default del backend para poder editarlo/ampliarlo/recortarlo.
        setGuidePrompt(flow?.llm_flow_prompt || flowDefaults.llm_flow_prompt || "");
        setPersonalityPrompt(
          flow?.llm_personality_prompt || flowDefaults.llm_personality_prompt || ""
        );
        setContractText(
          JSON.stringify(
            flow?.llm_flow_contract || flowDefaults.llm_flow_contract || {},
            null,
            2
          )
        );
        setRewriteMessages(flow?.llm_rewrite_messages !== false);
        setPostCompletionMode(flow?.post_completion_mode || "silent_forever");
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

  function handleRestoreDefault(block) {
    if (!defaults) return;
    if (block === "guide") setGuidePrompt(defaults.llm_flow_prompt || "");
    if (block === "personality")
      setPersonalityPrompt(defaults.llm_personality_prompt || "");
    if (block === "contract")
      setContractText(JSON.stringify(defaults.llm_flow_contract || {}, null, 2));
  }

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

    const trimmedGuide = guidePrompt.trim();
    if (trimmedGuide && !trimmedGuide.includes("{contract}")) {
      setError(
        "El prompt del guía debe incluir el marcador {contract} donde se insertará el contrato JSON."
      );
      return;
    }

    try {
      setSaving(true);
      const flow = await updateConversationFlow(tenantId, {
        conversation_mode: mode,
        llm_flow_prompt: trimmedGuide || null,
        llm_personality_prompt: personalityPrompt.trim() || null,
        llm_flow_contract: contract,
        llm_rewrite_messages: rewriteMessages,
        post_completion_mode: postCompletionMode,
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
              Elige si los candidatos de esta empresa conversan con el bot clásico
              (máquina de estados) o con el flujo guiado por IA, y personaliza sus
              instrucciones. Sección reservada a los máximos administradores de
              Cesar IA.
            </p>
          </div>
          <div className="row">
            <Link className="btn" to="/dashboard">Dashboard</Link>
          </div>
        </div>
      </section>

      {!tenantId ? (
        <div className="warning-box">
          Selecciona una empresa en el dashboard antes de configurar su flujo.
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
        <>
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
                Bot clásico — flujo determinista por máquina de estados.
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
              <div className="field">
                <label className="field-label">
                  <input
                    type="checkbox"
                    checked={rewriteMessages}
                    onChange={(e) => setRewriteMessages(e.target.checked)}
                  />{" "}
                  Reescribir también los mensajes salientes del bot con la
                  personalidad configurada (recomendado).
                </label>
              </div>
            ) : null}
          </section>

          <section className="card">
            <h2 className="h2">Al finalizar la postulación</h2>
            <p className="muted">
              Qué hace el asistente cuando el candidato vuelve a escribir después
              de haber completado su postulación. Aplica tanto al bot clásico como
              al flujo IA.
            </p>
            <div className="field">
              <label className="field-label">
                <input
                  type="radio"
                  name="post_completion_mode"
                  value="silent_forever"
                  checked={postCompletionMode === "silent_forever"}
                  onChange={() => setPostCompletionMode("silent_forever")}
                />{" "}
                No volver a interactuar — tras el mensaje de cierre, el asistente
                no responde más mensajes de ese candidato en ese canal. El
                reclutador siempre puede re-contactarlo desde Carga de CV o
                Conversaciones.
              </label>
              <label className="field-label">
                <input
                  type="radio"
                  name="post_completion_mode"
                  value="reopen_next_day"
                  checked={postCompletionMode === "reopen_next_day"}
                  onChange={() => setPostCompletionMode("reopen_next_day")}
                />{" "}
                Reabrir al día siguiente — silencio total el mismo día del cierre;
                a partir del día siguiente, cualquier mensaje del candidato
                reinicia el flujo mostrando las vacantes activas.
              </label>
            </div>
          </section>

          {mode === "llm" ? (
            <>
              <section className="card">
                <div className="row-space">
                  <div>
                    <h2 className="h2">Prompt del guía conversacional</h2>
                    <p className="muted">
                      Instrucciones técnicas de interpretación: cómo normalizar
                      respuestas, cuándo aclarar y el contrato JSON. Debe incluir el
                      marcador <code>{"{contract}"}</code>.
                    </p>
                  </div>
                  <div className="row">
                    <button
                      className="btn small"
                      type="button"
                      onClick={() => handleRestoreDefault("guide")}
                    >
                      Restaurar por defecto
                    </button>
                  </div>
                </div>
                <textarea
                  className="input"
                  rows={16}
                  value={guidePrompt}
                  onChange={(e) => setGuidePrompt(e.target.value)}
                />
              </section>

              <section className="card">
                <div className="row-space">
                  <div>
                    <h2 className="h2">Prompt de la personalidad</h2>
                    <p className="muted">
                      Quién es la asistente y cómo se comporta con el candidato
                      (tono, límites, estilo). Se aplica tanto al interpretar como
                      al redactar los mensajes.
                    </p>
                  </div>
                  <div className="row">
                    <button
                      className="btn small"
                      type="button"
                      onClick={() => handleRestoreDefault("personality")}
                    >
                      Restaurar por defecto
                    </button>
                  </div>
                </div>
                <textarea
                  className="input"
                  rows={14}
                  value={personalityPrompt}
                  onChange={(e) => setPersonalityPrompt(e.target.value)}
                />
              </section>

              <section className="card">
                <div className="row-space">
                  <div>
                    <h2 className="h2">Contrato JSON de salida</h2>
                    <p className="muted">
                      Estructura JSON que el LLM debe devolver en cada turno. El
                      backend siempre espera los campos <code>intent</code>,{" "}
                      <code>normalized_input</code> y <code>reply</code>.
                    </p>
                  </div>
                  <div className="row">
                    <button
                      className="btn small"
                      type="button"
                      onClick={() => handleRestoreDefault("contract")}
                    >
                      Restaurar por defecto
                    </button>
                  </div>
                </div>
                <textarea
                  className="input"
                  rows={7}
                  value={contractText}
                  onChange={(e) => setContractText(e.target.value)}
                />
              </section>
            </>
          ) : null}

          <section className="card">
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
        </>
      ) : null}
    </>
  );
}
