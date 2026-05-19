import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import GenerateQuestionsProposalModal from "../components/GenerateQuestionsProposalModal";
import VacancySelector from "../components/VacancySelector";
import { useAppContext } from "../context/AppContext";
import {
  createVacancy,
  generateVacancyQuestionsFromRequirements,
  splitLinesToList,
} from "../lib/api";

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

  const cvMaxScore = Number(form.cv_max_score);
  if (!Number.isInteger(cvMaxScore) || cvMaxScore < 1 || cvMaxScore > 100) {
    errors.cv_max_score =
      "La puntuación máxima del CV debe ser un entero entre 1 y 100.";
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
    cv_max_score: "40",
    review: "35",
    interview: "60",
    shortlist: "75",
    status: "active",
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estado para el modal de propuesta de generación automática.
  // Cuando no es null, contiene { vacancy, requirements }.
  const [generationProposal, setGenerationProposal] = useState(null);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);

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

  // ── Handlers del modal de generación automática ────────────────────────────────

  async function handleAcceptGenerationProposal() {
    if (!generationProposal?.vacancy?.id) return;

    try {
      setGeneratingQuestions(true);

      const result = await generateVacancyQuestionsFromRequirements(
        generationProposal.vacancy.id,
        tenantId
      );

      pushFlash(
        "message",
        `Se generaron ${result?.created_count ?? 0} preguntas automáticamente con IA.`
      );
    } catch (error) {
      // La vacante ya se creó correctamente; solo fallaron las preguntas.
      // Informamos pero continuamos a la página de preguntas para que el
      // usuario pueda configurarlas manualmente.
      pushFlash(
        "error",
        error.message ||
          "La vacante se creó, pero no se pudieron generar las preguntas automáticamente."
      );
    } finally {
      const vacancyId = generationProposal.vacancy.id;
      setGeneratingQuestions(false);
      setGenerationProposal(null);
      navigate(`/vacancies/${vacancyId}/questions`);
    }
  }

  function handleRejectGenerationProposal() {
    const vacancyId = generationProposal?.vacancy?.id;
    setGenerationProposal(null);

    if (vacancyId) {
      navigate(`/vacancies/${vacancyId}/questions`);
    } else {
      navigate("/dashboard");
    }
  }

  // ── Submit del formulario ────────────────────────────────────────────────────

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateVacancyForm({ tenantId, form });
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const mandatoryRequirements = splitLinesToList(form.mandatory_requirements);

    const payload = {
      tenant_id: tenantId,
      code: form.code.trim() || `WEB-${Date.now()}`,
      title: form.title.trim(),
      description: form.description.trim(),
      responsibilities: splitLinesToList(form.responsibilities),
      mandatory_requirements: mandatoryRequirements,
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
      cv_max_score: Number(form.cv_max_score),
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
        setSelection({ vacancyId: createdVacancy.id });
      }

      pushFlash(
        "message",
        `Vacante creada correctamente: ${createdVacancy?.title || payload.title}.`
      );

      // Ofrecemos generación automática solo si la vacante tiene entre 1 y 10
      // requisitos obligatorios (límite del backend).
      const canOfferAutoGeneration =
        createdVacancy?.id &&
        mandatoryRequirements.length >= 1 &&
        mandatoryRequirements.length <= 10;

      if (canOfferAutoGeneration) {
        // Mostramos el modal; la navegación ocurre después de la elección del usuario.
        setGenerationProposal({
          vacancy: createdVacancy,
          requirements: mandatoryRequirements,
        });
        return;
      }

      // Sin propuesta: navegamos directamente a preguntas.
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
      {/* Modal de propuesta de generación automática con IA */}
      {generationProposal ? (
        <GenerateQuestionsProposalModal
          vacancyTitle={generationProposal.vacancy?.title}
          requirements={generationProposal.requirements}
          loading={generatingQuestions}
          onAccept={handleAcceptGenerationProposal}
          onReject={handleRejectGenerationProposal}
        />
      ) : null}
      <section className="card">
        <div className="row-space">
          <div>
            <h1 className="h1">Nueva vacante</h1>
            <p className="muted">
              Completa el formulario para publicar una nueva vacante en el sistema.
            </p>
          </div>

          <Link className="btn" to="/dashboard">
            Volver al dashboard
          </Link>
        </div>
      </section>

      <VacancySelector
        title="Tenant de la nueva vacante"
        description="La vacante se asociará al tenant seleccionado."
        showVacancyField={false}
        autoLoad={false}
        showLoadButton={false}
      />

      <section className="card">
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
                placeholder="Opcional. Se generará automáticamente si se deja en blanco."
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
              Puntuación máxima del CV
              <input
                className="input"
                type="number"
                min="1"
                max="100"
                name="cv_max_score"
                value={form.cv_max_score}
                onChange={handleChange}
              />
              {renderError("cv_max_score")}
            </label>

            <div className="notice">
              Puntos disponibles para preguntas:{" "}
              <strong>{Math.max(0, 100 - (Number(form.cv_max_score) || 0))}</strong> de 100.
              La suma de puntuaciones máximas de todas las preguntas debe igualar ese valor.
            </div>
          </div>

          <div className="form-grid grid-3">
            <label className="label">
              Puntuación mínima para revisión
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
              Puntuación mínima para entrevista
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
              Puntuación mínima para finalistas
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
