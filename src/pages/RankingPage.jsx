import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Table from "../components/Table";
import VacancySelector from "../components/VacancySelector";
import { useAppContext } from "../context/AppContext";
import { getRanking } from "../lib/api";

function formatScore(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : value;
}

export default function RankingPage() {
  const { tenantId, vacancyId, setSelection } = useAppContext();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  // URL -> contexto. Depende SOLO de searchParams (no de vacancyId): si dependiera
  // de vacancyId, al cambiar la vacante desde el dropdown este efecto leería una URL
  // todavía sin actualizar y revertiría la selección, provocando un ping-pong con el
  // efecto inverso (la causa del parpadeo entre el ranking nuevo y el anterior).
  useEffect(() => {
    const queryVacancyId = String(searchParams.get("vacancyId") || "").trim();

    if (queryVacancyId && queryVacancyId !== vacancyId) {
      setSelection({ vacancyId: queryVacancyId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSelection]);

  useEffect(() => {
    if (!vacancyId) {
      return;
    }

    const currentQueryVacancyId = String(
      searchParams.get("vacancyId") || ""
    ).trim();

    if (currentQueryVacancyId === vacancyId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("vacancyId", vacancyId);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, vacancyId]);

  const loadRanking = useCallback(async () => {
    if (!tenantId || !vacancyId) {
      setRows([]);
      setTotal(0);
      setError("");
      setLoading(false);
      return;
    }

    // Solo la última petición puede actualizar el estado: descartamos respuestas
    // obsoletas (p. ej. la del ranking anterior que llega tarde por el arranque en
    // frío de Render), que es lo que hacía parpadear dos rankings a la vez.
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      setLoading(true);
      setError("");

      const data = await getRanking(tenantId, vacancyId);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setRows(Array.isArray(data?.items) ? data.items : []);
      setTotal(
        data?.total ?? (Array.isArray(data?.items) ? data.items.length : 0)
      );
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setRows([]);
      setTotal(0);
      setError(loadError.message || "No se pudo cargar el ranking.");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [tenantId, vacancyId]);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  const columns = [
    {
      key: "application_id",
      label: "Application ID",
      cell: (row) => (
        <button
          type="button"
          onClick={() => navigate(`/applications/${row.application_id}`)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "#2563eb",
            cursor: "pointer",
            textDecoration: "underline",
            font: "inherit",
            textAlign: "left",
          }}
        >
          {row.application_id}
        </button>
      ),
    },
    { key: "nombre", label: "Nombre" },
    { key: "telefono", label: "Teléfono" },
    { key: "vacante", label: "Vacante" },
    { key: "origin", label: "Origen" },
    { key: "channel", label: "Canal" },
    { key: "outbound_status", label: "Outbound" },
    {
      key: "score_rules",
      label: "Score preguntas",
      cell: (row) => formatScore(row.score_rules),
    },
    {
      key: "score_cv",
      label: "Score CV",
      cell: (row) => formatScore(row.score_cv),
    },
    {
      key: "score_total",
      label: "Score total",
      cell: (row) => formatScore(row.score_total),
    },
    { key: "estado", label: "Estado" },
  ];

  return (
    <>
      <section className="card">
        <h1 className="h1">Ranking de candidaturas</h1>
        <p className="muted">
          Consulta el ranking de candidaturas ordenadas por puntuación. Haz clic en el Application ID para ver el detalle individual de cada candidatura.
        </p>
      </section>

      <VacancySelector
        title="Contexto del ranking"
        description="Selecciona el tenant y la vacante para cargar el ranking de candidatos."
      />

      {!tenantId || !vacancyId ? (
        <div className="warning-box">
          Selecciona un tenant y una vacante para visualizar el ranking de candidaturas.
        </div>
      ) : null}

      {error ? <div className="error-box">{error}</div> : null}

      <section className="card">
        <div className="row-space">
          <div>
            <h2 className="h2">Ranking de candidaturas</h2>
            <p className="muted">
              Total de candidaturas evaluadas: <strong>{total}</strong>
            </p>
          </div>

          <button className="btn" type="button" onClick={loadRanking}>
            Recargar ranking
          </button>
        </div>

        <Table
          columns={columns}
          rows={rows}
          loading={loading}
          emptyText={
            tenantId && vacancyId
              ? "No hay candidaturas evaluadas para esta vacante."
              : "Selecciona un tenant y una vacante."
          }
        />
      </section>
    </>
  );
}
