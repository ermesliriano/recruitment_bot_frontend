const TYPE_TO_CLASS_NAME = {
  message: "flash-message",
  error: "flash-error",
  warning: "flash-warning",
};

export default function FlashMessage({ items = [], onDismiss }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="flash-area" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flash ${TYPE_TO_CLASS_NAME[item.type] || "flash-message"}`}
        >
          <div className="flash-text">{item.text}</div>

          <button
            className="flash-close"
            type="button"
            aria-label="Cerrar mensaje"
            onClick={() => onDismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
