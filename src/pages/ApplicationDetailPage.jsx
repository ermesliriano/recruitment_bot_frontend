import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { getApplicationDetail } from "../lib/api";

function buildSummaryItems(data, tenantId, applicationId) {
  return [
    {
      label: "ID aplicación",
      value: data?.id || applicationId,
    },
    {
      label: "Tenant",
      value: data?.tenant_id || tenantId,
    },
    {
      label: "Vacancy ID",
      value: data?.vacancy_id,
    },
    {
      label: "Candidate ID",
      value: data?.candidate_id,
    },
    {
      label: "Estado",
      value: data?.classification || data?.status,
    },
    {
      label: "Score reglas",
      value: data?.score_rules,
    },
    {
      label: "Score CV",
      value: data?.score_cv,
    },
    {
      label: "Score total",
      value: data?.score_total,
    },
  ].filter(
    (item) =>
      item.value !== undefined && item.value !== null && item.value !== ""
  );
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
