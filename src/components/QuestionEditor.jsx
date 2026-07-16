import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";

/**
 * Editor de pregunta común (crear / editar) en modal.
 *
 * Capacidades reales del backend respetadas:
 *  - Tipos de respuesta: texto, sí/no, número (el resto se muestra deshabilitado).
 *  - Condición: mostrar solo si una pregunta Sí/No ANTERIOR es igual / no es
 *    igual a un valor (display_condition: equals | not_equals).
 *  - En edición no se puede cambiar el tipo ni el código interno (limitación
 *    del endpoint PATCH); sí el enunciado, orden, flags y condición.
 */

export const ANSWER_TYPES = [
  { value: "text", label: "Texto" },
  { value: "boolean", label: "Sí / No" },
  { value: "number", label: "Número" },
];

const FUTURE_TYPES = [
  "Texto largo",
  "Moneda",
  "Selección única",
  "Selección múltiple",
  "Fecha",
  "Teléfono",
  "Correo electrónico",
  "Archivo",
];

const SENSITIVE_PATTERNS = [
  "salud",
  "enferm",
  "discapacidad",
  "embaraz",
  "religio",
  "orientacion sexual",
  "orientación sexual",
  "politic",
  "polític",
  "etnic",
  "étnic",
  "medic",
  "médic",
  "vih",
  "sida",
  "estado civil",
  "hijos",
];

export function isSensitiveText(text) {
  const normalized = (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return SENSITIVE_PATTERNS.some((p) =>
    normalized.includes(
      p.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    )
  );
}

export function slugifyCode(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:()"']/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 60);
}

export default function QuestionEditor({
  mode, // "create" | "edit"
  initial, // valores iniciales del formulario
  questions, // listado completo (para condición y validación de orden)
  saving,
  onSave,
  onClose,
}) {
  const [text, setText] = useState(initial?.text || "");
  const [code, setCode] = useState(initial?.code || "");
  const [codeTouched, setCodeTouched] = useState(Boolean(initial?.code));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [type, setType] = useState(initial?.type || "text");
  const [required, setRequired] = useState(initial?.required ?? true);
  const [evaluates, setEvaluates] = useState(initial?.evaluates ?? true);
  const [order, setOrder] = useState(String(initial?.order || 1));
  const [conditionEnabled, setConditionEnabled] = useState(
    Boolean(initial?.conditionFieldKey)
  );
  const [conditionFieldKey, setConditionFieldKey] = useState(
    initial?.conditionFieldKey || ""
  );
  const [conditionOperator, setConditionOperator] = useState(
    initial?.conditionOperator || "equals"
  );
  const [conditionValue, setConditionValue] = useState(
    initial?.conditionValue ?? "true"
  );
  const [sensitiveConfirmed, setSensitiveConfirmed] = useState(false);
  const [formError, setFormError] = useState("");

  // Código interno autogenerado a partir del enunciado (editable en avanzado).
  useEffect(() => {
    if (mode === "create" && !codeTouched) {
      setCode(slugifyCode(text));
    }
  }, [text, mode, codeTouched]);

  const sensitive = useMemo(() => isSensitiveText(text), [text]);

  useEffect(() => {
    if (!sensitive) setSensitiveConfirmed(false);
  }, [sensitive]);

  // Preguntas Sí/No que aparecen ANTES del orden actual (origen válido de condición).
  const booleanSources = useMemo(() => {
    const currentOrder = Number(order) || 9999;
    return (questions || []).filter(
      (q) =>
        q.answer_type === "boolean" &&
        Number(q.question_order) < currentOrder &&
        q.tq_id !== initial?.tqId
    );
  }, [questions, order, initial]);

  function handleSubmit() {
    setFormError("");
    const trimmed = text.trim();
    if (!trimmed) {
      setFormError("El enunciado es obligatorio.");
      return;
    }
    if (mode === "create" && !code.trim()) {
      setFormError("El código interno no puede quedar vacío.");
      return;
    }
    const orderNumber = Number(order);
    if (!Number.isInteger(orderNumber) || orderNumber < 1) {
      setFormError("El orden debe ser un número entero mayor que 0.");
      return;
    }
    if (conditionEnabled) {
      if (!conditionFieldKey) {
        setFormError("Selecciona la pregunta anterior de la que depende.");
        return;
      }
      const source = booleanSources.find((q) => q.field_key === conditionFieldKey);
      if (!source) {
        setFormError(
          "La pregunta de origen debe ser de tipo Sí/No y aparecer antes en el orden."
        );
        return;
      }
    }
    if (sensitive && !sensitiveConfirmed) {
      setFormError(
        "Confirma que la pregunta sensible es necesaria para poder guardarla."
      );
      return;
    }

    const display_condition = conditionEnabled
      ? {
          depends_on_field_key: conditionFieldKey,
          operator: conditionOperator,
          value: conditionValue === "true",
        }
      : {};

    onSave({
      text: trimmed,
      code: code.trim(),
      type,
      required,
      evaluates,
      order: orderNumber,
      display_condition,
      sensitiveConfirmed: sensitive ? true : undefined,
    });
  }

  return (
    <Modal
      title={mode === "create" ? "Crear pregunta común" : "Editar pregunta común"}
      onClose={onClose}
      actions={
        <>
          <button className="btn" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Guardando..." : mode === "create" ? "Crear pregunta" : "Guardar cambios"}
          </button>
        </>
      }
    >
      {formError ? <div className="error-box" role="alert">{formError}</div> : null}

      <div className="field">
        <label className="field-label" htmlFor="qe-text">Enunciado</label>
        <textarea
          id="qe-text"
          className="input"
          rows={2}
          value={text}
          placeholder="Ej. ¿Cuál es tu disponibilidad para iniciar?"
          onChange={(e) => setText(e.target.value)}
        />
        <div className="field-help">Texto que verá el candidato.</div>
      </div>

      {sensitive ? (
        <div className="warning-box" style={{ marginBottom: 14 }}>
          Esta pregunta puede recopilar información sensible (salud, creencias,
          situación personal...). Confirma que sea necesaria, legal y adecuada
          para el proceso. No se utilizará automáticamente para descartar
          candidatos.
          <label className="field-label" style={{ marginTop: 8, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={sensitiveConfirmed}
              onChange={(e) => setSensitiveConfirmed(e.target.checked)}
            />{" "}
            Confirmo que esta pregunta es necesaria para el proceso de selección.
          </label>
        </div>
      ) : null}

      <div className="detail-grid">
        <div className="field">
          <label className="field-label" htmlFor="qe-type">Tipo de respuesta</label>
          <select
            id="qe-type"
            className="input"
            value={type}
            disabled={mode === "edit"}
            onChange={(e) => setType(e.target.value)}
          >
            {ANSWER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
            <optgroup label="Próximamente">
              {FUTURE_TYPES.map((t) => (
                <option key={t} disabled>{t}</option>
              ))}
            </optgroup>
          </select>
          {mode === "edit" ? (
            <div className="field-help">El tipo no puede cambiarse en una pregunta existente.</div>
          ) : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="qe-order">Orden</label>
          <input
            id="qe-order"
            className="input"
            type="number"
            min={1}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
          <div className="field-help">Se asigna automáticamente; puedes cambiarlo.</div>
        </div>
      </div>

      <div className="field">
        <label className="field-label">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />{" "}
          Obligatoria — el candidato debe responder esta pregunta para continuar.
        </label>
      </div>

      <div className="field">
        <label
          className="field-label"
          title="María analiza estas respuestas junto con el CV y los criterios de la vacante."
        >
          <input
            type="checkbox"
            checked={evaluates}
            onChange={(e) => setEvaluates(e.target.checked)}
          />{" "}
          Influye en evaluación — utilizar esta respuesta como parte de la
          evaluación del candidato.
        </label>
        {evaluates ? (
          <div className="field-help">
            Las preguntas marcadas para evaluación pueden influir en la
            recomendación y puntuación del candidato. Los pesos y reglas
            detalladas por pregunta se configuran en las preguntas de cada
            vacante.
          </div>
        ) : null}
      </div>

      <div className="field">
        <label className="field-label">
          <input
            type="checkbox"
            checked={conditionEnabled}
            onChange={(e) => setConditionEnabled(e.target.checked)}
            disabled={booleanSources.length === 0 && !conditionEnabled}
          />{" "}
          Mostrar esta pregunta solo si se cumple una condición
        </label>
        {booleanSources.length === 0 && !conditionEnabled ? (
          <div className="field-help">
            Necesitas al menos una pregunta de tipo Sí/No con orden anterior para
            crear una condición.
          </div>
        ) : null}

        {conditionEnabled ? (
          <div className="detail-grid" style={{ marginTop: 8 }}>
            <div className="field">
              <label className="field-label" htmlFor="qe-cond-source">Pregunta anterior</label>
              <select
                id="qe-cond-source"
                className="input"
                value={conditionFieldKey}
                onChange={(e) => setConditionFieldKey(e.target.value)}
              >
                <option value="">Selecciona una pregunta...</option>
                {booleanSources.map((q) => (
                  <option key={q.field_key} value={q.field_key}>
                    #{q.question_order} · {q.prompt_text}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="qe-cond-op">Condición</label>
              <select
                id="qe-cond-op"
                className="input"
                value={conditionOperator}
                onChange={(e) => setConditionOperator(e.target.value)}
              >
                <option value="equals">Es igual a</option>
                <option value="not_equals">No es igual a</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="qe-cond-value">Respuesta esperada</label>
              <select
                id="qe-cond-value"
                className="input"
                value={conditionValue}
                onChange={(e) => setConditionValue(e.target.value)}
              >
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        ) : null}

        {conditionEnabled && conditionFieldKey ? (
          <div className="field-help">
            Ejemplo: mostrar “{text.trim() || "esta pregunta"}” solo si “
            {booleanSources.find((q) => q.field_key === conditionFieldKey)?.prompt_text}
            ” {conditionOperator === "equals" ? "es" : "no es"}{" "}
            “{conditionValue === "true" ? "Sí" : "No"}”.
          </div>
        ) : null}
      </div>

      <div className="field">
        <button
          className="linklike"
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? "Ocultar opciones avanzadas" : "Opciones avanzadas"}
        </button>
        {showAdvanced ? (
          <div style={{ marginTop: 8 }}>
            <label className="field-label" htmlFor="qe-code">Código interno</label>
            <input
              id="qe-code"
              className="input"
              type="text"
              value={code}
              disabled={mode === "edit"}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(slugifyCode(e.target.value) || e.target.value);
              }}
            />
            <div className="field-help">
              Identificador técnico generado automáticamente a partir del
              enunciado (ej. disponibilidad_inicio).
              {mode === "edit" ? " No puede cambiarse en una pregunta existente." : ""}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
