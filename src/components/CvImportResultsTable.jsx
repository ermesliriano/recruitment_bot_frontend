import OutboundStatusBadge from "./OutboundStatusBadge";

export default function CvImportResultsTable({ rows, loading = false, onRetry }) {
  const items = Array.isArray(rows) ? rows : [];

  return (
    <section className="card">
      <div className="row-space">
        <div>
          <h2 className="h2">CVs importados de la vacante</h2>
          <p className="muted">
            Histórico acumulado de todos los CVs procesados para esta vacante.
            Las nuevas rondas se añaden sin borrar las anteriores.
          </p>
        </div>

        <div className="row">
          <span className="muted">
            {items.length} {items.length === 1 ? "CV" : "CVs"}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="help-text">Cargando importaciones de la vacante...</p>
      ) : items.length === 0 ? (
        <p className="help-text">
          Aún no hay CVs importados para esta vacante. Procesa uno o varios CVs
          para verlos aquí.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fichero</th>
                <th>Teléfono</th>
                <th>Candidato</th>
                <th>Application</th>
                <th>Estado</th>
                <th>Outbound</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{row.original_filename}</td>
                  <td>{row.detected_phone_e164 || "—"}</td>
                  <td>{row.candidate_id || "—"}</td>
                  <td>{row.application_id || "—"}</td>
                  <td><OutboundStatusBadge status={row.status} /></td>
                  <td><OutboundStatusBadge status={row.outbound_status} /></td>
                  <td>
                    {row.status === "blocked_no_opt_in" || row.outbound_status === "failed" ? (
                      <button className="btn small" type="button" onClick={() => onRetry(row)}>
                        Reintentar outbound
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
