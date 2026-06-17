// Etiquetas legibles para valores que el backend devuelve como enums internos.

// Origen de la candidatura:
// - cualquier flujo inbound (el candidato escribió primero) → "Promociones"
// - recruiter_upload (la empresa subió el CV y lanzó el outbound) → "Oficial"
export function formatOrigin(origin) {
  const value = String(origin || "").trim().toLowerCase();

  if (!value) return "—";
  if (value === "recruiter_upload") return "Oficial";
  if (value.startsWith("inbound")) return "Promociones";

  return origin;
}
