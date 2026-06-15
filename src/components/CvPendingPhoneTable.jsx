import { useState } from "react";
import OutboundStatusBadge from "./OutboundStatusBadge";

export default function CvPendingPhoneTable({ rows, onResolve, busyId = null }) {
  const items = Array.isArray(rows) ? rows : [];
  const [phones, setPhones] = useState({});

  if (items.length === 0) {
    return null;
  }

  function setPhone(id, value) {
    setPhones((current) => ({ ...current, [id]: value }));
  }

  return (
    <section className="card">
      <div className="row-space">
        <div>
          <h2 className="h2">Pendientes por teléfono</h2>
          <p className="muted">
            CVs en los que no se pudo determinar el teléfono automáticamente.
            Introduce el número manualmente y reintenta el procesado; al
            resolverse pasarán a la tabla de CVs importados.
          </p>
        </div>

        <div className="row">
          <span className="muted">
            {items.length} {items.length === 1 ? "pendiente" : "pendientes"}
          </span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Fichero</th>
              <th>Motivo</th>
              <th>Teléfono manual</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const value = phones[row.id] ?? "";
              const busy = busyId === row.id;
              const candidates = Array.isArray(row?.phone_candidates_json?.candidates)
                ? row.phone_candidates_json.candidates
                    .map((candidate) => candidate?.e164)
                    .filter(Boolean)
                : [];

              return (
                <tr key={row.id}>
                  <td>{row.original_filename}</td>
                  <td>
                    <OutboundStatusBadge status={row.status} />
                    {row.error_message ? (
                      <div className="help-text">{row.error_message}</div>
                    ) : null}
                  </td>
                  <td>
                    <input
                      className="input"
                      type="tel"
                      placeholder="+18495555555"
                      value={value}
                      disabled={busy}
                      onChange={(event) => setPhone(row.id, event.target.value)}
                    />
                    {candidates.length > 0 ? (
                      <div className="help-text">
                        Detectados en el CV: {candidates.join(", ")}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <button
                      className="btn small primary"
                      type="button"
                      disabled={busy || !value.trim()}
                      onClick={() => onResolve(row, value.trim())}
                    >
                      {busy ? "Procesando..." : "Reprocesar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
