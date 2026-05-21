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

function emptyForm(nextOrder = 1) {
  return { code: "", text: "", type: "text", order: String(nextOrder), required: true };
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

  const payload = useMemo(
    () => buildTenantQuestionPayload({ code: form.code, text: form.text, type: form.type, required: form.required, order: form.order }),
    [form]
  );

  function renderError(name) {
    return errors[name] ? <div className="field-error">{errors[name]}</div> : null;
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
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

  function startEdit(item) {
    setEditing({
      tq_id: item.tq_id,
      prompt_override: item.prompt_text || "",
      question_order: String(item.question_order || 1),
      required: Boolean(item.required),
    });
    setErrors({});
  }

  function handleEditChange(e) {
    const { name, value, type, checked } = e.target;
    setEditing((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleUpdate(e) {
    e.preventDefault();
    const nextErrors = {};
    const order = Number(editing.question_order);
    if (!Number.isInteger(order) || order < 1) {
      nextErrors.question_order = "El orden debe ser un entero mayor o igual que 1.";
    } else if (questions.some((item) => item.tq_id !== editing.tq_id && Number(item.question_order) === order)) {
      nextErrors.question_order = `Ya existe una pregunta con el orden ${order}.`;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setUpdating(true);
      await updateTenantQuestion(tenantId, editing.tq_id, {
        prompt_override: String(editing.prompt_override || "").trim() || null,
        question_order: order,
        required: Boolean(editing.required),
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

  async function handleDelete(item) {
    const confirmed = window.confirm(`¿Seguro que quieres eliminar esta pregunta?\n\n"${item.prompt_text}"`);
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

  const typeLabel = { text: "Texto libre", number: "Número", boolean: "Sí / No" };

  return (
    <>
      <section className="card">
        <div className="row-space">
          <div>
            <h1 className="h1">Preguntas genéricas del tenant</h1>
            <p className="muted">
              Se preguntan a todos los candidatos antes del CV e influyen en el CV Score del LLM.
            </p>
          </div>
          <div className="row">
            <Link className="btn" to="/dashboard">Dashboard</Link>
          </div>
        </div>
      </section>

      <VacancySelector
        title="Tenant"
        description="Selecciona el tenant al que pertenecen estas preguntas genéricas."
        showVacancyField={false}
        showLoadButton={false}
        autoLoad={false}
      />

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
                  </span>
                  <span className="question-row-meta">
                    {typeLabel[item.answer_type] ?? item.answer_type} · campo: {item.field_key}
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
                <input type="checkbox" name="required" checked={editing.required} onChange={handleEditChange} />
                <span>Pregunta obligatoria</span>
              </label>
            </div>
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
              <input type="checkbox" name="required" checked={form.required} onChange={handleChange} />
              <span>Pregunta obligatoria</span>
            </label>
          </div>
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={submitting || !tenantId}>
              {submitting ? "Guardando…" : "Añadir pregunta"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
