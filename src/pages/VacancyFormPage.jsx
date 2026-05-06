import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import VacancySelector from "../components/VacancySelector";
import { useAppContext } from "../context/AppContext";
import { createVacancy, splitLinesToList } from "../lib/api";

function validateVacancyForm({ tenantId, form }) {
  const errors = {};

  if (!tenantId) {
    errors.tenantId = "Debes indicar un tenant_id antes de crear la vacante.";
  }

  if (!form.title.trim()) {
    errors.title = "El título es obligatorio.";
  }

  if (!form.description.trim()) {
    errors.description = "La descripción es obligatoria.";
  }

  const cvScoreFactor = Number(form.cv_score_factor);
  if (!Number.isFinite(cvScoreFactor) || cvScoreFactor <= 0) {
    errors.cv_score_factor =
      "El factor de score CV debe ser un número mayor que 0.";
  }

  const review = Number(form.review);
  const interview = Number(form.interview);
  const shortlist = Number(form.shortlist);

  if (
    !Number.isFinite(review) ||
    !Number.isFinite(interview) ||
    !Number.isFinite(shortlist)
  ) {
    errors.thresholds = "Los tres umbrales deben ser numéricos.";
  } else if (!(review < interview && interview < shortlist)) {
    errors.thresholds =
      "Los umbrales deben cumplir review < interview < shortlist.";
  }

  return errors;
}

export default function VacancyFormPage() {
  const { tenantId, setSelection, pushFlash } = useAppContext();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    code: "",
    title: "",
    description: "",
    responsibilities: "",
    mandatory_requirements: "",
    desirable_requirements: "",
    salary_text: "",
    schedule_text: "",
    location_text: "",
    benefits: "",
    cv_score_factor: "6",
    review: "35",
    interview: "60",
    shortlist: "75",
    status: "active",
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function renderError(name) {
    return errors[name] ? <div className="field-error">{errors[name]}</div> : null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateVacancyForm({ tenantId, form });
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = {
      tenant_id: tenantId,
      code: form.code.trim() || `WEB-${Date.now()}`,
      title: form.title.trim(),
      description: form.description.trim(),
      responsibilities: splitLinesToList(form.responsibilities),
      mandatory_requirements: splitLinesToList(
        form.mandatory_requirements
      ),
      desirable_requirements: splitLinesToList(
        form.desirable_requirements
      ),
      salary_text: form.salary_text.trim() || null,
      schedule_text: form.schedule_text.trim() || null,
      location_text: form.location_text.trim() || null,
      benefits: splitLinesToList(form.benefits),
      faq_context: {
        items: [],
      },
      cv_score_factor: Number(form.cv_score_factor),
      classification_thresholds: {
        review: Number(form.review),
        interview: Number(form.interview),
        shortlist: Number(form.shortlist),
      },
      status: form.status.trim() || "active",
    };

    try {
      setSubmitting(true);

      const createdVacancy = await createVacancy(payload);

      if (createdVacancy?.id) {
        setSelection({
          vacancyId: createdVacancy.id,
        });
      }

      pushFlash(
        "message",
        `Vacante creada: ${createdVacancy?.title || payload.title}. El backend respondió con estado "${createdVacancy?.status || "desconocido"}".`
      );

      if (createdVacancy?.id) {
        navigate(`/vacancies/${createdVacancy.id}/questions`);
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      setErrors({
        submit: error.message || "No se pudo crear la vacante.",
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
            <h1 className="h1">Nueva vacante</h1>
            <p className="muted">
              Esta vista reemplaza el formulario de alta de voluntario por un
              formulario de alta de vacante compatible con tu `POST /vacancies/`.
            </p>
          </div>

          <Link className="btn" to="/dashboard">
            Volver al dashboard
          </Link>
        </div>
      </section>

      <VacancySelector
        title="Tenant de la nueva vacante"
        description="Para crear una vacante solo necesitas fijar el tenant_id."
        showVacancyField={false}
        autoLoad={false}
        showLoadButton={false}
      />

      <section className="card">
        <div className="warning-box">
          El payload enviado modela únicamente los campos que ya has probado con
          tu backend: metadatos básicos, listas, umbrales, score CV y{" "}
          <code>{"faq_context: { items: [] }"}</code>. Si más adelante documentas
          más campos, añádelos en `src/lib/api.js` y en este formulario.
        </div>

        {renderError("tenantId")}
        {renderError("thresholds")}
        {renderError("submit")}

        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="form-grid grid-2">
            <label className="label">
              Título
              <input
                className="input"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Ej. Backend Python FastAPI"
              />
              {renderError("title")}
            </label>

            <label className="label">
              Código
              <input
                className="input"
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="Opcional. Si lo dejas vacío se generará WEB-timestamp"
              />
            </label>
          </div>

          <label className="label">
            Descripción
            <textarea
              className="textarea"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe el rol, el objetivo y el contexto de la vacante."
            />
            {renderError("description")}
          </label>

          <div className="form-grid grid-2">
            <label className="label">
              Ubicación
              <input
                className="input"
                name="location_text"
                value={form.location_text}
                onChange={handleChange}
                placeholder="Madrid / remoto / híbrido"
              />
            </label>

            <label className="label">
              Salario
              <input
                className="input"
                name="salary_text"
                value={form.salary_text}
                onChange={handleChange}
                placeholder="Ej. 45k - 55k"
              />
            </label>
          </div>

          <div className="form-grid grid-2">
            <label className="label">
              Horario
              <input
                className="input"
                name="schedule_text"
                value={form.schedule_text}
                onChange={handleChange}
                placeholder="L-V 9:00-18:00"
              />
            </label>

            <label className="label">
              Estado
              <select
                className="input"
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                <option value="active">active</option>
                <option value="draft">draft</option>
              </select>
            </label>
          </div>

          <div className="form-grid grid-2">
            <label className="label">
              Responsabilidades
              <textarea
                className="textarea"
                name="responsibilities"
                value={form.responsibilities}
                onChange={handleChange}
                placeholder="Una responsabilidad por línea"
              />
            </label>

            <label className="label">
              Beneficios
              <textarea
                className="textarea"
                name="benefits"
                value={form.benefits}
                onChange={handleChange}
                placeholder="Un beneficio por línea"
              />
            </label>
          </div>

          <div className="form-grid grid-2">
            <label className="label">
              Requisitos obligatorios
              <textarea
                className="textarea"
                name="mandatory_requirements"
                value={form.mandatory_requirements}
                onChange={handleChange}
                placeholder="Un requisito por línea"
              />
            </label>

            <label className="label">
              Requisitos deseables
              <textarea
                className="textarea"
                name="desirable_requirements"
                value={form.desirable_requirements}
                onChange={handleChange}
                placeholder="Un requisito por línea"
              />
            </label>
          </div>

          <div className="form-grid grid-2">
            <label className="label">
              Factor score CV
              <input
                className="input"
                type="number"
                step="0.1"
                min="0"
                name="cv_score_factor"
                value={form.cv_score_factor}
                onChange={handleChange}
              />
              {renderError("cv_score_factor")}
            </label>

            <div className="notice">
              Escribe las listas con un elemento por línea. El frontend las
              convertirá a arrays antes de hacer el `POST`.
            </div>
          </div>

          <div className="form-grid grid-3">
            <label className="label">
              Threshold review
              <input
                className="input"
                type="number"
                min="0"
                name="review"
                value={form.review}
                onChange={handleChange}
              />
            </label>

            <label className="label">
              Threshold interview
              <input
                className="input"
                type="number"
                min="0"
                name="interview"
                value={form.interview}
                onChange={handleChange}
              />
            </label>

            <label className="label">
              Threshold shortlist
              <input
                className="input"
                type="number"
                min="0"
                name="shortlist"
                value={form.shortlist}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar vacante"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
