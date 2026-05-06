function formatCellValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return value;
}

export default function Table({
  columns,
  rows,
  loading = false,
  emptyText = "No hay datos.",
  keyField = "id",
  renderActions,
  actionColumnLabel = "Acciones",
}) {
  const items = Array.isArray(rows) ? rows : [];
  const hasActions = typeof renderActions === "function";

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            {hasActions ? <th>{actionColumnLabel}</th> : null}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td
                className="loading-cell"
                colSpan={columns.length + (hasActions ? 1 : 0)}
              >
                Cargando...
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td
                className="empty-cell"
                colSpan={columns.length + (hasActions ? 1 : 0)}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            items.map((row, rowIndex) => (
              <tr
                key={
                  row?.[keyField] ??
                  `${rowIndex}-${row?.title ?? row?.name ?? "fila"}`
                }
              >
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.cell
                      ? column.cell(row, rowIndex)
                      : formatCellValue(row?.[column.key])}
                  </td>
                ))}

                {hasActions ? <td>{renderActions(row, rowIndex)}</td> : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
