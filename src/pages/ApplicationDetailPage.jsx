import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { getApplicationDetail } from "../lib/api";

function buildSummaryItems(data, tenantId, applicationId) {
  return [
    { label: "ID aplicación", value: data?.id || applicationId },
    { label: "Tenant", value: data?.tenant_id || tenantId },
    { label: "Vacancy ID", value: data?.vacancy_id },
    { label: "Candidate ID", value: data?.candidate_id },
    { label: "Origen", value: data?.origin },
    { label: "Canal preferido", value: data?.preferred_platform },
    { label: "Estado outbound", value: data?.last_outbound_status },
    { label: "Canal outbound", value: data?.last_outbound_channel },
    { label: "Template SID", value: data?.last_outbound_template_sid },
    { label: "Estado", value: data?.classification || data?.status },
    { label: "Score preguntas", value: data?.score_rules },
    { label: "Score CV", value: data?.score_cv },
    { label: "Score total", value: data?.score_total },
  ].filter((item) => item.value !== undefined && item.value !== null && item.value !== "");
}

export default function ApplicationDetailPage() {
  const { applicationId } = useParams();
  const { tenantId } = useAppContext();

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

  const summaryItems = useMemo(
    () => buildSummaryItems(data, tenantId, applicationId),
    [data, tenantId, applicationId]
  );

  return (
    <>
      <section className="card">
        <div className="row-space">
          <div>
            <h1 className="h1">Detalle de aplicación</h1>
            <p className="muted">
              Información detallada de la candidatura seleccionada: puntuaciones, estado y datos del proceso de selección.
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
          Esta página requiere un tenant activo. Seleccionálo desde el dashboard o el ranking antes de acceder al detalle.
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
            <h2 className="h2">Resumen</h2>

            <div className="detail-grid">
              {summaryItems.map((item) => (
                <div key={item.label} className="detail-item">
                  <span className="detail-label">{item.label}</span>
                  <span className="detail-value">{String(item.value)}</span>
                </div>
              ))}
            </div>
          </section>

          {data?.latest_cv ? (
            <section className="card">
              <h2 className="h2">Último CV asociado</h2>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">CV ID</span>
                  <span className="detail-value">{String(data.latest_cv.id)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Versión</span>
                  <span className="detail-value">{String(data.latest_cv.version)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Fichero</span>
                  <span className="detail-value">{String(data.latest_cv.original_filename)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">MIME</span>
                  <span className="detail-value">{String(data.latest_cv.mime_type)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Parse status</span>
                  <span className="detail-value">{String(data.latest_cv.parse_status)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Source platform</span>
                  <span className="detail-value">{String(data.latest_cv.source_platform)}</span>
                </div>
              </div>
            </section>
          ) : null}

          <section className="card">
            <h2 className="h2">Datos completos de la candidatura</h2>
            <pre className="code-block">
              {JSON.stringify(data, null, 2)}
            </pre>
          </section>
        </>
      ) : null}
    </>
  );
}
