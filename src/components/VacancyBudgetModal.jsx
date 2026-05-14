import Modal from "./Modal";

export default function VacancyBudgetModal({
  vacancy,
  total,
  questionsTotal,
  onClose,
  onGoToQuestions,
}) {
  if (!vacancy) return null;

  return (
    <Modal
      title="No se puede activar la vacante"
      onClose={onClose}
      actions={
        <>
          {onGoToQuestions ? (
            <button className="btn primary" type="button" onClick={onGoToQuestions}>
              Ir a preguntas
            </button>
          ) : null}

          <button className="btn" type="button" onClick={onClose}>
            Cerrar
          </button>
        </>
      }
    >
      <p>
        La suma de puntuaciones máximas debe ser exactamente{" "}
        <strong>100 puntos</strong>, pero la configuración actual suma{" "}
        <strong>{total} puntos</strong>:
      </p>

      <ul style={{ margin: "8px 0", paddingLeft: 20, lineHeight: 1.8 }}>
        <li>
          Puntuación máxima del CV:{" "}
          <strong>{vacancy.cv_max_score}</strong>
        </li>
        <li>
          Suma de preguntas: <strong>{questionsTotal}</strong>
        </li>
      </ul>

      <p className="muted" style={{ marginTop: 4 }}>
        Ajusta los valores en la edición de la vacante o en sus preguntas hasta alcanzar los 100 puntos.
      </p>
    </Modal>
  );
}
