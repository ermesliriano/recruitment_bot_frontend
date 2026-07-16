import { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { listVacancies } from "../lib/api";

/**
 * Selector de vacante compartido (combobox con búsqueda).
 *
 * Mantiene el contrato externo previo (props y selección vía contexto), pero
 * sustituye el <select> por un combobox accesible: búsqueda por nombre, código
 * o estado, navegación por teclado (↑ ↓ Enter Escape), opción de limpiar y
 * opciones enriquecidas (código · estado · nº de candidaturas).
 */

const STATUS_LABELS = {
  active: "Activa",
  draft: "Borrador",
  archived: "Archivada",
  closed: "Cerrada",
};

function normalize(text) {
  return (text || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function statusLabel(status) {
  return STATUS_LABELS[(status || "").toLowerCase()] || status || "—";
}

export default function VacancySelector({
  title = "Contexto actual",
  description = "La vacante seleccionada se reutiliza entre ranking, detalle y formularios.",
  showVacancyField = true,
  autoLoad = true,
  showLoadButton = true,
  onLoaded,
}) {
  const { tenantId, vacancyId, setSelection } = useAppContext();

  const [vacancies, setVacancies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef(null);
  const listRef = useRef(null);

  async function executeLoad(currentTenantId) {
    if (!currentTenantId) {
      setError("Selecciona una empresa antes de cargar vacantes.");
      setVacancies([]);
      onLoaded?.([]);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const items = await listVacancies(currentTenantId);
      setVacancies(items);
      onLoaded?.(items);

      if (showVacancyField && items.length === 1 && !vacancyId) {
        setSelection({ vacancyId: items[0].id });
      }
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar las vacantes.");
      setVacancies([]);
      onLoaded?.([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoLoad || !showVacancyField || !tenantId) return;
    executeLoad(tenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, autoLoad, showVacancyField]);

  const selected = useMemo(
    () => vacancies.find((item) => item.id === vacancyId) || null,
    [vacancies, vacancyId]
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return vacancies;
    return vacancies.filter((item) => {
      const haystack = normalize(
        `${item.title || ""} ${item.code || ""} ${statusLabel(item.status)} ${item.status || ""}`
      );
      return haystack.includes(q);
    });
  }, [vacancies, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function pick(item) {
    setSelection({ vacancyId: item.id });
    setQuery("");
    setOpen(false);
  }

  function clearSelection() {
    setSelection({ vacancyId: "" });
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) pick(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Mantiene la opción resaltada visible al navegar con teclado.
  useEffect(() => {
    const node = listRef.current?.children?.[highlight];
    node?.scrollIntoView?.({ block: "nearest" });
  }, [highlight]);

  const displayValue = open ? query : selected?.title || "";

  return (
    <section className="card compact-card">
      <div className="card-header">
        <div>
          <h2 className="h2">{title}</h2>
          <p className="muted">{description}</p>
        </div>

        {showLoadButton && showVacancyField ? (
          <button
            className="btn"
            type="button"
            onClick={() => executeLoad(tenantId)}
            disabled={loading}
            aria-label="Actualizar vacantes"
          >
            {loading ? "Cargando..." : "⟳ Actualizar vacantes"}
          </button>
        ) : null}
      </div>

      {showVacancyField ? (
        <div className="combobox">
          <label className="label" htmlFor="vacancy-combobox">
            Vacante
          </label>
          <div className="combobox-input-wrap">
            <input
              id="vacancy-combobox"
              className="input"
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls="vacancy-combobox-list"
              aria-autocomplete="list"
              placeholder="Buscar vacante por nombre o código..."
              value={displayValue}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                clearTimeout(blurTimer.current);
                setOpen(true);
                setQuery("");
              }}
              onBlur={() => {
                blurTimer.current = setTimeout(() => setOpen(false), 130);
              }}
              onKeyDown={handleKeyDown}
              disabled={!tenantId || loading}
            />
            {selected || query ? (
              <button
                className="combobox-clear"
                type="button"
                aria-label="Limpiar selección"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearSelection}
              >
                ×
              </button>
            ) : null}
          </div>

          {open ? (
            <div
              className="combobox-list"
              id="vacancy-combobox-list"
              role="listbox"
              ref={listRef}
            >
              {filtered.length === 0 ? (
                <div className="combobox-empty">
                  No hay vacantes que coincidan con “{query}”.
                </div>
              ) : (
                filtered.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={item.id === vacancyId}
                    className={`combobox-option${index === highlight ? " highlight" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(item)}
                    onMouseEnter={() => setHighlight(index)}
                  >
                    <div className="combobox-option-title">
                      {item.title || item.code || item.id}
                    </div>
                    <div className="combobox-meta">
                      Código: {item.code || "—"} · {statusLabel(item.status)} ·{" "}
                      {item.applications_count ?? 0} candidaturas
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <p className="help-text">
          Vacante actual: <strong>{selected.title}</strong>
        </p>
      ) : null}

      {error ? <div className="field-error">{error}</div> : null}
    </section>
  );
}
