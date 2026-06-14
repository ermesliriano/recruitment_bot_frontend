// src/pages/VacancyEditPage.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import VacancyBudgetModal from "../components/VacancyBudgetModal";
import {
  getVacancy,
  listVacancyQuestions,
  splitLinesToList,
  updateVacancy,
} from "../lib/api";
import { getVacancyBudget, isActiveVacancy } from "../lib/scoringBudget";

function validateForm(form) {
  const errors = {};

  if (!form.title.trim()) errors.title = "El título es obligatorio.";
  if (!form.description.trim()) errors.description = "La descripción es obligatoria.";

  const cvMaxScore = Number(form.cv_max_score);
  if (!Number.isInteger(cvMaxScore) || cvMaxScore < 0 || cvMaxScore > 100) {
    errors.cv_max_score = "La puntuación máxima del CV debe ser un entero entre 0 y 100.";
  }

  const review = Number(form.review);
  const interview = Number(form.interview);
  const shortlist = Number(form.shortlist);
  if (!Number.isFinite(review) || !Number.isFinite(interview) || !Number.isFinite(shortlist)) {
    errors.thresholds = "Los tres umbrales deben ser numéricos.";
  } else if (!(review < interview && interview < shortlist)) {
    errors.thresholds = "Las puntuaciones deben ir en orden ascendente: revisión < entrevista < finalistas.";
  }

  return errors;
}

function arrToText(arr) {
  return Array.isArray(arr) ? arr.join("\n") : (arr || "");
}

export default function VacancyEditPage() {
  const { vacancyId } = useParams();
  const { pushFlash } = useAppContext();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadedVacancy, setLoadedVacancy] = useState(null);
  const [budgetModal, setBudgetModal] = useState(null);
  const [usedPoints, setUsedPoints] = useState(0);

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
  });

  useEffect(() => {
    if (!vacancyId) return;
    let ignore = false;

    async function load() {
      try {
        setLoading(true);
        setLoadError("");
        const v = await getVacancy(vacancyId);
        if (ignore) return;

        setLoadedVacancy(v);
        
        const thresholds = v.classification_thresholds || { review: 35, interview: 60, shortlist: 75 };

        setForm({
          code: v.code || "",
          title: v.title || "",
          description: v.description || "",
          responsibilities: arrToText(v.responsibilities),
          mandatory_requirements: arrToText(v.mandatory_requirements),
          desirable_requirements: arrToText(v.desirable_requirements),
          salary_text: v.salary_text || "",
          schedule_text: v.schedule_text || "",
          location_text: v.location_text || "",
          benefits: arrToText(v.benefits),
          cv_max_score: String(v.cv_max_score ?? 40),
          review: String(thresholds.review ?? 35),
          interview: String(thresholds.interview ?? 60),
          shortlist: String(thresholds.shortlist ?? 75),
        });
      } catch (err) {
        if (!ignore) setLoadError(err.message || "No se pudo cargar la vacante.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => { ignore = true; };
  }, [vacancyId]);

  // Carga no bloqueante de las preguntas para mostrar los puntos ya utilizados.
  // Se hace en un efecto aparte para no retrasar la aparición del formulario.
  useEffect(() => {
    if (!vacancyId) return;
    let ignore = false;

    listVacancyQuestions(vacancyId)
      .then((questions) => {
        if (ignore) return;
        const list = Array.isArray(questions) ? questions : [];
        setUsedPoints(
          list.reduce((sum, q) => sum + (Number(q.max_points) || 0), 0)
        );
      })
      .catch(() => {
        if (!ignore) setUsedPoints(0);
      });

    return () => {
      ignore = true;
    };
  }, [vacancyId]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((cur) => ({ ...cur, [name]: value }));
  }

  function renderError(name) {
    return errors[name] ? <div className="field-error">{errors[name]}</div> : null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      responsibilities: splitLinesToList(form.responsibilities),
      mandatory_requirements: splitLinesToList(form.mandatory_requirements),
      desirable_requirements: splitLinesToList(form.desirable_requirements),
      salary_text: form.salary_text.trim() || null,
      schedule_text: form.schedule_text.trim() || null,
      location_text: form.location_text.trim() || null,
      benefits: splitLinesToList(form.benefits),
      faq_context: { items: [] },
      cv_max_score: Number(form.cv_max_score),
      classification_thresholds: {
        review: Number(form.review),
        interview: Number(form.interview),
        shortlist: Number(form.shortlist),
      },
    };

    if (isActiveVacancy(loadedVacancy)) {
      try {
        setSubmitting(true);

        const questions = await listVacancyQuestions(vacancyId);
        const budget = getVacancyBudget({
          vacancy: {
            ...loadedVacancy,
            cv_max_score: Number(form.cv_max_score),
          },
          questions,
        });

        if (!budget.isValid) {
          setBudgetModal({
            vacancy: {
              ...loadedVacancy,
              cv_max_score: Number(form.cv_max_score),
            },
            total: budget.total,
            questionsTotal: budget.questionsTotal,
          });

          return;
        }
      } catch (err) {
        setErrors({
          submit:
            err.message ||
            "No se pudo validar la puntuación máxima antes de guardar.",
        });
        return;
      } finally {
        setSubmitting(false);
      }
    }
    
    try {
      setSubmitting(true);
      await updateVacancy(vacancyId, payload);
      pushFlash("message", "Vacante actualizada correctamente.");
      navigate("/dashboard");
    } catch (err) {
      setErrors({ submit: err.message || "No se pudo actualizar la vacante." });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="card">
        <p className="muted">Cargando vacante…</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="card">
        <div className="error-box">{loadError}</div>
        <div style={{ marginTop: 16 }}>
          <Link className="btn" to="/dashboard">Volver al dashboard</Link>
        </div>
      </section>
    );
  }

  return (
    <>
      {budgetModal ? (
        <VacancyBudgetModal
        vacancy={budgetModal.vacancy}
        total={budgetModal.total}
        questionsTotal={budgetModal.questionsTotal}
        onClose={() => setBudgetModal(null)}
        onGoToQuestions={() => {
          navigate(`/vacancies/${vacancyId}/questions`);
          setBudgetModal(null);
        }}
      />
    ) : null}
      
      <section className="card">
        <div className="row-space">
          <div>
            <h1 className="h1">Editar vacante</h1>
            <p className="muted">
              Código: <strong>{form.code}</strong> · ID: <strong>{vacancyId}</strong>
            </p>
          </div>
          <div className="row">
            <Link className="btn" to="/dashboard">Volver al dashboard</Link>
            <Link className="btn" to={`/vacancies/${vacancyId}/questions`}>Ver preguntas</Link>
          </div>
        </div>
      </section>

      <section className="card">
        {renderError("submit")}
        {renderError("thresholds")}

        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="form-grid grid-2">
            <label className="label">
              Título
              <input className="input" name="title" value={form.title} onChange={handleChange} />
              {renderError("title")}
            </label>
            <label className="label">
              Código
              <input className="input" name="code" value={form.code} disabled style={{ opacity: 0.6 }} />
            </label>
          </div>

          <label className="label">
            Descripción
            <textarea className="textarea" name="description" value={form.description} onChange={handleChange} />
            {renderError("description")}
          </label>

          <div className="form-grid grid-2">
            <label className="label">
              Ubicación
              <input className="input" name="location_text" value={form.location_text} onChange={handleChange} placeholder="Madrid / remoto / híbrido" />
            </label>
            <label className="label">
              Salario
              <input className="input" name="salary_text" value={form.salary_text} onChange={handleChange} placeholder="Ej. 45k - 55k" />
            </label>
          </div>

          <label className="label">
            Horario
            <input className="input" name="schedule_text" value={form.schedule_text} onChange={handleChange} placeholder="L-V 9:00-18:00" />
          </label>

          <div className="form-grid grid-2">
            <label className="label">
              Responsabilidades
              <textarea className="textarea" name="responsibilities" value={form.responsibilities} onChange={handleChange} placeholder="Una responsabilidad por línea" />
            </label>
            <label className="label">
              Beneficios
              <textarea className="textarea" name="benefits" value={form.benefits} onChange={handleChange} placeholder="Un beneficio por línea" />
            </label>
          </div>

          <div className="form-grid grid-2">
            <label className="label">
              Requisitos obligatorios
              <textarea className="textarea" name="mandatory_requirements" value={form.mandatory_requirements} onChange={handleChange} placeholder="Un requisito por línea" />
            </label>
            <label className="label">
              Requisitos deseables
              <textarea className="textarea" name="desirable_requirements" value={form.desirable_requirements} onChange={handleChange} placeholder="Un requisito por línea" />
            </label>
          </div>

          <div className="form-grid grid-2">
            <label className="label">
              Puntuación máxima del CV
              <input
                className="input"
                type="number"
                min="0"
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
              <br />
              Puntos ya utilizados en preguntas: <strong>{usedPoints}</strong>
            </div>
          </div>

          <div className="form-grid grid-3">
            <label className="label">
              Puntuación mínima para revisión
              <input className="input" type="number" min="0" name="review" value={form.review} onChange={handleChange} />
            </label>
            <label className="label">
              Puntuación mínima para entrevista
              <input className="input" type="number" min="0" name="interview" value={form.interview} onChange={handleChange} />
            </label>
            <label className="label">
              Puntuación mínima para finalistas
              <input className="input" type="number" min="0" name="shortlist" value={form.shortlist} onChange={handleChange} />
            </label>
          </div>

          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
