/**
 * Tarjeta KPI del dashboard: etiqueta corta, valor grande y pista secundaria.
 */
export default function KpiCard({ label, value, hint }) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {hint ? <span className="kpi-hint">{hint}</span> : null}
    </div>
  );
}
