import { useCallback, useEffect, useMemo, useState } from "react";
import CvImportResultsTable from "../components/CvImportResultsTable";
import CvPendingPhoneTable from "../components/CvPendingPhoneTable";
import CvUploadPanel from "../components/CvUploadPanel";
import VacancySelector from "../components/VacancySelector";
import { useAppContext } from "../context/AppContext";
import {
  createCvImportJob,
  listCvImportJobs,
  resolveCvImportPhone,
  retryOutboundMessage,
} from "../lib/api";

// Estados de un ítem cuyo teléfono no pudo determinarse automáticamente.
// Estos casos se muestran en un listado aparte para resolverlos manualmente.
const PENDING_PHONE_STATUSES = ["phone_not_found", "ambiguous_phone"];

function flattenJobsToRows(jobs) {
  const list = Array.isArray(jobs) ? jobs : [];

  // El backend devuelve los jobs ordenados por created_at descendente
  // (la ronda más reciente primero) con sus items embebidos. Aplanamos
  // todos los items conservando ese orden y anotamos el job de origen
  // para poder reintentar o reprocesar el ítem correcto.
  return list.flatMap((job) =>
    (Array.isArray(job?.items) ? job.items : []).map((item) => ({
      ...item,
      _jobId: job.id,
    }))
  );
}

export default function CvImportsPage() {
  const { tenantId, vacancyId, pushFlash } = useAppContext();

  const [files, setFiles] = useState([]);
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);

  const loadRows = useCallback(async () => {
    if (!tenantId || !vacancyId) {
      setRows([]);
      return;
    }

    try {
      setLoadingRows(true);
      const jobs = await listCvImportJobs(tenantId, vacancyId);
      setRows(flattenJobsToRows(jobs));
    } catch (error) {
      pushFlash("error", error.message || "No se pudieron cargar las importaciones de la vacante.");
    } finally {
      setLoadingRows(false);
    }
  }, [tenantId, vacancyId, pushFlash]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const { processedRows, pendingRows } = useMemo(() => {
    const processed = [];
    const pending = [];

    rows.forEach((row) => {
      if (PENDING_PHONE_STATUSES.includes(row.status)) {
        pending.push(row);
      } else {
        processed.push(row);
      }
    });

    return { processedRows: processed, pendingRows: pending };
  }, [rows]);

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
      await createCvImportJob(tenantId, vacancyId, files);
      setFiles([]);
      await loadRows();
      pushFlash("message", "Importación procesada correctamente.");
    } catch (error) {
      pushFlash("error", error.message || "No se pudo procesar la importación.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetry(row) {
    if (!row?._jobId) return;

    try {
      const updatedItem = await retryOutboundMessage(tenantId, row._jobId, row.id);
      setRows((current) =>
        current.map((item) =>
          item.id === updatedItem.id ? { ...item, ...updatedItem, _jobId: row._jobId } : item
        )
      );
      pushFlash("message", "Outbound reintentado.");
    } catch (error) {
      pushFlash("error", error.message || "No se pudo reintentar el outbound.");
    }
  }

  async function handleResolvePhone(row, phone) {
    if (!row?._jobId || !phone) return;

    try {
      setResolvingId(row.id);
      await resolveCvImportPhone(tenantId, row._jobId, row.id, phone);
      // Recargamos el histórico para que el ítem reprocesado salte del listado
      // de pendientes a la tabla de CVs importados con su estado actualizado.
      await loadRows();
      pushFlash("message", "CV reprocesado con el teléfono indicado.");
    } catch (error) {
      pushFlash("error", error.message || "No se pudo reprocesar el CV con ese teléfono.");
    } finally {
      setResolvingId(null);
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

      <CvImportResultsTable rows={processedRows} loading={loadingRows} onRetry={handleRetry} />

      <CvPendingPhoneTable rows={pendingRows} onResolve={handleResolvePhone} busyId={resolvingId} />
    </>
  );
}
