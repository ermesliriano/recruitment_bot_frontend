import { useRef } from "react";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

export default function CvUploadPanel({ files, onFilesChange, disabled = false }) {
  const inputRef = useRef(null);

  function normalizeFileList(fileList) {
    return Array.from(fileList || []).filter((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) return false;
      if (file.size > MAX_SIZE_BYTES) return false;
      return true;
    });
  }

  function handleChange(event) {
    onFilesChange(normalizeFileList(event.target.files));
  }

  function handleDrop(event) {
    event.preventDefault();
    if (disabled) return;
    onFilesChange(normalizeFileList(event.dataTransfer.files));
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  return (
    <section className="card">
      <div className="row-space">
        <div>
          <h2 className="h2">CVs a procesar</h2>
          <p className="muted">
            Admite PDF, JPG y PNG. Límite de 20 MB por fichero.
          </p>
        </div>

        <button
          className="btn"
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Seleccionar archivos
        </button>
      </div>

      <div
        className={`upload-dropzone ${disabled ? "disabled" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        Arrastra aquí uno o varios CVs, o pulsa "Seleccionar archivos".
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden-file-input"
        onChange={handleChange}
        disabled={disabled}
      />

      {files.length > 0 ? (
        <ul className="upload-file-list">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`}>
              <strong>{file.name}</strong> · {(file.size / 1024 / 1024).toFixed(2)} MB
            </li>
          ))}
        </ul>
      ) : (
        <p className="help-text">Todavía no has seleccionado archivos.</p>
      )}
    </section>
  );
}
