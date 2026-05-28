import { useEffect, useState } from "react";
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
  const [applicationId, setApplicationId] = useState("");

  useEffect(() => {
    const queryVacancyId = String(searchParams.get("vacancyId") || "").trim();

    if (queryVacancyId && queryVacancyId !== vacancyId) {
      setSelection({
        vacancyId: queryVacancyId,
      });
    }
  }, [searchParams, vacancyId, setSelection]);

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

  async function loadRanking() {
    if (!tenantId || !vacancyId) {
      setRows([]);
      setTotal(0);
      setError("");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await getRanking(tenantId, vacancyId);

      setRows(Array.isArray(data?.items) ? data.items : []);
      setTotal(
        data?.total ?? (Array.isArray(data?.items) ? data.items.length : 0)
      );
    } catch (loadError) {
      setRows([]);
      setTotal(0);
      setError(loadError.message || "No se pudo cargar el ranking.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRanking();
  }, [tenantId, vacancyId]);

  function handleOpenApplication(event) {
    event.preventDefault();

    const normalizedApplicationId = String(applicationId || "").trim();
    if (!normalizedApplicationId) {
      return;
    }

    navigate(`/applications/${normalizedApplicationId}`);
  }

  const columns = [
    { key: "application_id", label: "Application ID" },
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
          Consulta el ranking de candidaturas ordenadas por puntuación. Accede al detalle individual de cada aplicación introduciendosu identificador.
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

        {/* Acceso directo al detalle de una candidatura por identificador */}

        <form className="inline-form" onSubmit={handleOpenApplication}>
          <label className="label">
            Consultar candidatura por ID
            <input
              className="input"
              value={applicationId}
              onChange={(event) => setApplicationId(event.target.value)}
              placeholder="Introduce el ID de la candidatura"
            />
          </label>

          <button className="btn" type="submit">
            Ver detalle
          </button>
        </form>

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
