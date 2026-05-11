import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  buildQuestionPayload,
  createVacancyQuestion,
  splitLinesToList,
} from "../lib/api";

function validateQuestionForm({ routeVacancyId, form, parsedManualPayload }) {
  const errors = {};

  if (!routeVacancyId) {
    errors.submit = "La URL no contiene vacancy_id.";
  }

  if (form.manualJson) {
    if (!form.rawJson.trim()) {
      errors.rawJson = "Pega un JSON válido.";
    } else if (!parsedManualPayload.ok) {
      errors.rawJson = parsedManualPayload.message;
    }
  } else {
    if (!form.text.trim()) {
      errors.text = "El enunciado es obligatorio.";
    }

    if (!String(form.order).trim()) {
      errors.order = "El orden es obligatorio.";
    } else {
      const numericOrder = Number(form.order);
      if (!Number.isInteger(numericOrder) || numericOrder < 1) {
        errors.order = "El orden debe ser un entero mayor o igual que 1.";
      }
    }

    const maxPts = Number(form.max_points);
    if (!Number.isInteger(maxPts) || maxPts < 0 || maxPts > 100) {
      errors.max_points = "La puntuación máxima debe ser un entero entre 0 y 100.";
    }

    if (form.type === "select" && splitLinesToList(form.options).length === 0) {
      errors.options =
        "Para el tipo select debes indicar una opción por línea.";
    }
  }

  return errors;
}

export default function VacancyQuestionsPage() {
  const { vacancyId } = useParams();
  const routeVacancyId = String(vacancyId || "").trim();

  const { pushFlash, setSelection } = useAppContext();

  const [form, setForm] = useState({
    code: "",
    text: "",
    type: "text",
    order: "1",
    required: true,
    options: "",
    max_points: "0",
    manualJson: false,
    rawJson: "",
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (routeVacancyId) {
      setSelection({
        vacancyId: routeVacancyId,
      });
    }
  }, [routeVacancyId, setSelection]);

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

  const computedPayloadText = useMemo(
    () => JSON.stringify(computedPayload, null, 2),
    [computedPayload]
  );

  const parsedManualPayload = useMemo(() => {
    if (!form.rawJson.trim()) {
      return {
        ok: false,
        message: "El JSON está vacío.",
      };
    }

    try {
      const value = JSON.parse(form.rawJson);

      if (!value || Array.isArray(value) || typeof value !== "object") {
        return {
          ok: false,
          message: "El JSON debe representar un objeto.",
        };
      }

      return {
        ok: true,
        value,
      };
    } catch {
      return {
        ok: false,
        message: "El JSON no es válido.",
      };
    }
  }, [form.rawJson]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleManualToggle(event) {
    const checked = event.target.checked;

    setForm((current) => ({
      ...current,
      manualJson: checked,
      rawJson: checked && !current.rawJson ? computedPayloadText : current.rawJson,
    }));
  }

  function renderError(name) {
    return errors[name] ? <div className="field-error">{errors[name]}</div> : null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateQuestionForm({
      routeVacancyId,
      form,
      parsedManualPayload,
    });

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = form.manualJson
      ? parsedManualPayload.value
      : computedPayload;

    try {
      setSubmitting(true);

      const createdQuestion = await createVacancyQuestion(
        routeVacancyId,
        payload
      );

      setResult(createdQuestion);

      pushFlash("message", "Pregunta creada correctamente.");

      setForm((current) => ({
        ...current,
        code: "",
        text: "",
        order: String(Number(current.order || 1) + 1),
        options: "",
        max_points: "0",
        manualJson: false,
        rawJson: "",
      }));

      setErrors({});
    } catch (error) {
      setErrors({
        submit: error.message || "No se pudo crear la pregunta.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="card">
        <div className="row-space">
          <div>
            <h1 className="h1">Nueva pregunta</h1>
            <p className="muted">
              Vacante actual: <strong>{routeVacancyId || "No definida"}</strong>
            </p>
          </div>

          <div className="row">
            <Link className="btn" to="/dashboard">
              Dashboard
            </Link>

            {routeVacancyId ? (
              <Link className="btn" to={`/ranking?vacancyId=${routeVacancyId}`}>
                Ver ranking
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {!routeVacancyId ? (
        <div className="error-box">
          No se ha podido identificar la vacante. Accede a esta pantalla desde el dashboard o el listado de vacantes.
        </div>
      ) : null}

      <section className="card">
        {/* Formulario de creación de pregunta para la vacante activa */}

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
                placeholder="Opcional. Identificador interno de la pregunta."
              />
            </label>

            <label className="label">
              Tipo
              <select
                className="input"
                name="type"
                value={form.type}
                onChange={handleChange}
              >
                <option value="text">text</option>
                <option value="textarea">textarea</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="select">select</option>
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

          <label className="label">
            Opciones
            <textarea
              className="textarea"
              name="options"
              value={form.options}
              onChange={handleChange}
              placeholder="Solo para preguntas tipo select. Una opción por línea."
            />
          </label>
          {renderError("options")}

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.manualJson}
              onChange={handleManualToggle}
            />
            <span>Editar JSON manualmente</span>
          </label>

          <label className="label">
            JSON a enviar
            <textarea
              className="textarea"
              name="rawJson"
              value={form.manualJson ? form.rawJson : computedPayloadText}
              onChange={handleChange}
              readOnly={!form.manualJson}
              placeholder="El JSON calculado aparecerá aquí."
            />
          </label>
          {renderError("rawJson")}

          <div className="notice">
            El JSON generado puede editarse manualmente si la configuración de la vacante requiere campos adicionales.
          </div>

          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar pregunta"}
            </button>
          </div>
        </form>
      </section>

      {result ? (
        <section className="card">
          <h2 className="h2">Pregunta registrada</h2>
          <pre className="code-block">{JSON.stringify(result, null, 2)}</pre>
        </section>
      ) : null}
    </>
  );
}
