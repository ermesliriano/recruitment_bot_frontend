import OutboundStatusBadge from "./OutboundStatusBadge";

export default function CvImportResultsTable({ job, onRetry }) {
  const rows = Array.isArray(job?.items) ? job.items : [];

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="card">
      <div className="row-space">
        <div>
          <h2 className="h2">Resultado de la importación</h2>
          <p className="muted">
            Job: <strong>{job.id}</strong>
          </p>
        </div>

        <div className="row">
          <OutboundStatusBadge status={job.status} />
        </div>
      </div>

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
            {rows.map((row) => (
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
    </section>
  );
}
