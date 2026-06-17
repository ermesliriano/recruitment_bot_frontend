import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { getApplicationDetail } from "../lib/api";
import { formatOrigin, formatRecommendation } from "../lib/labels";

function formatScore(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value);
}

function formatPlain(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}

function buildSummaryItems(data) {
  const estado = data?.classification || data?.status;

  const items = [
    { label: "Empresa", value: formatPlain(data?.tenant_name) },
    { label: "Vacante", value: formatPlain(data?.vacancy_title) },
    { label: "Candidato", value: formatPlain(data?.candidate_full_name) },
    { label: "Teléfono", value: formatPlain(data?.candidate_phone) },
    { label: "Origen", value: formatOrigin(data?.origin) },
    { label: "Canal", value: formatPlain(data?.preferred_platform) },
    { label: "Estado", value: formatPlain(estado) },
    { label: "Estado outbound", value: formatPlain(data?.last_outbound_status) },
    { label: "Score preguntas", value: formatScore(data?.score_rules) },
    { label: "Score CV", value: formatScore(data?.score_cv) },
    { label: "Score total", value: formatScore(data?.score_total) },
  ];

  if (data?.is_disqualified) {
    items.push({
      label: "Descalificado",
      value: data?.disqualification_reason
        ? `Sí — ${data.disqualification_reason}`
        : "Sí",
    });
  }

  return items;
}

function AnalysisText({ label, value }) {
  if (!value) return null;
  return (
    <div className="analysis-section">
      <span className="detail-label">{label}</span>
      <p className="analysis-text">{value}</p>
    </div>
  );
}

function AnalysisList({ label, items }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length === 0) return null;
  return (
    <div className="analysis-section">
      <span className="detail-label">{label}</span>
      <ul className="analysis-list">
        {list.map((item, index) => (
          <li key={`${label}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function analysisHasContent(analysis) {
  if (!analysis) return false;
  return Boolean(
    analysis.human_readable_summary ||
      analysis.qualitative_assessment ||
      analysis.score_rationale ||
      analysis.recommended_next_action ||
      analysis.skills?.length ||
      analysis.experience_summary?.length ||
      analysis.red_flags?.length ||
      analysis.missing_evidence?.length ||
      analysis.fit_gaps?.length ||
      analysis.follow_up_questions?.length
  );
}

export default function ApplicationDetailPage() {
  const { applicationId } = useParams();
  const { tenantId } = useAppContext();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadApplicationDetail() {
      if (!tenantId || !applicationId) {
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await getApplicationDetail(tenantId, applicationId);

        if (!ignore) {
          setData(response);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError.message || "No se pudo cargar el detalle de la aplicación."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadApplicationDetail();

    return () => {
      ignore = true;
    };
  }, [tenantId, applicationId]);

  const summaryItems = useMemo(() => buildSummaryItems(data), [data]);

  const answers = Array.isArray(data?.answers) ? data.answers : [];
  const otherApplications = Array.isArray(data?.other_applications)
    ? data.other_applications
    : [];
  const analysis = data?.analysis || null;

  return (
    <>
      <section className="card">
        <div className="row-space">
          <div>
            <h1 className="h1">Detalle de aplicación</h1>
            <p className="muted">
              Información detallada de la candidatura seleccionada: respuestas del
              candidato, análisis del CV y otras candidaturas dentro de la empresa.
            </p>
          </div>

          <div className="row">
            <Link className="btn" to="/ranking">
              Volver al ranking
            </Link>
            <Link className="btn" to="/dashboard">
              Dashboard
            </Link>
          </div>
        </div>
      </section>

      {!tenantId ? (
        <div className="warning-box">
          Esta página requiere un tenant activo. Selecciónalo desde el dashboard o el ranking antes de acceder al detalle.
        </div>
      ) : null}

      {error ? <div className="error-box">{error}</div> : null}

      {loading ? (
        <section className="card">
          <p className="muted">Cargando detalle de la aplicación...</p>
        </section>
      ) : null}

      {data ? (
        <>
          <section className="card">
            <h2 className="h2">Detalles de la aplicación</h2>

            <div className="detail-grid">
              {summaryItems.map((item) => (
                <div key={item.label} className="detail-item">
                  <span className="detail-label">{item.label}</span>
                  <span className="detail-value">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="recommendation-block">
              <span className="detail-label">Recomendación del análisis</span>
              <p className="recommendation-text">
                {data.recommendation
                  ? formatRecommendation(data.recommendation)
                  : "Esta candidatura aún no tiene una recomendación generada por el análisis del CV."}
              </p>
            </div>
          </section>

          <section className="card">
            <h2 className="h2">Análisis del CV</h2>
            {analysisHasContent(analysis) ? (
              <>
                <AnalysisText
                  label="Resumen ejecutivo"
                  value={analysis.human_readable_summary}
                />
                <AnalysisText
                  label="Valoración cualitativa"
                  value={analysis.qualitative_assessment}
                />
                <AnalysisText
                  label="Justificación de la puntuación"
                  value={analysis.score_rationale}
                />
                <AnalysisText
                  label="Acción recomendada"
                  value={analysis.recommended_next_action}
                />
                <AnalysisList label="Competencias" items={analysis.skills} />
                <AnalysisList
                  label="Resumen de experiencia"
                  items={analysis.experience_summary}
                />
                <AnalysisList
                  label="Alertas (red flags)"
                  items={analysis.red_flags}
                />
                <AnalysisList
                  label="Información no evidenciada"
                  items={analysis.missing_evidence}
                />
                <AnalysisList
                  label="Brechas frente al perfil"
                  items={analysis.fit_gaps}
                />
                <AnalysisList
                  label="Preguntas de seguimiento"
                  items={analysis.follow_up_questions}
                />
              </>
            ) : (
              <p className="muted">
                El análisis cualitativo aún no está disponible para esta candidatura.
              </p>
            )}
          </section>

          <section className="card">
            <h2 className="h2">Respuestas del candidato</h2>
            {answers.length === 0 ? (
              <p className="muted">
                Esta candidatura aún no tiene respuestas registradas.
              </p>
            ) : (
              <div className="detail-grid">
                {answers.map((answer, index) => (
                  <div
                    key={`${answer.field_key || "respuesta"}-${index}`}
                    className="detail-item"
                  >
                    <span className="detail-label">
                      {answer.question_order != null
                        ? `${answer.question_order}. ${answer.prompt}`
                        : answer.prompt}
                    </span>
                    <span className="detail-value">
                      {formatPlain(answer.answer)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="h2">Texto extraído del CV</h2>
            {data.cv_extracted_text ? (
              <div className="cv-transcript">{data.cv_extracted_text}</div>
            ) : (
              <p className="muted">
                No hay texto extraído del CV para esta candidatura.
              </p>
            )}
          </section>

          <section className="card">
            <h2 className="h2">Otras candidaturas en la empresa</h2>
            {otherApplications.length === 0 ? (
              <p className="muted">
                Este candidato no ha aplicado a otras vacantes de la empresa.
              </p>
            ) : (
              <div className="question-list">
                {otherApplications.map((other) => (
                  <div key={String(other.application_id)} className="question-row">
                    <span className="question-row-info">
                      <button
                        type="button"
                        className="vacancy-title-btn"
                        onClick={() =>
                          navigate(`/applications/${other.application_id}`)
                        }
                      >
                        {other.vacancy_title || "Vacante sin título"}
                      </button>
                      <span className="question-row-meta">
                        Estado: {formatPlain(other.classification || other.status)}
                      </span>
                    </span>
                    <span className="question-row-points">
                      {formatScore(other.score_total)} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
