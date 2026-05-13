import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import StatCard from "../components/StatCard";
import Table from "../components/Table";
import VacancySelector from "../components/VacancySelector";
import { useAppContext } from "../context/AppContext";
import { getRanking, listVacancyQuestions, setVacancyStatus } from "../lib/api";

export default function DashboardPage() {
  const {
    authState,
    currentUserLabel,
    tenantId,
    vacancyId,
    setSelection,
    pushFlash,
  } = useAppContext();

  const navigate = useNavigate();

  const [vacancies, setVacancies] = useState([]);
  const [rankingTotal, setRankingTotal] = useState(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState("");

  // Modal de presupuesto (activar vacante DRAFT con suma != 100)
  const [budgetModal, setBudgetModal] = useState(null); // { vacancy, total }
  const [activating, setActivating] = useState(null); // id en proceso

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
          setRankingError(error.message || "No se pudo cargar el ranking actual.");
        }
      } finally {
        if (!ignore) setRankingLoading(false);
      }
    }

    loadRankingSummary();
    return () => { ignore = true; };
  }, [tenantId, vacancyId]);

  const selectedVacancy = useMemo(
    () => vacancies.find((item) => item.id === vacancyId) || null,
    [vacancies, vacancyId]
  );

  function handleUseVacancy(row) {
    setSelection({ vacancyId: row.id });
  }

  function handleOpenRanking(row) {
    setSelection({ vacancyId: row.id });
    navigate(`/ranking?vacancyId=${row.id}`);
  }

  function handleOpenQuestions(row) {
    setSelection({ vacancyId: row.id });
    navigate(`/vacancies/${row.id}/questions`);
  }

  function handleEdit(row) {
    navigate(`/vacancies/${row.id}/edit`);
  }

  async function handleToggleStatus(row) {
    // ACTIVE → ARCHIVED directo (sin validación de presupuesto)
    if (row.status?.toLowerCase() === "active") {
      try {
        setActivating(row.id);
        await setVacancyStatus(row.id, "ARCHIVED");
        setVacancies((cur) =>
          cur.map((v) => v.id === row.id ? { ...v, status: "ARCHIVED" } : v)
        );
        pushFlash("message", `Vacante "${row.title}" archivada.`);
      } catch (err) {
        pushFlash("error", err.message || "No se pudo cambiar el estado.");
      } finally {
        setActivating(null);
      }
      return;
    }

    // DRAFT / ARCHIVED → ACTIVE: verificar presupuesto
    try {
      setActivating(row.id);
      const questions = await listVacancyQuestions(row.id);
      const questionsTotal = questions.reduce((s, q) => s + (q.max_points || 0), 0);
      const total = (row.cv_max_score || 0) + questionsTotal;

      if (total !== 100) {
        setBudgetModal({ vacancy: row, total, questionsTotal });
        return;
      }

      await setVacancyStatus(row.id, "ACTIVE");
      setVacancies((cur) =>
        cur.map((v) => v.id === row.id ? { ...v, status: "ACTIVE" } : v)
      );
      pushFlash("message", `Vacante "${row.title}" activada correctamente.`);
    } catch (err) {
      pushFlash("error", err.message || "No se pudo cambiar el estado.");
    } finally {
      setActivating(null);
    }
  }

  const columns = [
    { key: "code", label: "Código" },
    {
      key: "status",
      label: "Estado",
      render: (row) => (
        <span className={`status-badge ${row.status?.toLowerCase()}`}>
          {row.status?.toLowerCase()}
        </span>
      ),
    },
    { key: "title", label: "Título" },
    { key: "cv_max_score", label: "CV máx." },
  ];

  return (
    <>
      {budgetModal ? (
        <Modal
          title="No se puede activar la vacante"
          onClose={() => setBudgetModal(null)}
          actions={
            <>
              <button className="btn primary" onClick={() => {
                navigate(`/vacancies/${budgetModal.vacancy.id}/questions`);
                setBudgetModal(null);
              }}>
                Ir a preguntas
              </button>
              <button className="btn" onClick={() => setBudgetModal(null)}>
                Cerrar
              </button>
            </>
          }
        >
          <p>
            La suma de puntuaciones máximas debe ser exactamente{" "}
            <strong>100 puntos</strong>, pero la configuración actual suma{" "}
            <strong>{budgetModal.total} puntos</strong>:
          </p>
          <ul style={{ margin: "8px 0", paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Puntuación máxima del CV: <strong>{budgetModal.vacancy.cv_max_score}</strong></li>
            <li>Suma de preguntas: <strong>{budgetModal.questionsTotal}</strong></li>
          </ul>
          <p className="muted" style={{ marginTop: 4 }}>
            Ajusta los valores en la edición de la vacante o en sus preguntas hasta alcanzar los 100 puntos.
          </p>
        </Modal>
      ) : null}

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
              ? `Tenant activo: ${tenantId}`
              : "Selecciona un tenant para visualizar sus vacantes."
          }
          actionLabel="Crear vacante"
          actionTo="/vacancies/new"
          actionVariant="primary"
        />

        <StatCard
          title="Vacante activa"
          value={selectedVacancy?.title || (vacancyId ? vacancyId : "Sin seleccionar")}
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
          renderActions={(row) => {
            const status = row.status?.toLowerCase();
            const isActivating = activating === row.id;
            return (
              <div className="table-actions">
                <button className="btn small" type="button" onClick={() => handleUseVacancy(row)}>
                  Usar
                </button>
                <button className="btn small primary" type="button" onClick={() => handleOpenRanking(row)}>
                  Ranking
                </button>
                <button className="btn small" type="button" onClick={() => handleOpenQuestions(row)}>
                  Preguntas
                </button>
                <button className="btn small" type="button" onClick={() => handleEdit(row)}>
                  Editar
                </button>
                {status !== "archived" ? (
                  <button
                    className={`btn small${status === "active" ? "" : " primary"}`}
                    type="button"
                    disabled={isActivating}
                    onClick={() => handleToggleStatus(row)}
                  >
                    {isActivating
                      ? "…"
                      : status === "active"
                      ? "Archivar"
                      : "Activar"}
                  </button>
                ) : null}
              </div>
            );
          }}
        />
      </section>
    </>
  );
}
