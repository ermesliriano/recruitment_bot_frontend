// src/pages/TenantQuestionsPage.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import VacancySelector from "../components/VacancySelector";
import { useAppContext } from "../context/AppContext";
import {
  buildTenantQuestionPayload,
  createTenantQuestion,
  deleteTenantQuestion,
  listTenantQuestions,
  updateTenantQuestion,
} from "../lib/api";

// ─── helpers ────────────────────────────────────────────────────────────────

function emptyForm(nextOrder = 1) {
  return {
    code: "",
    text: "",
    type: "text",
    order: String(nextOrder),
    required: true,
    conditionEnabled: false,
    conditionFieldKey: "",
    conditionValue: "true", // "true" | "false"
  };
}

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

/** Extrae la lista de preguntas booleanas con orden inferior al orden dado. */
function booleanPriorTo(questions, currentOrder, excludeTqId = null) {
  return questions.filter(
    (q) =>
      q.answer_type === "boolean" &&
      Number(q.question_order) < Number(currentOrder) &&
      q.tq_id !== excludeTqId
  );
}

/** Convierte los campos de condición del formulario a un objeto display_condition. */
function buildCondition(conditionEnabled, conditionFieldKey, conditionValue) {
  if (!conditionEnabled || !conditionFieldKey) return {};
  return {
    depends_on_field_key: conditionFieldKey,
    operator: "equals",
    value: conditionValue === "true",
  };
}

/** Convierte un display_condition existente a campos del formulario. */
function parseCondition(display_condition) {
  if (!display_condition || !display_condition.depends_on_field_key) {
    return { conditionEnabled: false, conditionFieldKey: "", conditionValue: "true" };
  }
  return {
    conditionEnabled: true,
    conditionFieldKey: display_condition.depends_on_field_key,
    conditionValue: display_condition.value === false ? "false" : "true",
  };
}

const TYPE_LABEL = { text: "Texto libre", number: "Número", boolean: "Sí / No" };

// ─── componente de condición reutilizable ────────────────────────────────────

function ConditionSection({ conditionEnabled, conditionFieldKey, conditionValue, booleanOptions, onChange }) {
  function toggle() {
    onChange({ conditionEnabled: !conditionEnabled, conditionFieldKey: "", conditionValue: "true" });
  }

  return (
    <div className="condition-section">
      <label className="checkbox-row">
        <input type="checkbox" checked={conditionEnabled} onChange={toggle} />
        <span>Depende de una pregunta booleana anterior</span>
      </label>

      {conditionEnabled && (
        <div className="condition-body">
          {booleanOptions.length === 0 ? (
            <p className="muted" style={{ marginTop: 8 }}>
              No hay preguntas de tipo Sí/No con orden inferior a esta. Añade primero una pregunta
              booleana anterior para poder crear una condición.
            </p>
          ) : (
            <>
              <label className="label" style={{ marginTop: 8 }}>
                Campo de referencia
                <select
                  className="input"
                  value={conditionFieldKey}
                  onChange={(e) => onChange({ conditionFieldKey: e.target.value })}
                >
                  <option value="">— selecciona —</option>
                  {booleanOptions.map((q) => (
                    <option key={q.tq_id} value={q.field_key}>
                      #{q.question_order} — {q.field_key} ({q.prompt_text.slice(0, 50)}{q.prompt_text.length > 50 ? "…" : ""})
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="radio-group" style={{ marginTop: 8 }}>
                <legend className="label" style={{ marginBottom: 4 }}>Mostrar si responde</legend>
                <label className="radio-row">
                  <input
                    type="radio"
                    name="conditionValue"
                    value="true"
                    checked={conditionValue === "true"}
                    onChange={() => onChange({ conditionValue: "true" })}
                  />
                  <span>Sí</span>
                </label>
                <label className="radio-row">
                  <input
                    type="radio"
                    name="conditionValue"
                    value="false"
                    checked={conditionValue === "false"}
                    onChange={() => onChange({ conditionValue: "false" })}
                  />
                  <span>No</span>
                </label>
              </fieldset>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── página principal ────────────────────────────────────────────────────────

export default function TenantQuestionsPage() {
  const { tenantId, pushFlash } = useAppContext();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(() => emptyForm(1));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // ── carga ──────────────────────────────────────────────────────────────────

  const loadQuestions = useCallback(async () => {
    if (!tenantId) {
      setQuestions([]);
      return;
    }
    try {
      setLoading(true);
      const data = await listTenantQuestions(tenantId);
      const items = Array.isArray(data) ? data : [];
      setQuestions(items);
      setForm((current) => {
        if (current.text.trim()) return current;
        return { ...current, order: String(getNextAvailableOrder(items)) };
      });
    } catch (error) {
      setQuestions([]);
      pushFlash("error", error.message || "No se pudieron cargar las preguntas genéricas.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, pushFlash]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // ── payload de creación ────────────────────────────────────────────────────

  const payload = useMemo(
    () =>
      buildTenantQuestionPayload({
        code: form.code,
        text: form.text,
        type: form.type,
        required: form.required,
        order: form.order,
        display_condition: buildCondition(form.conditionEnabled, form.conditionFieldKey, form.conditionValue),
      }),
    [form]
  );

  // ── helpers de renderizado ─────────────────────────────────────────────────

  function renderError(name) {
    return errors[name] ? <div className="field-error">{errors[name]}</div> : null;
  }

  function conditionBadge(display_condition) {
    if (!display_condition || !display_condition.depends_on_field_key) return null;
    const val = display_condition.value === false ? "No" : "Sí";
    return (
      <span className="badge badge-condition" title="Pregunta condicional">
        si {display_condition.depends_on_field_key} = {val}
      </span>
    );
  }

  // ── creación ───────────────────────────────────────────────────────────────

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function handleConditionChange(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    const nextErrors = {};

    if (!tenantId) nextErrors.submit = "Debes indicar un tenant antes de guardar.";
    if (!form.text.trim()) nextErrors.text = "El enunciado es obligatorio.";

    const order = Number(form.order);
    if (!Number.isInteger(order) || order < 1) {
      nextErrors.order = "El orden debe ser un entero mayor o igual que 1.";
    } else if (questions.some((item) => Number(item.question_order) === order)) {
      nextErrors.order = `Ya existe una pregunta con el orden ${order}.`;
    }

    if (form.conditionEnabled && !form.conditionFieldKey) {
      nextErrors.condition = "Selecciona el campo del que depende esta pregunta.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setSubmitting(true);
      await createTenantQuestion(tenantId, payload);
      pushFlash("message", "Pregunta genérica creada correctamente.");
      setForm(emptyForm(order + 1));
      setErrors({});
      await loadQuestions();
    } catch (error) {
      setErrors({ submit: error.message || "No se pudo crear la pregunta." });
    } finally {
      setSubmitting(false);
    }
  }

  // ── edición ────────────────────────────────────────────────────────────────

  function startEdit(item) {
    const { conditionEnabled, conditionFieldKey, conditionValue } = parseCondition(item.display_condition);
    setEditing({
      tq_id: item.tq_id,
      prompt_override: item.prompt_text || "",
      question_order: String(item.question_order || 1),
      required: Boolean(item.required),
      conditionEnabled,
      conditionFieldKey,
      conditionValue,
    });
    setErrors({});
  }

  function handleEditChange(e) {
    const { name, value, type, checked } = e.target;
    setEditing((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function handleEditConditionChange(patch) {
    setEditing((current) => ({ ...current, ...patch }));
  }

  async function handleUpdate(e) {
    e.preventDefault();
    const nextErrors = {};

    const order = Number(editing.question_order);
    if (!Number.isInteger(order) || order < 1) {
      nextErrors.question_order = "El orden debe ser un entero mayor o igual que 1.";
    } else if (
      questions.some(
        (item) => item.tq_id !== editing.tq_id && Number(item.question_order) === order
      )
    ) {
      nextErrors.question_order = `Ya existe una pregunta con el orden ${order}.`;
    }

    if (editing.conditionEnabled && !editing.conditionFieldKey) {
      nextErrors.condition = "Selecciona el campo del que depende esta pregunta.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const display_condition = buildCondition(
      editing.conditionEnabled,
      editing.conditionFieldKey,
      editing.conditionValue
    );

    try {
      setUpdating(true);
      await updateTenantQuestion(tenantId, editing.tq_id, {
        prompt_override: String(editing.prompt_override || "").trim() || null,
        question_order: order,
        required: Boolean(editing.required),
        display_condition,
      });
      pushFlash("message", "Pregunta genérica actualizada correctamente.");
      setEditing(null);
      setErrors({});
      await loadQuestions();
    } catch (error) {
      setErrors({ submit: error.message || "No se pudo actualizar la pregunta." });
    } finally {
      setUpdating(false);
    }
  }

  // ── eliminación ────────────────────────────────────────────────────────────

  async function handleDelete(item) {
    const confirmed = window.confirm(
      `¿Seguro que quieres eliminar esta pregunta?\n\n"${item.prompt_text}"`
    );
    if (!confirmed) return;
    try {
      setDeletingId(item.tq_id);
      await deleteTenantQuestion(tenantId, item.tq_id);
      pushFlash("message", "Pregunta genérica eliminada correctamente.");
      if (editing?.tq_id === item.tq_id) setEditing(null);
      await loadQuestions();
    } catch (error) {
      setErrors({ submit: error.message || "No se pudo eliminar la pregunta." });
    } finally {
      setDeletingId(null);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const createBooleanOptions = booleanPriorTo(questions, form.order);
  const editBooleanOptions = editing
    ? booleanPriorTo(questions, editing.question_order, editing.tq_id)
    : [];

  return (
    <>
      {/* Cabecera */}
      <section className="card">
        <div className="row-space">
          <div>
            <h1 className="h1">Preguntas genéricas del tenant</h1>
            <p className="muted">
              Se preguntan a todos los candidatos antes del CV e influyen en el CV Score del LLM.
              Las preguntas condicionales solo se muestran si se cumple la condición indicada.
            </p>
          </div>
          <div className="row">
            <Link className="btn" to="/dashboard">Dashboard</Link>
          </div>
        </div>
      </section>

      {/* Selector de tenant */}
      <VacancySelector
        title="Tenant"
        description="Selecciona el tenant al que pertenecen estas preguntas genéricas."
        showVacancyField={false}
        showLoadButton={false}
        autoLoad={false}
      />

      {/* Listado */}
      <section className="card">
        <div className="row-space" style={{ marginBottom: 16 }}>
          <h2 className="h2">Preguntas configuradas</h2>
          <span className="muted">
            {tenantId ? `${questions.length} pregunta(s)` : "Selecciona un tenant"}
          </span>
        </div>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : !tenantId ? (
          <p className="muted">Indica un tenant para empezar.</p>
        ) : questions.length === 0 ? (
          <p className="muted">Todavía no hay preguntas genéricas configuradas.</p>
        ) : (
          <div className="question-list">
            {questions.map((item) => (
              <div key={item.tq_id} className="question-row">
                <span className="question-row-info">
                  <span className="question-row-title">
                    {item.question_order}. {item.prompt_text}
                    {conditionBadge(item.display_condition)}
                  </span>
                  <span className="question-row-meta">
                    {TYPE_LABEL[item.answer_type] ?? item.answer_type}
                    {" · campo: "}
                    {item.field_key}
                    {!item.required ? " · opcional" : ""}
                  </span>
                </span>
                <button className="btn small" type="button" onClick={() => startEdit(item)}>
                  Editar
                </button>
                <button
                  className="btn small danger"
                  type="button"
                  disabled={deletingId === item.tq_id}
                  onClick={() => handleDelete(item)}
                >
                  {deletingId === item.tq_id ? "…" : "Eliminar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Formulario de edición */}
      {editing ? (
        <section className="card">
          <h2 className="h2" style={{ marginBottom: 16 }}>Editar pregunta genérica</h2>
          {renderError("submit")}

          <form className="form" onSubmit={handleUpdate} noValidate>
            <label className="label">
              Enunciado mostrado al candidato
              <textarea
                className="textarea"
                name="prompt_override"
                value={editing.prompt_override}
                onChange={handleEditChange}
              />
            </label>

            <div className="form-grid grid-2">
              <label className="label">
                Orden
                <input
                  className="input"
                  type="number"
                  min="1"
                  name="question_order"
                  value={editing.question_order}
                  onChange={handleEditChange}
                />
                {renderError("question_order")}
              </label>
              <label className="checkbox-row" style={{ alignSelf: "end" }}>
                <input
                  type="checkbox"
                  name="required"
                  checked={editing.required}
                  onChange={handleEditChange}
                />
                <span>Pregunta obligatoria</span>
              </label>
            </div>

            {/* Condición de visualización */}
            <ConditionSection
              conditionEnabled={editing.conditionEnabled}
              conditionFieldKey={editing.conditionFieldKey}
              conditionValue={editing.conditionValue}
              booleanOptions={editBooleanOptions}
              onChange={handleEditConditionChange}
            />
            {renderError("condition")}

            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={updating}>
                {updating ? "Guardando…" : "Guardar cambios"}
              </button>
              <button className="btn" type="button" onClick={() => setEditing(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {/* Formulario de creación */}
      <section className="card">
        <h2 className="h2" style={{ marginBottom: 16 }}>Añadir pregunta genérica</h2>
        {renderError("submit")}

        <form className="form" onSubmit={handleCreate} noValidate>
          <div className="form-grid grid-2">
            <label className="label">
              Código interno
              <input
                className="input"
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="ej. ultimo_salario"
              />
            </label>
            <label className="label">
              Tipo de respuesta
              <select className="input" name="type" value={form.type} onChange={handleChange}>
                <option value="text">Texto libre</option>
                <option value="number">Número</option>
                <option value="boolean">Sí / No</option>
              </select>
            </label>
          </div>

          <label className="label">
            Enunciado (texto que verá el candidato en el bot)
            <textarea
              className="textarea"
              name="text"
              value={form.text}
              onChange={handleChange}
              placeholder="Ej. ¿Cuál fue tu último salario?"
            />
          </label>
          {renderError("text")}

          <div className="form-grid grid-2">
            <label className="label">
              Orden
              <input
                className="input"
                type="number"
                min="1"
                name="order"
                value={form.order}
                onChange={handleChange}
              />
              {renderError("order")}
            </label>
            <label className="checkbox-row" style={{ alignSelf: "end" }}>
              <input
                type="checkbox"
                name="required"
                checked={form.required}
                onChange={handleChange}
              />
              <span>Pregunta obligatoria</span>
            </label>
          </div>

          {/* Condición de visualización */}
          <ConditionSection
            conditionEnabled={form.conditionEnabled}
            conditionFieldKey={form.conditionFieldKey}
            conditionValue={form.conditionValue}
            booleanOptions={createBooleanOptions}
            onChange={handleConditionChange}
          />
          {renderError("condition")}

          <div className="form-actions">
            <button
              className="btn primary"
              type="submit"
              disabled={submitting || !tenantId}
            >
              {submitting ? "Guardando…" : "Añadir pregunta"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
