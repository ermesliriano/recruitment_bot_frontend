import { useState } from "react";
import CvImportResultsTable from "../components/CvImportResultsTable";
import CvUploadPanel from "../components/CvUploadPanel";
import VacancySelector from "../components/VacancySelector";
import { useAppContext } from "../context/AppContext";
import { createCvImportJob, retryOutboundMessage } from "../lib/api";

export default function CvImportsPage() {
  const { tenantId, vacancyId, pushFlash } = useAppContext();

  const [files, setFiles] = useState([]);
  const [job, setJob] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!tenantId || !vacancyId) {
      pushFlash("warning", "Selecciona antes tenant y vacante.");
      return;
    }

    if (files.length === 0) {
      pushFlash("warning", "Debes adjuntar al menos un CV.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await createCvImportJob(tenantId, vacancyId, files);
      setJob(response);
      pushFlash("message", "Importación procesada correctamente.");
    } catch (error) {
      pushFlash("error", error.message || "No se pudo procesar la importación.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetry(row) {
    if (!job?.id) return;

    try {
      const updatedItem = await retryOutboundMessage(tenantId, job.id, row.id);
      setJob((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
      }));
      pushFlash("message", "Outbound reintentado.");
    } catch (error) {
      pushFlash("error", error.message || "No se pudo reintentar el outbound.");
    }
  }

  return (
    <>
      <section className="card">
        <h1 className="h1">Carga manual de CVs</h1>
        <p className="muted">
          Sube uno o varios CVs para crear o reanudar candidaturas y lanzar el flujo seeded por WhatsApp.
        </p>
      </section>

      <VacancySelector
        title="Contexto de importación"
        description="Selecciona el tenant y la vacante a la que se asociarán los CVs."
      />

      <CvUploadPanel files={files} onFilesChange={setFiles} disabled={submitting} />

      <section className="card">
        <div className="form-actions">
          <button className="btn primary" type="button" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Procesando..." : "Procesar CVs"}
          </button>
        </div>
      </section>

      <CvImportResultsTable job={job} onRetry={handleRetry} />
    </>
  );
}
