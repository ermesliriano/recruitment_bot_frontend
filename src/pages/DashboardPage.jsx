import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../components/StatCard";
import Table from "../components/Table";
import VacancySelector from "../components/VacancySelector";
import { useAppContext } from "../context/AppContext";
import { getRanking } from "../lib/api";

export default function DashboardPage() {
  const {
    authState,
    currentUserLabel,
    tenantId,
    vacancyId,
    setSelection,
  } = useAppContext();

  const navigate = useNavigate();

  const [vacancies, setVacancies] = useState([]);
  const [rankingTotal, setRankingTotal] = useState(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState("");

  useEffect(() => {
    let ignore = false;

    if (!tenantId || !vacancyId) {
      setRankingTotal(null);
      setRankingError("");
      return undefined;
    }

    async function loadRankingSummary() {
      try {
        setRankingLoading(true);
        setRankingError("");

        const data = await getRanking(tenantId, vacancyId);

        if (!ignore) {
          setRankingTotal(
            data?.total ?? (Array.isArray(data?.items) ? data.items.length : 0)
          );
        }
      } catch (error) {
        if (!ignore) {
          setRankingTotal(null);
          setRankingError(
            error.message || "No se pudo cargar el ranking actual."
          );
        }
      } finally {
        if (!ignore) {
          setRankingLoading(false);
        }
      }
    }

    loadRankingSummary();

    return () => {
      ignore = true;
    };
  }, [tenantId, vacancyId]);

  const selectedVacancy = useMemo(
    () => vacancies.find((item) => item.id === vacancyId) || null,
    [vacancies, vacancyId]
  );

  function handleUseVacancy(row) {
    setSelection({
      vacancyId: row.id,
    });
  }

  function handleOpenRanking(row) {
    setSelection({
      vacancyId: row.id,
    });
    navigate(`/ranking?vacancyId=${row.id}`);
  }

  function handleOpenQuestions(row) {
    setSelection({
      vacancyId: row.id,
    });
    navigate(`/vacancies/${row.id}/questions`);
  }

  const columns = [
    {
      key: "code",
      label: "Código",
    },
    {
      key: "title",
      label: "Título",
    },
    {
      key: "status",
      label: "Estado",
    },
    {
      key: "id",
      label: "ID",
    },
  ];

  return (
    <>
      <section className="card">
        <h1 className="h1">Dashboard</h1>
        <p className="muted">
          Resumen general del estado del sistema: vacantes activas, candidaturas evaluadas y acceso rápido a las operaciones principales.
        </p>
      </section>

      <VacancySelector
        title="Tenant y vacante de trabajo"
        description="Selecciona el tenant y la vacante con la que quieres trabajar en ranking, detalle y formularios."
        onLoaded={setVacancies}
      />

      <section className="grid grid-stats">
        <StatCard
          title="Vacantes del tenant"
          value={vacancies.length}
          description={
            tenantId
              ? `Tenant actual: ${tenantId}`
              : "Define primero un tenant_id para cargar vacantes."
          }
          actionLabel="Crear vacante"
          actionTo="/vacancies/new"
          actionVariant="primary"
        />

        <StatCard
          title="Vacante activa"
          value={
            selectedVacancy?.title ||
            (vacancyId ? vacancyId : "Sin seleccionar")
          }
          description={
            selectedVacancy
              ? `ID: ${selectedVacancy.id}`
              : "Selecciona una vacante para activar el ranking y el detalle de candidaturas."
          }
          actionLabel={vacancyId ? "Abrir ranking" : "Selecciona vacante"}
          actionTo={vacancyId ? `/ranking?vacancyId=${vacancyId}` : undefined}
          disabled={!vacancyId}
        />

        <StatCard
          title="Candidaturas evaluadas"
          value={rankingLoading ? "…" : rankingTotal ?? "—"}
          description="Número de candidaturas evaluadas para la vacante seleccionada."
          actionLabel={vacancyId ? "Ver ranking" : "Sin vacante activa"}
          actionTo={vacancyId ? `/ranking?vacancyId=${vacancyId}` : undefined}
          disabled={!vacancyId}
        />

        <StatCard
          title="Sesión"
          value={authState.isEnvToken ? "Token .env" : "Token local"}
          description={`Operador actual: ${currentUserLabel}`}
        />
      </section>

      {rankingError ? (
        <div className="error-box">
          No se pudo cargar el resumen del ranking actual: {rankingError}
        </div>
      ) : null}

      <section className="card">
        <div className="row-space">
          <div>
            <h2 className="h2">Vacantes del tenant</h2>
            <p className="muted">
              Listado de vacantes del tenant con acceso directo al ranking, preguntas y configuración.
            </p>
          </div>

          <button
            className="btn primary"
            type="button"
            onClick={() => navigate("/vacancies/new")}
          >
            Crear vacante
          </button>
        </div>

        <Table
          columns={columns}
          rows={vacancies}
          emptyText={
          tenantId
          ? "No hay vacantes registradas para este tenant."
          : "Selecciona un tenant para consultar sus vacantes."
          }
          renderActions={(row) => (
            <div className="table-actions">
              <button
                className="btn small"
                type="button"
                onClick={() => handleUseVacancy(row)}
              >
                Usar
              </button>

              <button
                className="btn small primary"
                type="button"
                onClick={() => handleOpenRanking(row)}
              >
                Ranking
              </button>

              <button
                className="btn small"
                type="button"
                onClick={() => handleOpenQuestions(row)}
              >
                Preguntas
              </button>
            </div>
          )}
        />
      </section>
    </>
  );
}
