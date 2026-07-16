// src/pages/TenantQuestionsPage.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import QuestionEditor, { ANSWER_TYPES, isSensitiveText, slugifyCode } from "../components/QuestionEditor";
import QuestionPreview from "../components/QuestionPreview";
import { useAppContext } from "../context/AppContext";
import {
  buildTenantQuestionPayload,
  createTenantQuestion,
  deleteTenantQuestion,
  listTenantQuestions,
  updateTenantQuestion,
} from "../lib/api";

/**
 * Preguntas comunes de la empresa.
 *
 * Se aplican a todas las vacantes y a todos los candidatos en la preselección.
 * Las preguntas específicas de un puesto se configuran dentro de cada vacante.
 */

const TYPE_LABELS = Object.fromEntries(ANSWER_TYPES.map((t) => [t.value, t.label]));

const TEMPLATES = [
  { text: "¿Cuál es tu disponibilidad para iniciar?", type: "text" },
  { text: "¿Cuál es tu expectativa salarial?", type: "number" },
  { text: "¿Cuál es tu modalidad de trabajo preferida?", type: "text" },
  { text: "¿Tienes disponibilidad para trabajar en el horario indicado?", type: "boolean" },
  { text: "¿En qué ciudad resides?", type: "text" },
  { text: "¿Estás dispuesto a trasladarte?", type: "boolean" },
  { text: "¿Autorizas que te contactemos por WhatsApp?", type: "boolean" },
  { text: "¿Tienes disponibilidad para una entrevista?", type: "boolean" },
];

function getNextAvailableOrder(items = []) {
  const used = new Set(
    items
      .map((item) => Number(item.question_order))
      .filter((v) => Number.isInteger(v) && v > 0)
  );
  let next = 1;
  while (used.has(next)) next += 1;
  return next;
}

function describeCondition(question, all) {
  const cond = question.display_condition;
  if (!cond || !cond.depends_on_field_key) return null;
  const source = all.find((q) => q.field_key === cond.depends_on_field_key);
  const sourceText = source ? `“${source.prompt_text}”` : cond.depends_on_field_key;
  const op = cond.operator === "not_equals" ? "no es" : "es";
  const value = cond.value === true ? "Sí" : cond.value === false ? "No" : String(cond.value);
  return `Se muestra solo si ${sourceText} ${op} “${value}”.`;
}

export default function TenantQuestionsPage() {
  const { tenantId, pushFlash } = useAppContext();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // editor: null | { mode: "create"|"edit", initial, tqId? }
  const [editor, setEditor] = useState(null);
  const [savingEditor, setSavingEditor] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // item o null
  const [deleting, setDeleting] = useState(false);
  const [busyRowId, setBusyRowId] = useState(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError("");
      const data = await listTenantQuestions(tenantId);
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => Number(a.question_order) - Number(b.question_order));
      setItems(list);
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar las preguntas.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: items.length,
      required: items.filter((q) => q.required).length,
      conditional: items.filter(
        (q) => q.display_condition && q.display_condition.depends_on_field_key
      ).length,
      evaluated: items.filter((q) => q.include_in_cv_score).length,
    }),
    [items]
  );

  // ── Crear / plantillas ─────────────────────────────────────────────────
  function openCreate(template = null) {
    setEditor({
      mode: "create",
      initial: {
        text: template?.text || "",
        code: template ? slugifyCode(template.text) : "",
        type: template?.type || "text",
        required: true,
        evaluates: true,
        order: getNextAvailableOrder(items),
      },
    });
  }

  function openEdit(item) {
    const cond = item.display_condition || {};
    setEditor({
      mode: "edit",
      tqId: item.tq_id,
      initial: {
        text: item.prompt_text,
        code: item.field_key,
        type: item.answer_type,
        required: item.required,
        evaluates: item.include_in_cv_score,
        order: item.question_order,
        tqId: item.tq_id,
        conditionFieldKey: cond.depends_on_field_key || "",
        conditionOperator: cond.operator === "not_equals" ? "not_equals" : "equals",
        conditionValue: cond.value === false ? "false" : "true",
      },
    });
  }

  async function handleEditorSave(values) {
    if (!editor) return;
    try {
      setSavingEditor(true);
      if (editor.mode === "create") {
        const payload = buildTenantQuestionPayload({
          code: values.code,
          text: values.text,
          type: values.type,
          required: values.required,
          order: values.order,
          display_condition: values.display_condition,
          includeInCvScore: values.evaluates,
        });
        await createTenantQuestion(tenantId, payload);
        pushFlash("message", "Pregunta creada.");
      } else {
        await updateTenantQuestion(tenantId, editor.tqId, {
          prompt_override: values.text,
          question_order: values.order,
          required: values.required,
          include_in_cv_score: values.evaluates,
          display_condition: values.display_condition,
        });
        pushFlash("message", "Pregunta actualizada.");
      }
      setEditor(null);
      await load();
    } catch (saveError) {
      pushFlash("error", saveError.message || "Error al guardar la pregunta.");
    } finally {
      setSavingEditor(false);
    }
  }

  // ── Duplicar ───────────────────────────────────────────────────────────
  async function handleDuplicate(item) {
    try {
      setBusyRowId(item.tq_id);
      const suffix = String(Date.now()).slice(-4);
      const payload = buildTenantQuestionPayload({
        code: `${item.field_key}_copia_${suffix}`,
        text: item.prompt_text,
        type: item.answer_type,
        required: item.required,
        order: getNextAvailableOrder(items),
        display_condition: item.display_condition || {},
        includeInCvScore: item.include_in_cv_score,
      });
      await createTenantQuestion(tenantId, payload);
      pushFlash("message", "Pregunta duplicada.");
      await load();
    } catch (dupError) {
      pushFlash("error", dupError.message || "No se pudo duplicar la pregunta.");
    } finally {
      setBusyRowId(null);
    }
  }

  // ── Reordenar (subir / bajar) ──────────────────────────────────────────
  async function handleMove(item, direction) {
    const index = items.findIndex((q) => q.tq_id === item.tq_id);
    const neighbor = items[index + direction];
    if (!neighbor) return;
    try {
      setBusyRowId(item.tq_id);
      await updateTenantQuestion(tenantId, item.tq_id, {
        question_order: neighbor.question_order,
      });
      await updateTenantQuestion(tenantId, neighbor.tq_id, {
        question_order: item.question_order,
      });
      pushFlash("message", "Orden actualizado correctamente.");
      await load();
    } catch (moveError) {
      pushFlash("error", moveError.message || "No se pudo actualizar el orden.");
      await load();
    } finally {
      setBusyRowId(null);
    }
  }

  // ── Eliminar ───────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      setDeleting(true);
      await deleteTenantQuestion(tenantId, confirmDelete.tq_id);
      pushFlash("message", "Pregunta eliminada.");
      setConfirmDelete(null);
      await load();
    } catch (delError) {
      pushFlash("error", delError.message || "No se pudo eliminar la pregunta.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <section className="card">
        <div className="breadcrumb">Configuración / Preguntas comunes</div>
        <div className="row-space">
          <div>
            <h1 className="h1">Preguntas comunes de la empresa</h1>
            <p className="muted">
              Configura las preguntas que María realizará a todos los candidatos,
              sin importar la vacante a la que apliquen.
            </p>
            <button
              className="linklike"
              type="button"
              onClick={() => setShowHelp((s) => !s)}
              aria-expanded={showHelp}
            >
              Cómo funcionan estas preguntas
            </button>
          </div>
          <div className="row">
            <button
              className="btn"
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={items.length === 0}
            >
              Vista previa
            </button>
            <button className="btn primary" type="button" onClick={() => openCreate()}>
              Crear pregunta
            </button>
          </div>
        </div>

        {showHelp ? (
          <div className="future-feature" style={{ marginTop: 12 }}>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>María realiza las preguntas en el orden configurado.</li>
              <li>Las obligatorias deben responderse para continuar.</li>
              <li>Las condicionales aparecen según una respuesta anterior.</li>
              <li>Las preguntas activas aplican a todas las vacantes.</li>
              <li>Las preguntas específicas del puesto se crean en la vacante.</li>
            </ol>
          </div>
        ) : null}

        <div className="notice" style={{ marginTop: 12, borderRadius: 12, padding: "10px 14px" }}>
          Utiliza esta sección para recopilar información transversal, como
          disponibilidad, modalidad de trabajo, expectativas salariales o
          autorización de contacto. Las preguntas específicas del puesto deben
          agregarse dentro de cada vacante.
        </div>
      </section>

      {!tenantId ? (
        <div className="warning-box">
          Selecciona una empresa en el dashboard para configurar sus preguntas.
        </div>
      ) : null}

      {error ? <div className="error-box">{error}</div> : null}

      {tenantId ? (
        <>
          <section className="card">
            <div className="kpi-strip" aria-label="Resumen de preguntas">
              <span className="kpi-strip-item"><strong>{stats.total}</strong> activas</span>
              <span className="kpi-strip-item"><strong>{stats.required}</strong> obligatorias</span>
              <span className="kpi-strip-item"><strong>{stats.conditional}</strong> condicionales</span>
              <span
                className="kpi-strip-item"
                title="María analiza estas respuestas junto con el CV y los criterios de la vacante."
              >
                <strong>{stats.evaluated}</strong> con puntuación
              </span>
            </div>
            <p className="muted" style={{ marginTop: 8, marginBottom: 0, fontSize: "0.85rem" }}>
              Las preguntas marcadas para evaluación pueden influir en la
              recomendación y puntuación del candidato.
            </p>
          </section>

          <section className="card">
            <h2 className="h2">Preguntas configuradas</h2>

            {loading ? <p className="muted">Cargando preguntas...</p> : null}

            {!loading && items.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 12px" }}>
                <h3 className="h3" style={{ marginBottom: 6 }}>
                  Todavía no has configurado preguntas comunes
                </h3>
                <p className="muted">
                  Agrega preguntas que María realizará a todos los candidatos,
                  como disponibilidad, ubicación o expectativas salariales.
                </p>
                <div className="row" style={{ justifyContent: "center", marginTop: 10 }}>
                  <button className="btn primary" type="button" onClick={() => openCreate()}>
                    Crear primera pregunta
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => openCreate(TEMPLATES[0])}
                  >
                    Usar una plantilla
                  </button>
                </div>
              </div>
            ) : null}

            {items.map((item, index) => {
              const conditionText = describeCondition(item, items);
              const sensitive = isSensitiveText(item.prompt_text);
              const busy = busyRowId === item.tq_id;
              return (
                <div className="q-row" key={item.tq_id}>
                  <div className="q-order">
                    <button
                      className="btn small"
                      type="button"
                      aria-label="Subir pregunta"
                      disabled={busy || index === 0}
                      onClick={() => handleMove(item, -1)}
                    >
                      ▲
                    </button>
                    <span className="q-order-number">{item.question_order}</span>
                    <button
                      className="btn small"
                      type="button"
                      aria-label="Bajar pregunta"
                      disabled={busy || index === items.length - 1}
                      onClick={() => handleMove(item, 1)}
                    >
                      ▼
                    </button>
                  </div>

                  <div className="q-main">
                    <div className="q-prompt">{item.prompt_text}</div>
                    <div className="q-badges">
                      <span className="q-badge type">
                        {TYPE_LABELS[item.answer_type] || item.answer_type}
                      </span>
                      {item.required ? (
                        <span className="q-badge required">Obligatoria</span>
                      ) : null}
                      {conditionText ? (
                        <span className="q-badge conditional">Condicional</span>
                      ) : null}
                      {item.include_in_cv_score ? (
                        <span
                          className="q-badge evaluates"
                          title="María analiza estas respuestas junto con el CV y los criterios de la vacante."
                        >
                          Influye en evaluación
                        </span>
                      ) : null}
                      {sensitive ? (
                        <span
                          className="q-badge review"
                          title="Posible información sensible: revisa que sea necesaria, legal y adecuada. No se usa automáticamente para descartar."
                        >
                          Revisar
                        </span>
                      ) : null}
                    </div>
                    {conditionText ? (
                      <div className="q-condition-hint">{conditionText}</div>
                    ) : null}
                  </div>

                  <details className="kebab">
                    <summary aria-label="Más acciones">⋯</summary>
                    <div className="kebab-menu">
                      <button type="button" disabled={busy} onClick={(e) => { e.currentTarget.closest("details").open = false; openEdit(item); }}>
                        Editar
                      </button>
                      <button type="button" disabled={busy} onClick={(e) => { e.currentTarget.closest("details").open = false; handleDuplicate(item); }}>
                        Duplicar
                      </button>
                      <button type="button" className="danger" disabled={busy} onClick={(e) => { e.currentTarget.closest("details").open = false; setConfirmDelete(item); }}>
                        Eliminar
                      </button>
                    </div>
                  </details>
                </div>
              );
            })}
          </section>

          <section className="card">
            <h2 className="h2">Preguntas recomendadas</h2>
            <p className="muted">
              Plantillas habituales de preselección. Al pulsar “Agregar” podrás
              revisarla y ajustarla antes de confirmar.
            </p>
            <div className="template-grid">
              {TEMPLATES.map((template) => (
                <div className="template-item" key={template.text}>
                  <span>{template.text}</span>
                  <button className="btn small" type="button" onClick={() => openCreate(template)}>
                    Agregar
                  </button>
                </div>
              ))}
            </div>
          </section>

          <p className="muted" style={{ fontSize: "0.8rem" }}>
            Evita solicitar información sensible que no sea necesaria para el
            proceso de selección (salud, religión, orientación sexual, afiliación
            política, origen étnico, datos familiares...).
          </p>
        </>
      ) : null}

      {editor ? (
        <QuestionEditor
          mode={editor.mode}
          initial={editor.initial}
          questions={items}
          saving={savingEditor}
          onSave={handleEditorSave}
          onClose={() => setEditor(null)}
        />
      ) : null}

      {showPreview ? (
        <QuestionPreview questions={items} onClose={() => setShowPreview(false)} />
      ) : null}

      {confirmDelete ? (
        <Modal
          title="¿Eliminar esta pregunta?"
          onClose={() => (deleting ? null : setConfirmDelete(null))}
          actions={
            <>
              <button
                className="btn"
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
              >
                Cancelar
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Eliminando..." : "Eliminar pregunta"}
              </button>
            </>
          }
        >
          <p>
            <strong>{confirmDelete.prompt_text}</strong>
          </p>
          <p className="muted">
            Esta acción puede afectar vacantes y conversaciones futuras. Las
            respuestas históricas no se eliminarán.
          </p>
        </Modal>
      ) : null}
    </>
  );
}
