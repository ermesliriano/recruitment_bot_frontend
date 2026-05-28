const LABELS = {
  template_sent: "Template enviado",
  waiting_reply: "Esperando reply",
  scoring_completed: "Scoring completo",
  blocked_no_opt_in: "Bloqueado sin opt-in",
  phone_not_found: "Teléfono no encontrado",
  ambiguous_phone: "Teléfono ambiguo",
  failed: "Fallido",
};

export default function OutboundStatusBadge({ status }) {
  const normalized = String(status || "").trim().toLowerCase();
  const label = LABELS[normalized] || (status || "—");

  return (
    <span className={`outbound-badge ${normalized || "neutral"}`}>
      {label}
    </span>
  );
}
