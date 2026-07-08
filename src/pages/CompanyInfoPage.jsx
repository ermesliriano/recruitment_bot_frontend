import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { getCompanyInfo, updateCompanyInfo } from "../lib/api";

const INSTITUTIONAL_FIELDS = [
  { key: "name", label: "Nombre de la empresa" },
  { key: "description", label: "Descripción" },
  { key: "industry", label: "Industria" },
  { key: "location", label: "Ubicación" },
  { key: "website", label: "Página web" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "email", label: "Email de contacto" },
  { key: "phone", label: "Teléfono de contacto" },
];

const LONG_TEXT_FIELDS = new Set(["description"]);

export default function CompanyInfoPage() {
  const { tenantId } = useAppContext();

  const [info, setInfo] = useState({});
  const [emailFrom, setEmailFrom] = useState("");
  const [emailFromName, setEmailFromName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!tenantId) return;
      try {
        setLoading(true);
        setError("");
        setSuccess("");
        const data = await getCompanyInfo(tenantId);
        if (!ignore) {
          setInfo(data?.institutional_info || {});
          setEmailFrom(data?.email_from || "");
          setEmailFromName(data?.email_from_name || "");
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError.message || "No se pudo cargar la información de la empresa."
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [tenantId]);

  function handleChange(key, value) {
    setInfo((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setError("");
    setSuccess("");
    try {
      setSaving(true);
      const data = await updateCompanyInfo(tenantId, info, {
        emailFrom: emailFrom.trim() || null,
        emailFromName: emailFromName.trim() || null,
      });
      setInfo(data?.institutional_info || {});
      setEmailFrom(data?.email_from || "");
      setEmailFromName(data?.email_from_name || "");
      setSuccess("Información de la empresa guardada correctamente.");
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la información.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="card">
        <div className="row-space">
          <div>
            <h1 className="h1">Datos de la empresa</h1>
            <p className="muted">
              Información institucional que la asistente virtual podrá usar para
              responder preguntas de los candidatos durante el proceso (web, redes,
              ubicación, contacto...). Solo se utilizan los campos con valor; la
              asistente nunca inventará los que falten.
            </p>
          </div>
          <div className="row">
            <Link className="btn" to="/dashboard">Dashboard</Link>
          </div>
        </div>
      </section>

      {!tenantId ? (
        <div className="warning-box">
          Selecciona una empresa en el dashboard antes de editar sus datos.
        </div>
      ) : null}

      {error ? <div className="error-box">{error}</div> : null}
      {success ? <div className="success-box">{success}</div> : null}

      {loading ? (
        <section className="card">
          <p className="muted">Cargando información...</p>
        </section>
      ) : null}

      {tenantId && !loading ? (
        <section className="card">
          <div className="detail-grid">
            {INSTITUTIONAL_FIELDS.map((field) => (
              <div key={field.key} className="field">
                <label className="field-label" htmlFor={`inst-${field.key}`}>
                  {field.label}
                </label>
                {LONG_TEXT_FIELDS.has(field.key) ? (
                  <textarea
                    id={`inst-${field.key}`}
                    className="input"
                    rows={3}
                    value={info[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                ) : (
                  <input
                    id={`inst-${field.key}`}
                    className="input"
                    type="text"
                    value={info[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <button
              className="btn primary"
              type="button"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Guardando..." : "Guardar datos"}
            </button>
          </div>
        </section>
      ) : null}

      {tenantId && !loading ? (
        <section className="card">
          <h2 className="h2">Canal de email</h2>
          <p className="muted">
            Correo remitente con el que el sistema contactará a los candidatos por
            email. Debe estar verificado en la plataforma de envío; si se deja
            vacío, se usa el remitente por defecto del servicio.
          </p>
          <div className="detail-grid">
            <div className="field">
              <label className="field-label" htmlFor="email-from">
                Correo remitente
              </label>
              <input
                id="email-from"
                className="input"
                type="email"
                placeholder="reclutamiento@suempresa.com"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="email-from-name">
                Nombre visible del remitente
              </label>
              <input
                id="email-from-name"
                className="input"
                type="text"
                placeholder="Empresa X - Reclutamiento"
                value={emailFromName}
                onChange={(e) => setEmailFromName(e.target.value)}
              />
            </div>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button
              className="btn primary"
              type="button"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Guardando..." : "Guardar datos"}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
