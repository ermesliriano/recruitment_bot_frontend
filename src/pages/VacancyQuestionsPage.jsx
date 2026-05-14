import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import VacancyBudgetModal from "../components/VacancyBudgetModal";
import {
  buildQuestionPayload,
  createVacancyQuestion,
  getVacancy,
  listVacancyQuestions,
  splitLinesToList,
  updateVacancyQuestion,
} from "../lib/api";
import { getVacancyBudget, isActiveVacancy } from "../lib/scoringBudget";

function validateQuestionForm({ routeVacancyId, form, existingQuestions = [] }) {
  const errors = {};

  if (!routeVacancyId) {
    errors.submit = "No se ha podido identificar la vacante.";
  }

  if (!form.text.trim()) {
    errors.text = "El enunciado es obligatorio.";
  }

  if (!String(form.order).trim()) {
    errors.order = "El orden es obligatorio.";
  } else {
    const numericOrder = Number(form.order);

    if (!Number.isInteger(numericOrder) || numericOrder < 1) {
      errors.order = "El orden debe ser un entero mayor o igual que 1.";
    } else {
      const duplicatedOrder = existingQuestions.some(
        (question) => Number(question.question_order) === numericOrder
      );

      if (duplicatedOrder) {
        errors.order = `Ya existe una pregunta con el orden ${numericOrder}. Usa otro número o edita la pregunta existente.`;
      }
    }
  }

  const maxPts = Number(form.max_points);
  if (!Number.isInteger(maxPts) || maxPts < 0 || maxPts > 100) {
    errors.max_points = "La puntuación máxima debe ser un entero entre 0 y 100.";
  }

  if (form.type === "select" && splitLinesToList(form.options).length === 0) {
    errors.options = "Para el tipo select debes indicar una opción por línea.";
  }

  return errors;
}

function emptyForm(nextOrder = 1) {
  return {
    code: "",
    text: "",
    type: "text",
    order: String(nextOrder),
    required: true,
    options: "",
    max_points: "0",
  };
}

function getNextAvailableOrder(questions = []) {
  const usedOrders = new Set(
    questions
      .map((question) => Number(question.question_order))
      .filter((order) => Number.isInteger(order) && order > 0)
  );

  let nextOrder = 1;

  while (usedOrders.has(nextOrder)) {
    nextOrder += 1;
  }

  return nextOrder;
}

export default function VacancyQuestionsPage() {
  const { vacancyId } = useParams();
  const routeVacancyId = String(vacancyId || "").trim();

  const { tenantId, pushFlash, setSelection } = useAppContext();

  const [existingQuestions, setExistingQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const [vacancy, setVacancy] = useState(null);
  const [budgetModal, setBudgetModal] = useState(null);

  const [form, setForm] = useState(() => emptyForm(1));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [lastCreated, setLastCreated] = useState(null);

  const [editingQuestion, setEditingQuestion] = useState(null);
  const [updatingQuestion, setUpdatingQuestion] = useState(false);

  useEffect(() => {
    if (routeVacancyId) setSelection({ vacancyId: routeVacancyId });
  }, [routeVacancyId, setSelection]);

  useEffect(() => {
    if (!routeVacancyId) return;

    let ignore = false;

    async function loadVacancy() {
      try {
        const data = await getVacancy(routeVacancyId);
        if (!ignore) {
          setVacancy(data);
        }
      } catch {
        if (!ignore) {
          setVacancy(null);
        }
      }
    }

    loadVacancy();

    return () => {
      ignore = true;
    };
  }, [routeVacancyId]);
  
  const loadQuestions = useCallback(async () => {
    if (!routeVacancyId) return;
    try {
      setQuestionsLoading(true);
      const data = await listVacancyQuestions(routeVacancyId);
      const normalizedQuestions = Array.isArray(data) ? data : [];

      setExistingQuestions(normalizedQuestions);

      setForm((currentForm) => {
        if (currentForm.text.trim()) {
          return currentForm;
        }

        return {
          ...currentForm,
          order: String(getNextAvailableOrder(normalizedQuestions)),
        };
      });
    } catch {
      setExistingQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  }, [routeVacancyId]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const usedPoints = useMemo(
    () => existingQuestions.reduce((s, q) => s + (q.max_points || 0), 0),
    [existingQuestions]
  );

  const computedPayload = useMemo(
    () =>
      buildQuestionPayload({
        code: form.code,
        text: form.text,
        type: form.type,
        required: form.required,
        order: form.order,
        options: form.options,
        max_points: form.max_points,
      }),
    [form.code, form.text, form.type, form.required, form.order, form.options, form.max_points]
  );

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((cur) => ({ ...cur, [name]: type === "checkbox" ? checked : value }));
  }

  function renderError(name) {
    return errors[name] ? <div className="field-error">{errors[name]}</div> : null;
  }

  function validateActiveVacancyBudget(nextQuestions) {
    if (!isActiveVacancy(vacancy)) {
      return true;
    }

    const budget = getVacancyBudget({
      vacancy,
      questions: nextQuestions,
    });

    if (!budget.isValid) {
      setBudgetModal({
        vacancy,
        total: budget.total,
        questionsTotal: budget.questionsTotal,
      });

      return false;
    }

    return true;
  }
  
  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateQuestionForm({ routeVacancyId, form, existingQuestions, });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const nextQuestions = [
      ...existingQuestions,
      {
        max_points: Number(computedPayload.max_points) || 0,
      },
    ];

    if (!validateActiveVacancyBudget(nextQuestions)) {
      return;
    }
    
    try {
      setSubmitting(true);
      const created = await createVacancyQuestion(routeVacancyId, tenantId, computedPayload);
      setLastCreated(created);
      pushFlash("message", "Pregunta creada correctamente.");
      setForm(emptyForm(Number(form.order || 1) + 1));
      setErrors({});
      await loadQuestions();
    } catch (error) {
      setErrors({ submit: error.message || "No se pudo crear la pregunta." });
    } finally {
      setSubmitting(false);
    }
  }

  function handleStartEdit(question) {
    setEditingQuestion({
      vq_id: question.vq_id,
      prompt_override: question.prompt_override || question.prompt_text || "",
      question_order: String(question.question_order || 1),
      required: Boolean(question.required),
      max_points: String(question.max_points ?? 0),
    });
    setErrors({});
  }

  function handleCancelEdit() {
    setEditingQuestion(null);
    setErrors({});
  }

  function handleEditChange(event) {
    const { name, value, type, checked } = event.target;
    setEditingQuestion((cur) => ({
      ...cur,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleUpdateQuestion(event) {
    event.preventDefault();

    if (!editingQuestion?.vq_id) {
      setErrors({ submit: "No se ha podido identificar la pregunta a editar." });
      return;
    }

    const questionOrder = Number(editingQuestion.question_order);
    const maxPoints = Number(editingQuestion.max_points);

    const nextErrors = {};

    if (!Number.isInteger(questionOrder) || questionOrder < 1) {
      nextErrors.question_order = "El orden debe ser un entero mayor o igual que 1.";
    }

    if (!Number.isInteger(maxPoints) || maxPoints < 0 || maxPoints > 100) {
      nextErrors.max_points = "La puntuación máxima debe ser un entero entre 0 y 100.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const nextQuestions = existingQuestions.map((question) =>
      question.vq_id === editingQuestion.vq_id
        ? {
            ...question,
            max_points: maxPoints,
          }
        : question
    );

    if (!validateActiveVacancyBudget(nextQuestions)) {
      return;
    }
    
    try {
      setUpdatingQuestion(true);

      await updateVacancyQuestion(routeVacancyId, editingQuestion.vq_id, {
        prompt_override: editingQuestion.prompt_override.trim() || null,
        question_order: questionOrder,
        required: Boolean(editingQuestion.required),
        max_points: maxPoints,
      });

      pushFlash("message", "Pregunta actualizada correctamente.");
      setEditingQuestion(null);
      setErrors({});
      await loadQuestions();
    } catch (error) {
      setErrors({
        submit: error.message || "No se pudo actualizar la pregunta.",
      });
    } finally {
      setUpdatingQuestion(false);
    }
  }
  
  return (
    <>

      {budgetModal ? (
        <VacancyBudgetModal
          vacancy={budgetModal.vacancy}
          total={budgetModal.total}
          questionsTotal={budgetModal.questionsTotal}
          onClose={() => setBudgetModal(null)}
          onGoToQuestions={() => setBudgetModal(null)}
        />
      ) : null}
      
      <section className="card">
        <div className="row-space">
          <div>
            <h1 className="h1">Preguntas de la vacante</h1>
            <p className="muted">
              Vacante: <strong>{routeVacancyId || "No definida"}</strong>
            </p>
          </div>
          <div className="row">
            <Link className="btn" to="/dashboard">Dashboard</Link>
            {routeVacancyId ? (
              <Link className="btn" to={`/vacancies/${routeVacancyId}/edit`}>Editar vacante</Link>
            ) : null}
            {routeVacancyId ? (
              <Link className="btn" to={`/ranking?vacancyId=${routeVacancyId}`}>Ver ranking</Link>
            ) : null}
          </div>
        </div>
      </section>

      {!routeVacancyId ? (
        <div className="error-box">
          No se ha podido identificar la vacante. Accede a esta pantalla desde el dashboard.
        </div>
      ) : null}

      {/* ── Preguntas existentes ─────────────────────────────── */}
      <section className="card">
        <div className="row-space" style={{ marginBottom: 16 }}>
          <h2 className="h2">Preguntas configuradas</h2>
          <span className="muted" style={{ fontSize: "0.9rem" }}>
            Puntos asignados en preguntas: <strong>{usedPoints}</strong>
          </span>
        </div>

        {questionsLoading ? (
          <p className="muted">Cargando preguntas…</p>
        ) : existingQuestions.length === 0 ? (
          <p className="muted">Esta vacante aún no tiene preguntas configuradas.</p>
        ) : (
          <div className="question-list">
            {existingQuestions.map((q) => (
  <div key={q.vq_id} className="question-row">
    <span className="question-row-info">
      <span className="question-row-title">
        {q.question_order}. {q.prompt_override || q.prompt_text}
      </span>
      <span className="question-row-meta">
        {q.answer_type} · campo: {q.field_key}
        {!q.required ? " · opcional" : ""}
      </span>
    </span>

    <span className="question-row-points">{q.max_points} pts</span>

    <button
      className="btn small"
      type="button"
      onClick={() => handleStartEdit(q)}
    >
      Editar
    </button>
  </div>
))}
          </div>
        )}
      </section>

{editingQuestion ? (
  <section className="card">
    <h2 className="h2" style={{ marginBottom: 16 }}>
      Editar pregunta
    </h2>

    {renderError("submit")}

    <form className="form" onSubmit={handleUpdateQuestion} noValidate>
      <label className="label">
        Enunciado mostrado
        <textarea
          className="textarea"
          name="prompt_override"
          value={editingQuestion.prompt_override}
          onChange={handleEditChange}
          placeholder="Texto que verá la persona candidata."
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
            value={editingQuestion.question_order}
            onChange={handleEditChange}
          />
          {renderError("question_order")}
        </label>

        <label className="label">
          Puntuación máxima
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            name="max_points"
            value={editingQuestion.max_points}
            onChange={handleEditChange}
          />
          {renderError("max_points")}
        </label>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          name="required"
          checked={editingQuestion.required}
          onChange={handleEditChange}
        />
        <span>Pregunta obligatoria</span>
      </label>

      <div className="form-actions">
        <button className="btn primary" type="submit" disabled={updatingQuestion}>
          {updatingQuestion ? "Guardando…" : "Guardar cambios"}
        </button>

        <button className="btn" type="button" onClick={handleCancelEdit}>
          Cancelar
        </button>
      </div>
    </form>
  </section>
) : null}
      
      {/* ── Formulario nueva pregunta ────────────────────────── */}
      <section className="card">
        <h2 className="h2" style={{ marginBottom: 16 }}>Añadir pregunta</h2>

        {renderError("submit")}

        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="form-grid grid-2">
            <label className="label">
              Código de la pregunta
              <input
                className="input"
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="Opcional. Identificador interno."
              />
            </label>

            <label className="label">
              Tipo
              <select className="input" name="type" value={form.type} onChange={handleChange}>
                <option value="text">Texto libre</option>
                <option value="number">Número</option>
                <option value="boolean">Sí / No</option>
                <option value="select">Selección</option>
              </select>
            </label>
          </div>

          <label className="label">
            Enunciado
            <textarea
              className="textarea"
              name="text"
              value={form.text}
              onChange={handleChange}
              placeholder="Ej. ¿Cuántos años de experiencia tienes con FastAPI?"
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

            <label className="label">
              Puntuación máxima
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                name="max_points"
                value={form.max_points}
                onChange={handleChange}
              />
              {renderError("max_points")}
            </label>
          </div>

          {form.type === "select" ? (
            <>
              <label className="label">
                Opciones
                <textarea
                  className="textarea"
                  name="options"
                  value={form.options}
                  onChange={handleChange}
                  placeholder="Una opción por línea."
                />
              </label>
              {renderError("options")}
            </>
          ) : null}

          <label className="checkbox-row">
            <input type="checkbox" name="required" checked={form.required} onChange={handleChange} />
            <span>Pregunta obligatoria</span>
          </label>

          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Añadir pregunta"}
            </button>
          </div>
        </form>
      </section>

      {lastCreated ? (
        <section className="card">
          <h2 className="h2">Última pregunta registrada</h2>
          <pre className="code-block">{JSON.stringify(lastCreated, null, 2)}</pre>
        </section>
      ) : null}
    </>
  );
}
