import { useCallback, useEffect, useMemo, useState } from "react";
import CvImportResultsTable from "../components/CvImportResultsTable";
import CvPendingPhoneTable from "../components/CvPendingPhoneTable";
import CvUploadPanel from "../components/CvUploadPanel";
import Modal from "../components/Modal";
import VacancySelector from "../components/VacancySelector";
import { useAppContext } from "../context/AppContext";
import {
  createCvImportJob,
  listCvImportJobs,
  resolveCvImportEmail,
  resolveCvImportPhone,
  retryOutboundMessage,
  runScheduledCvImports,
} from "../lib/api";

// Estados de un ítem cuyo teléfono no pudo determinarse automáticamente.
// Estos casos se muestran en un listado aparte para resolverlos manualmente.
const PENDING_PHONE_STATUSES = ["phone_not_found", "ambiguous_phone", "email_not_found"];

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
      _jobStatus: job.status,
      _scheduledAt: job?.summary_json?.scheduled_at || null,
    }))
  );
}

function formatScheduledAt(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CvImportsPage() {
  const { tenantId, vacancyId, pushFlash } = useAppContext();

  const [files, setFiles] = useState([]);
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [sendingNowJobId, setSendingNowJobId] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [channel, setChannel] = useState("whatsapp");

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

  const { processedRows, pendingRows, scheduledRows } = useMemo(() => {
    const processed = [];
    const pending = [];
    const scheduled = [];

    rows.forEach((row) => {
      if (row._jobStatus === "scheduled") {
        // Dashboard especifico: items de jobs programados. Los pendientes de
        // telefono de esos jobs van al listado habitual de correccion.
        if (PENDING_PHONE_STATUSES.includes(row.status)) {
          pending.push(row);
        } else {
          scheduled.push(row);
        }
        return;
      }
      if (PENDING_PHONE_STATUSES.includes(row.status)) {
        pending.push(row);
      } else {
        processed.push(row);
      }
    });

    return { processedRows: processed, pendingRows: pending, scheduledRows: scheduled };
  }, [rows]);

  // Lotes programados agrupados por job (puede haber varios a la vez).
  const scheduledJobs = useMemo(() => {
    const byJob = new Map();
    scheduledRows.forEach((row) => {
      if (!byJob.has(row._jobId)) {
        byJob.set(row._jobId, { jobId: row._jobId, scheduledAt: row._scheduledAt, items: [] });
      }
      byJob.get(row._jobId).items.push(row);
    });
    return Array.from(byJob.values());
  }, [scheduledRows]);

  async function handleSubmit(scheduleIso = null) {
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
      await createCvImportJob(tenantId, vacancyId, files, {
        scheduledAt: scheduleIso || undefined,
        channel,
      });
      setFiles([]);
      setScheduledAt("");
      await loadRows();
      pushFlash(
        "message",
        scheduleIso
          ? "Importación programada correctamente. Los candidatos no recibirán mensajes hasta la fecha indicada."
          : "Importación procesada correctamente."
      );
    } catch (error) {
      pushFlash("error", error.message || "No se pudo procesar la importación.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenScheduleModal() {
    if (!tenantId || !vacancyId) {
      pushFlash("warning", "Selecciona antes tenant y vacante.");
      return;
    }
    if (files.length === 0) {
      pushFlash("warning", "Debes adjuntar al menos un CV.");
      return;
    }
    setShowScheduleModal(true);
  }

  function handleSchedule() {
    if (!scheduledAt) {
      pushFlash("warning", "Indica la fecha y hora de envío.");
      return;
    }
    const parsed = new Date(scheduledAt);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      pushFlash("warning", "La fecha programada debe ser futura.");
      return;
    }
    setShowScheduleModal(false);
    handleSubmit(parsed.toISOString());
  }

  async function handleSendNow(jobId) {
    try {
      setSendingNowJobId(jobId);
      await runScheduledCvImports(tenantId, jobId);
      await loadRows();
      pushFlash("message", "Envío lanzado: los candidatos del lote recibirán el mensaje ahora.");
    } catch (error) {
      pushFlash("error", error.message || "No se pudo lanzar el envío del lote programado.");
    } finally {
      setSendingNowJobId(null);
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

  async function handleResolvePhone(row, value) {
    if (!row?._jobId || !value) return;
    const isEmail = row.status === "email_not_found";

    try {
      setResolvingId(row.id);
      if (isEmail) {
        await resolveCvImportEmail(tenantId, row._jobId, row.id, value);
      } else {
        await resolveCvImportPhone(tenantId, row._jobId, row.id, value);
      }
      // Recargamos el histórico para que el ítem reprocesado salte del listado
      // de pendientes a la tabla de CVs importados con su estado actualizado.
      await loadRows();
      pushFlash(
        "message",
        isEmail
          ? "CV reprocesado con el email indicado."
          : "CV reprocesado con el teléfono indicado."
      );
    } catch (error) {
      pushFlash("error", error.message || "No se pudo reprocesar el CV con ese dato.");
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <>
      <section className="card">
        <h1 className="h1">Carga manual de CVs</h1>
        <p className="muted">
          Sube uno o varios CVs para crear o reanudar candidaturas y contactar a los
          candidatos por el canal que elijas.
        </p>
      </section>

      <VacancySelector
        title="Contexto de importación"
        description="Selecciona la vacante a la que se asociarán los CVs."
      />

      <CvUploadPanel files={files} onFilesChange={setFiles} disabled={submitting} />

      <section className="card">
        <h2 className="h2">Canal de contacto</h2>
        <div className="field">
          <label className="field-label">
            <input
              type="radio"
              name="cv-import-channel"
              value="whatsapp"
              checked={channel === "whatsapp"}
              onChange={() => setChannel("whatsapp")}
              disabled={submitting}
            />{" "}
            WhatsApp — plantilla inicial y flujo conversacional pregunta a pregunta.
          </label>
          <label className="field-label">
            <input
              type="radio"
              name="cv-import-channel"
              value="email"
              checked={channel === "email"}
              onChange={() => setChannel("email")}
              disabled={submitting}
            />{" "}
            Email — un correo con las preguntas de la vacante agrupadas. Requiere
            que el CV contenga una dirección de email (si no, podrás introducirla
            manualmente).
          </label>
        </div>
      </section>

      <section className="card">
        <div className="form-actions">
          <button
            className="btn primary"
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(null)}
          >
            {submitting ? "Procesando..." : "Procesar CVs"}
          </button>
          <button
            className="btn"
            type="button"
            disabled={submitting}
            onClick={handleOpenScheduleModal}
          >
            Programar CVs
          </button>
        </div>
      </section>

      {showScheduleModal ? (
        <Modal
          title="Programar envío de CVs"
          onClose={() => setShowScheduleModal(false)}
          actions={
            <>
              <button
                className="btn"
                type="button"
                onClick={() => setShowScheduleModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={!scheduledAt || submitting}
                onClick={handleSchedule}
              >
                Programar
              </button>
            </>
          }
        >
          <p className="muted">
            Los candidatos no recibirán ningún mensaje hasta la fecha y hora
            indicadas. La detección del teléfono sí se hace al momento, para que
            puedas corregir los CVs sin número antes del envío.
          </p>
          <div className="field">
            <label className="field-label" htmlFor="schedule-datetime">
              Fecha y hora de envío
            </label>
            <input
              id="schedule-datetime"
              className="input"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              autoFocus
            />
          </div>
        </Modal>
      ) : null}

      {scheduledJobs.map((job) => (
        <section className="card" key={job.jobId}>
          <div className="row-space">
            <div>
              <h2 className="h2">CVs programados</h2>
              <p className="muted">
                Lote a la espera de su fecha de envío. Envío programado:{" "}
                <strong>{formatScheduledAt(job.scheduledAt)}</strong>
              </p>
            </div>
            <div className="row">
              <button
                className="btn primary"
                type="button"
                disabled={sendingNowJobId !== null}
                onClick={() => handleSendNow(job.jobId)}
              >
                {sendingNowJobId === job.jobId ? "Enviando..." : "Enviar ahora"}
              </button>
            </div>
          </div>
          <CvImportResultsTable rows={job.items} loading={loadingRows} onRetry={handleRetry} />
        </section>
      ))}

      <CvImportResultsTable rows={processedRows} loading={loadingRows} onRetry={handleRetry} />

      <CvPendingPhoneTable rows={pendingRows} onResolve={handleResolvePhone} busyId={resolvingId} />
    </>
  );
}
