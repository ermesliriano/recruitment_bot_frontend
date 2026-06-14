import Modal from "./Modal";

export default function VacancyActivateModal({
  vacancy,
  cvMaxScore,
  questionsTotal,
  activating = false,
  onClose,
  onActivate,
}) {
  if (!vacancy) return null;

  return (
    <Modal
      title="La vacante ya puede activarse"
      onClose={onClose}
      actions={
        <>
          <button
            className="btn primary"
            type="button"
            onClick={onActivate}
            disabled={activating}
          >
            {activating ? "Activando…" : "Activar ahora"}
          </button>

          <button
            className="btn"
            type="button"
            onClick={onClose}
            disabled={activating}
          >
            Más tarde
          </button>
        </>
      }
    >
      <p>
        La suma de puntuaciones máximas ya es exactamente{" "}
        <strong>100 puntos</strong>, así que esta vacante (en estado borrador)
        cumple el requisito para activarse:
      </p>

      <ul style={{ margin: "8px 0", paddingLeft: 20, lineHeight: 1.8 }}>
        <li>
          Puntuación máxima del CV: <strong>{cvMaxScore}</strong>
        </li>
        <li>
          Suma de preguntas: <strong>{questionsTotal}</strong>
        </li>
      </ul>

      <p className="muted" style={{ marginTop: 4 }}>
        Puedes activarla ahora o hacerlo más tarde desde el dashboard.
      </p>
    </Modal>
  );
}
