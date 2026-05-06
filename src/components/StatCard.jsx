import { Link } from "react-router-dom";

export default function StatCard({
  title,
  value,
  description,
  actionLabel,
  actionTo,
  onAction,
  actionVariant = "default",
  disabled = false,
}) {
  const actionClassName =
    actionVariant === "primary" ? "btn primary" : "btn";

  let actionNode = null;

  if (actionLabel) {
    if (disabled) {
      actionNode = <span className="btn disabled">{actionLabel}</span>;
    } else if (actionTo) {
      actionNode = (
        <Link className={actionClassName} to={actionTo}>
          {actionLabel}
        </Link>
      );
    } else if (onAction) {
      actionNode = (
        <button className={actionClassName} type="button" onClick={onAction}>
          {actionLabel}
        </button>
      );
    } else {
      actionNode = <span className="btn disabled">{actionLabel}</span>;
    }
  }

  return (
    <article className="stat">
      <div className="stat-label">{title}</div>
      <div className="stat-value">{value}</div>

      {description ? <p className="muted stat-description">{description}</p> : null}

      {actionNode ? <div className="stat-actions">{actionNode}</div> : null}
    </article>
  );
}
