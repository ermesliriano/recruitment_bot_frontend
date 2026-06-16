import Modal from "./Modal";

export default function VacancyActionsModal({
  vacancy,
  onClose,
  onRanking,
  onQuestions,
  onEdit,
  onDelete,
  onToggleStatus,
  isDeleting = false,
  isToggling = false,
}) {
  if (!vacancy) return null;

  const status = vacancy.status?.toLowerCase();
  const toggleLabel = status === "active" ? "Archivar" : "Activar";

  return (
    <Modal
      title={vacancy.title}
      onClose={onClose}
      actions={
        <button className="btn" type="button" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <p className="muted" style={{ marginTop: -4 }}>
        Código: <strong>{vacancy.code}</strong>
        {status ? (
          <>
            {" · Estado: "}
            <span className={`status-badge ${status}`}>{status}</span>
          </>
        ) : null}
      </p>

      <div className="modal-action-grid">
        <button className="btn primary" type="button" onClick={onRanking}>
          Ranking
        </button>

        <button className="btn" type="button" onClick={onQuestions}>
          Preguntas
        </button>

        <button className="btn" type="button" onClick={onEdit}>
          Editar
        </button>

        <button
          className={`btn${status === "active" ? "" : " primary"}`}
          type="button"
          disabled={isToggling}
          onClick={onToggleStatus}
        >
          {isToggling ? "…" : toggleLabel}
        </button>

        <button
          className="btn danger modal-action-wide"
          type="button"
          disabled={isDeleting}
          onClick={onDelete}
        >
          {isDeleting ? "…" : "Eliminar"}
        </button>
      </div>
    </Modal>
  );
}
