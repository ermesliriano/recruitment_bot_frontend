import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import VacancyBudgetModal from "../components/VacancyBudgetModal";
import VacancyActionsModal from "../components/VacancyActionsModal";
import StatCard from "../components/StatCard";
import Table from "../components/Table";
import VacancySelector from "../components/VacancySelector";
import { useAppContext } from "../context/AppContext";
import { getRanking, listVacancyQuestions, setVacancyStatus, deleteVacancy } from "../lib/api";
import { getVacancyBudget } from "../lib/scoringBudget";

function formatVacancyDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const {
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
  const [deletingVacancyId, setDeletingVacancyId] = useState(null);
  // Modal de acciones que se abre al pulsar el título de una vacante.
  const [actionsModalVacancy, setActionsModalVacancy] = useState(null);

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

  // Todas las vacantes cargadas pertenecen al tenant seleccionado, así que
  // tomamos el nombre del tenant de la primera que lo traiga (lo expone el backend
  // en VacancyOut.tenant_name); si aún no ha cargado, caemos al id como respaldo.
  const tenantName = useMemo(
    () => vacancies.find((item) => item.tenant_name)?.tenant_name || "",
    [vacancies]
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

  async function handleDeleteVacancy(row) {
    const confirmed = window.confirm(
      `¿Seguro que quieres eliminar la vacante "${row.title}"?\n\nEsta acción eliminará también todas sus preguntas asociadas y no podrá deshacerse.`
    );
    if (!confirmed) return;

    try {
      setDeletingVacancyId(row.id);
      await deleteVacancy(row.id);
      setVacancies((current) => current.filter((v) => v.id !== row.id));
      if (vacancyId === row.id) {
        setSelection({ vacancyId: "" });
      }
      pushFlash("message", `Vacante "${row.title}" eliminada correctamente.`);
    } catch (error) {
      pushFlash("error", error.message || "No se pudo eliminar la vacante.");
    } finally {
      setDeletingVacancyId(null);
    }
  }

  async function handleToggleStatus(row) {
    // ACTIVE → ARCHIVED directo (sin validación de presupuesto)
    if (row.status?.toLowerCase() === "active") {
      try {
        setActivating(row.id);
        await setVacancyStatus(row.id, "archived");
        setVacancies((cur) =>
          cur.map((v) => v.id === row.id ? { ...v, status: "archived" } : v)
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
      const budget = getVacancyBudget({
        vacancy: row,
        questions,
      });

      if (!budget.isValid) {
        setBudgetModal({
          vacancy: row,
          total: budget.total,
          questionsTotal: budget.questionsTotal,
        });
        return;
      }

      await setVacancyStatus(row.id, "active");
      setVacancies((cur) =>
        cur.map((v) => v.id === row.id ? { ...v, status: "active" } : v)
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
      cell: (row) => (
        <span className={`status-badge ${row.status?.toLowerCase()}`}>
          {row.status?.toLowerCase()}
        </span>
      ),
    },
    {
      key: "title",
      label: "Vacante",
      cell: (row) => (
        <button
          type="button"
          className="vacancy-title-btn"
          title="Ver acciones de la vacante"
          onClick={() => setActionsModalVacancy(row)}
        >
          {row.title}
        </button>
      ),
    },
    { key: "questions_total_points", label: "Total pts. preguntas" },
    { key: "cv_max_score", label: "CV pts." },
    { key: "applications_count", label: "Candidaturas evaluadas" },
    {
      key: "created_at",
      label: "Fecha de creación",
      cell: (row) => formatVacancyDate(row.created_at),
    },
  ];

  return (
    <>
      {budgetModal ? (
        <VacancyBudgetModal
          vacancy={budgetModal.vacancy}
          total={budgetModal.total}
          questionsTotal={budgetModal.questionsTotal}
          onClose={() => setBudgetModal(null)}
          onGoToQuestions={() => {
            navigate(`/vacancies/${budgetModal.vacancy.id}/questions`);
            setBudgetModal(null);
          }}
        />
      ) : null}

      {actionsModalVacancy ? (
        <VacancyActionsModal
          vacancy={actionsModalVacancy}
          isDeleting={deletingVacancyId === actionsModalVacancy.id}
          isToggling={activating === actionsModalVacancy.id}
          onClose={() => setActionsModalVacancy(null)}
          onRanking={() => {
            const row = actionsModalVacancy;
            setActionsModalVacancy(null);
            handleOpenRanking(row);
          }}
          onQuestions={() => {
            const row = actionsModalVacancy;
            setActionsModalVacancy(null);
            handleOpenQuestions(row);
          }}
          onEdit={() => {
            const row = actionsModalVacancy;
            setActionsModalVacancy(null);
            handleEdit(row);
          }}
          onDelete={() => {
            const row = actionsModalVacancy;
            setActionsModalVacancy(null);
            handleDeleteVacancy(row);
          }}
          onToggleStatus={() => {
            const row = actionsModalVacancy;
            setActionsModalVacancy(null);
            handleToggleStatus(row);
          }}
        />
      ) : null}
		
      <section className="card">
        <h1 className="h1">Dashboard</h1>
        <p className="muted">
          Resumen general del estado del sistema: vacantes activas, candidaturas evaluadas y acceso rápido a las operaciones principales.
        </p>
      </section>

      <VacancySelector
        title="Vacante de trabajo"
        description="Selecciona la vacante con la que quieres trabajar en ranking, detalle y formularios."
        onLoaded={setVacancies}
      />

      <section className="grid grid-stats">
        <StatCard
          title="Vacantes de la Empresa"
          value={vacancies.length}
          description={
            tenantId
              ? `Usuario activo de la empresa ${tenantName || tenantId}`
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
              ? `Código: ${selectedVacancy.code}`
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
          title="Carga manual de CVs"
          value="Importar CVs"
          description="Sube uno o varios CVs y dispara el flujo outbound por WhatsApp."
          actionLabel="Ir a carga"
          onAction={() => navigate("/cv-imports")}
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
            <h2 className="h2">Vacantes de la empresa</h2>
            <p className="muted">
              Listado de vacantes de la empresa con acceso directo al ranking, preguntas y configuración.
            </p>
          </div>
          <div className="row">
            <button
              className="btn primary"
              type="button"
              onClick={() => navigate("/vacancies/new")}
            >
              Crear vacante
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => navigate("/tenant-questions")}
            >
              Preguntas genéricas
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => navigate("/conversation-flow")}
            >
              Flujo de conversación
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => navigate("/company-info")}
            >
              Datos de la empresa
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => navigate("/conversations")}
            >
              Conversaciones
            </button>
          </div>
        </div>

        <Table
          columns={columns}
          rows={vacancies}
          emptyText={
            tenantId
              ? "No hay vacantes registradas para este tenant."
              : "Selecciona un tenant para consultar sus vacantes."
          }
        />
      </section>
    </>
  );
}
