// src/components/GenerateQuestionsProposalModal.jsx
import Modal from "./Modal";

/**
 * Modal que propone al usuario generar preguntas de screening automáticamente
 * usando IA a partir de los requisitos obligatorios de la vacante recién creada.
 *
 * Props:
 * - vacancyTitle  {string}    Título de la vacante.
 * - requirements  {string[]}  Lista de requisitos obligatorios.
 * - loading       {boolean}   true mientras se espera la respuesta del LLM.
 * - onAccept      {function}  Llamado cuando el usuario acepta la propuesta.
 * - onReject      {function}  Llamado cuando el usuario rechaza la propuesta.
 */
export default function GenerateQuestionsProposalModal({
  vacancyTitle,
  requirements,
  loading,
  onAccept,
  onReject,
}) {
  return (
    <Modal
      title="¿Generar preguntas automáticamente?"
      onClose={loading ? undefined : onReject}
      actions={
        <>
          <button
            className="btn primary"
            type="button"
            disabled={loading}
            onClick={onAccept}
          >
            {loading ? "Generando preguntas…" : "Sí, generar con IA"}
          </button>

          <button
            className="btn"
            type="button"
            disabled={loading}
            onClick={onReject}
          >
            No, configurar manualmente
          </button>
        </>
      }
    >
      <p>
        La vacante <strong>{vacancyTitle}</strong> tiene{" "}
        <strong>{requirements.length}</strong>{" "}
        {requirements.length === 1
          ? "requisito obligatorio"
          : "requisitos obligatorios"}.
      </p>

      <p style={{ marginTop: 8 }}>
        El sistema puede generar automáticamente preguntas de screening
        asociadas a cada requisito usando inteligencia artificial. Después
        podrás revisarlas, editarlas o eliminarlas.
      </p>

      <ul
        style={{
          margin: "12px 0",
          paddingLeft: 20,
          lineHeight: 1.75,
          color: "var(--color-text, inherit)",
        }}
      >
        {requirements.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>

      <p className="muted" style={{ marginTop: 4 }}>
        Esta acción solo se ejecutará si aceptas la propuesta. Si rechazas,
        podrás configurar las preguntas manualmente.
      </p>
    </Modal>
  );
}
