import { useMemo, useState } from "react";
import MariaAvatar from "./MariaAvatar";
import Modal from "./Modal";

/**
 * Vista previa: "Así verá el candidato estas preguntas".
 * Simula el flujo de María respetando orden, obligatoriedad, tipo de respuesta
 * y condiciones (equals / not_equals sobre preguntas Sí/No anteriores).
 */

function conditionMatches(condition, answers) {
  if (!condition || !condition.depends_on_field_key) return true;
  const answer = answers[condition.depends_on_field_key];
  switch (condition.operator) {
    case "equals":
      return answer === condition.value;
    case "not_equals":
      return answer !== undefined && answer !== condition.value;
    case "exists":
      return answer !== undefined && answer !== null && answer !== "";
    case "not_exists":
      return answer === undefined || answer === null || answer === "";
    default:
      return true;
  }
}

export default function QuestionPreview({ questions, onClose }) {
  const ordered = useMemo(
    () =>
      [...(questions || [])].sort(
        (a, b) => Number(a.question_order) - Number(b.question_order)
      ),
    [questions]
  );

  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [warning, setWarning] = useState("");
  const [finished, setFinished] = useState(false);

  // Preguntas visibles según las respuestas dadas hasta ahora.
  const visible = useMemo(
    () => ordered.filter((q) => conditionMatches(q.display_condition, answers)),
    [ordered, answers]
  );

  const current = visible[index];
  const total = visible.length;

  function setAnswer(fieldKey, value) {
    setWarning("");
    setAnswers((prev) => ({ ...prev, [fieldKey]: value }));
  }

  function handleNext() {
    if (!current) return;
    const value = answers[current.field_key];
    const empty = value === undefined || value === null || value === "";
    if (current.required && empty) {
      setWarning("Esta pregunta es obligatoria: responde para continuar.");
      return;
    }
    if (index + 1 >= total) {
      setFinished(true);
    } else {
      setIndex(index + 1);
      setWarning("");
    }
  }

  function handlePrev() {
    setWarning("");
    if (finished) {
      setFinished(false);
      return;
    }
    setIndex(Math.max(0, index - 1));
  }

  function renderInput(question) {
    const value = answers[question.field_key];
    if (question.answer_type === "boolean") {
      return (
        <div className="row">
          <button
            className={`btn${value === true ? " primary" : ""}`}
            type="button"
            onClick={() => setAnswer(question.field_key, true)}
          >
            Sí
          </button>
          <button
            className={`btn${value === false ? " primary" : ""}`}
            type="button"
            onClick={() => setAnswer(question.field_key, false)}
          >
            No
          </button>
        </div>
      );
    }
    if (question.answer_type === "number") {
      return (
        <input
          className="input"
          type="number"
          value={value ?? ""}
          placeholder="Escribe un número..."
          onChange={(e) =>
            setAnswer(
              question.field_key,
              e.target.value === "" ? "" : Number(e.target.value)
            )
          }
        />
      );
    }
    return (
      <input
        className="input"
        type="text"
        value={value ?? ""}
        placeholder="Escribe tu respuesta..."
        onChange={(e) => setAnswer(question.field_key, e.target.value)}
      />
    );
  }

  return (
    <Modal
      title="Así verá el candidato estas preguntas"
      onClose={onClose}
      actions={
        <>
          <button
            className="btn"
            type="button"
            onClick={handlePrev}
            disabled={index === 0 && !finished}
          >
            Anterior
          </button>
          {!finished ? (
            <button
              className="btn primary"
              type="button"
              onClick={handleNext}
              disabled={!current}
            >
              Continuar
            </button>
          ) : (
            <button className="btn primary" type="button" onClick={onClose}>
              Cerrar
            </button>
          )}
        </>
      }
    >
      <div className="maria-preview-bubble" style={{ marginBottom: 14 }}>
        <MariaAvatar size={30} />
        <div className="chat-bubble in">
          <div className="chat-bubble-text">
            Antes de continuar, necesito hacerte algunas preguntas generales.
          </div>
        </div>
      </div>

      {total === 0 ? (
        <p className="muted">
          No hay preguntas visibles con las condiciones actuales.
        </p>
      ) : finished ? (
        <div className="maria-preview-bubble">
          <MariaAvatar size={30} />
          <div className="chat-bubble in">
            <div className="chat-bubble-text">
              ¡Gracias! Con esto termina la simulación de las preguntas comunes.
            </div>
          </div>
        </div>
      ) : current ? (
        <>
          <p className="muted" style={{ marginBottom: 6 }}>
            Pregunta {index + 1} de {total}
            {current.required ? " · obligatoria" : ""}
          </p>
          <div className="maria-preview-q" style={{ marginTop: 0 }}>
            {current.prompt_text}
          </div>
          <div className="field">{renderInput(current)}</div>
          {warning ? (
            <div className="warning-box" role="alert">{warning}</div>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
