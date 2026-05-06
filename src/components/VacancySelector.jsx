import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { listVacancies } from "../lib/api";

export default function VacancySelector({
  title = "Contexto actual",
  description = "El tenant y la vacante se reutilizan entre ranking, detalle y formularios.",
  showVacancyField = true,
  autoLoad = true,
  showLoadButton = true,
  onLoaded,
}) {
  const { tenantId, vacancyId, setSelection } = useAppContext();

  const [vacancies, setVacancies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function executeLoad(currentTenantId) {
    if (!currentTenantId) {
      setError("Indica un tenant_id antes de cargar vacantes.");
      setVacancies([]);
      if (onLoaded) {
        onLoaded([]);
      }
      return;
    }

    try {
      setLoading(true);
      setError("");

      const items = await listVacancies(currentTenantId);
      setVacancies(items);

      if (onLoaded) {
        onLoaded(items);
      }

      if (showVacancyField && items.length === 1 && !vacancyId) {
        setSelection({ vacancyId: items[0].id });
      }
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar las vacantes.");
      setVacancies([]);

      if (onLoaded) {
        onLoaded([]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoLoad || !showVacancyField || !tenantId) {
      return;
    }

    executeLoad(tenantId);
  }, [tenantId, autoLoad, showVacancyField]);

  const currentVacancyInList = useMemo(
    () => vacancies.find((item) => item.id === vacancyId) || null,
    [vacancies, vacancyId]
  );

  function handleTenantChange(event) {
    const nextTenantId = event.target.value;

    setError("");
    setVacancies([]);

    if (onLoaded) {
      onLoaded([]);
    }

    if (showVacancyField) {
      setSelection({
        tenantId: nextTenantId,
        vacancyId: "",
      });
    } else {
      setSelection({
        tenantId: nextTenantId,
      });
    }
  }

  function handleVacancySelect(event) {
    setSelection({
      vacancyId: event.target.value,
    });
  }

  function handleManualVacancyChange(event) {
    setSelection({
      vacancyId: event.target.value,
    });
  }

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
          >
            {loading ? "Cargando..." : "Cargar vacantes"}
          </button>
        ) : null}
      </div>

      <div
        className={`selector-grid ${
          showVacancyField ? "" : "selector-grid--single"
        }`}
      >
        <label className="label">
          Tenant ID
          <input
            className="input"
            value={tenantId}
            onChange={handleTenantChange}
            placeholder="11111111-1111-1111-1111-111111111111"
          />
        </label>

        {showVacancyField ? (
          <>
            <label className="label">
              Vacante
              <select
                className="input"
                value={currentVacancyInList ? currentVacancyInList.id : vacancyId}
                onChange={handleVacancySelect}
              >
                <option value="">Selecciona una vacante</option>

                {vacancies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title || item.code || item.id}
                  </option>
                ))}

                {vacancyId && !currentVacancyInList ? (
                  <option value={vacancyId}>Vacante manual actual</option>
                ) : null}
              </select>
            </label>

            <label className="label">
              Vacante ID manual
              <input
                className="input"
                value={vacancyId}
                onChange={handleManualVacancyChange}
                placeholder="22222222-2222-2222-2222-222222222222"
              />
            </label>
          </>
        ) : null}
      </div>

      {currentVacancyInList ? (
        <p className="help-text">
          Vacante actual: <strong>{currentVacancyInList.title}</strong>
        </p>
      ) : null}

      {error ? <div className="field-error">{error}</div> : null}
    </section>
  );
}
