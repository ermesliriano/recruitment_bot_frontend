import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MariaAvatar from "../components/MariaAvatar";
import { useAppContext } from "../context/AppContext";
import { EMAIL_CHANNEL_ENABLED } from "../lib/featureFlags";
import { getCompanyInfo, updateCompanyInfo } from "../lib/api";

/**
 * Perfil de la empresa — perfil empresarial guiado (CESAR IA Suite).
 *
 * La información alimenta las respuestas de María sobre la empresa. Se guarda
 * en el endpoint company-info existente (institutional_info + canal de email).
 * Las funciones que requieren backend nuevo (autollenado desde web, redacción
 * asistida y correo de prueba) se muestran como funcionalidad futura.
 */

const TABS = [
  { id: "general", label: "Información general" },
  { id: "contact", label: "Contacto y ubicación" },
  { id: "digital", label: "Presencia digital" },
  { id: "culture", label: "Cultura y propuesta laboral" },
  // Pestaña del canal de email visible solo con el flag activo.
  ...(EMAIL_CHANNEL_ENABLED ? [{ id: "email", label: "Correo de reclutamiento" }] : []),
  { id: "preview", label: "Vista previa de María" },
];

const INDUSTRIES = [
  "Tecnología",
  "Comercio",
  "Servicios",
  "Financiera",
  "Salud",
  "Educación",
  "Construcción",
  "Logística",
  "Telecomunicaciones",
  "Otro",
];

const WORK_MODES = ["Presencial", "Híbrida", "Remota", "Según la vacante"];

const EMPTY_FORM = {
  name: "",
  industry: "",
  industry_other: "",
  description: "",
  country: "",
  province: "",
  city: "",
  address: "",
  phone: "",
  whatsapp: "",
  email: "",
  schedule: "",
  website: "",
  instagram: "",
  facebook: "",
  linkedin: "",
  tiktok: "",
  other_url: "",
  about: "",
  culture: "",
  values: "",
  benefits: "",
  work_mode: "",
  dress_code: "",
  selection_process: "",
  start_date: "",
  remote_policy: "",
  growth: "",
};

const EMPTY_CHANNEL = {
  email_from: "",
  email_from_name: "",
  email_reply_to: "",
  email_subject_default: "",
  email_signature: "",
  whatsapp_sender: "",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^\+\d{7,15}$/;
const URL_REGEX = /^https?:\/\/[^\s]+\.[^\s]{2,}$/i;

function cleanPhone(value) {
  return (value || "").replace(/[\s().-]/g, "");
}

function validateEmailValue(value) {
  if (!value) return "";
  return EMAIL_REGEX.test(value.trim()) ? "" : "No parece un correo válido.";
}

function validatePhoneValue(value) {
  if (!value) return "";
  return PHONE_REGEX.test(cleanPhone(value))
    ? ""
    : "Incluye el código de país, p. ej. +18095551234.";
}

function validateUrlValue(value) {
  if (!value) return "";
  return URL_REGEX.test(value.trim()) ? "" : "No parece un enlace válido (debe empezar por https://).";
}

// Normalización de redes: acepta usuario, @usuario o URL completa.
function socialSuggestion(kind, raw) {
  const value = (raw || "").trim();
  if (!value || URL_REGEX.test(value)) return null;
  const handle = value.replace(/^@/, "").replace(/\s+/g, "");
  if (!handle || /[\s/]/.test(handle)) return null;
  const bases = {
    instagram: `https://instagram.com/${handle}`,
    facebook: `https://facebook.com/${handle}`,
    linkedin: `https://linkedin.com/company/${handle}`,
    tiktok: `https://tiktok.com/@${handle}`,
  };
  return bases[kind] || null;
}

function linkStatus(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  if (URL_REGEX.test(trimmed)) return { label: "Válido", ok: true };
  return { label: "Formato incorrecto", ok: false };
}

export default function CompanyInfoPage() {
  const { tenantId } = useAppContext();

  const [form, setForm] = useState(EMPTY_FORM);
  const [channel, setChannel] = useState(EMPTY_CHANNEL);
  const [snapshot, setSnapshot] = useState("");
  const [tab, setTab] = useState("general");
  const [sameWhatsapp, setSameWhatsapp] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | dirty | saving | saved | error
  const [error, setError] = useState("");

  const topRef = useRef(null);

  const serialize = useCallback(
    (f, c) => JSON.stringify({ f, c }),
    []
  );

  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!tenantId) return;
      try {
        setLoading(true);
        setError("");
        const data = await getCompanyInfo(tenantId);
        if (ignore) return;

        const info = data?.institutional_info || {};
        const nextForm = { ...EMPTY_FORM };
        Object.keys(EMPTY_FORM).forEach((key) => {
          nextForm[key] = info[key] || "";
        });
        // Compatibilidad: perfiles antiguos con "location" genérica y sin ciudad.
        if (!nextForm.city && info.location) {
          nextForm.city = info.location;
        }
        const nextChannel = {
          email_from: data?.email_from || "",
          email_from_name: data?.email_from_name || "",
          email_reply_to: data?.email_reply_to || "",
          email_subject_default: data?.email_subject_default || "",
          email_signature: data?.email_signature || "",
          whatsapp_sender: data?.whatsapp_sender || "",
        };

        setForm(nextForm);
        setChannel(nextChannel);
        setSameWhatsapp(Boolean(nextForm.phone) && nextForm.phone === nextForm.whatsapp);
        setSnapshot(serialize(nextForm, nextChannel));
        setSaveState("idle");
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message || "No se pudo cargar el perfil de la empresa.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [tenantId, serialize]);

  const dirty = useMemo(
    () => snapshot !== "" && serialize(form, channel) !== snapshot,
    [form, channel, snapshot, serialize]
  );

  useEffect(() => {
    if (dirty && (saveState === "idle" || saveState === "saved")) {
      setSaveState("dirty");
    }
    if (!dirty && saveState === "dirty") {
      setSaveState("idle");
    }
  }, [dirty, saveState]);

  // Confirmación antes de salir con cambios sin guardar.
  useEffect(() => {
    function onBeforeUnload(e) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function setField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "phone" && sameWhatsapp) {
        next.whatsapp = value;
      }
      return next;
    });
  }

  function setChannelField(key, value) {
    setChannel((current) => ({ ...current, [key]: value }));
  }

  function handleSameWhatsapp(checked) {
    setSameWhatsapp(checked);
    if (checked) {
      setForm((current) => ({ ...current, whatsapp: current.phone }));
    }
  }

  // ── Validaciones inline ────────────────────────────────────────────────
  const errors = useMemo(() => {
    const map = {};
    map.email = validateEmailValue(form.email);
    map.phone = validatePhoneValue(form.phone);
    map.whatsapp = validatePhoneValue(form.whatsapp);
    map.website = validateUrlValue(form.website);
    map.email_from = validateEmailValue(channel.email_from);
    map.email_reply_to = validateEmailValue(channel.email_reply_to);
    map.whatsapp_sender = validatePhoneValue(channel.whatsapp_sender);
    if (form.description && form.description.trim().length < 40) {
      map.description = "La descripción es muy corta: usa al menos 40 caracteres.";
    }
    return map;
  }, [form, channel]);

  const hasBlockingErrors = Object.values(errors).some(Boolean);

  // ── Completitud ────────────────────────────────────────────────────────
  const completeness = useMemo(() => {
    const required = [
      { key: "name", label: "Nombre de la empresa", ok: Boolean(form.name.trim()) },
      { key: "description", label: "Descripción (mín. 40 caracteres)", ok: form.description.trim().length >= 40 },
      { key: "industry", label: "Industria", ok: Boolean(form.industry.trim()) },
      { key: "city", label: "Ubicación (ciudad)", ok: Boolean(form.city.trim()) },
      { key: "email", label: "Email de contacto", ok: Boolean(form.email.trim()) && !errors.email },
      { key: "phone", label: "Teléfono", ok: Boolean(form.phone.trim()) && !errors.phone },
    ];
    const recommended = [
      { key: "website", label: "Página web", ok: Boolean(form.website.trim()) },
      { key: "schedule", label: "Horario de atención", ok: Boolean(form.schedule.trim()) },
      { key: "culture", label: "Cultura de trabajo", ok: Boolean(form.culture.trim()) },
      { key: "benefits", label: "Beneficios", ok: Boolean(form.benefits.trim()) },
      { key: "work_mode", label: "Modalidad de trabajo", ok: Boolean(form.work_mode.trim()) },
      ...(EMAIL_CHANNEL_ENABLED
        ? [{ key: "email_from", label: "Correo remitente", ok: Boolean(channel.email_from.trim()) }]
        : []),
    ];
    const optional = [
      { key: "instagram", label: "Instagram", ok: Boolean(form.instagram.trim()) },
      { key: "facebook", label: "Facebook", ok: Boolean(form.facebook.trim()) },
      { key: "linkedin", label: "LinkedIn", ok: Boolean(form.linkedin.trim()) },
    ];

    const reqOk = required.filter((f) => f.ok).length;
    const recOk = recommended.filter((f) => f.ok).length;
    const optOk = optional.filter((f) => f.ok).length;
    const percent = Math.round(
      (reqOk / required.length) * 60 +
        (recOk / recommended.length) * 30 +
        (optOk / optional.length) * 10
    );

    return {
      percent,
      required,
      recommended,
      optional,
      requiredComplete: reqOk === required.length,
      socialsConfigured: optOk > 0,
      channelConfigured: Boolean(channel.email_from.trim()),
      missing: [...required, ...recommended].filter((f) => !f.ok),
    };
  }, [form, channel, errors]);

  // ── Recomendaciones dinámicas ──────────────────────────────────────────
  const recommendations = useMemo(() => {
    const items = [];
    if (form.description.trim().length < 120) {
      items.push("Agrega una descripción de al menos 120 caracteres para que María presente mejor a la empresa.");
    }
    if (!form.phone.trim() || errors.phone) {
      items.push("Incluye un teléfono con código de país (p. ej. +1809…).");
    }
    if (!form.website.trim()) {
      items.push("Agrega la página web de la empresa.");
    }
    if (!form.benefits.trim() || !form.culture.trim()) {
      items.push("Completa beneficios y cultura: son de las preguntas más frecuentes de los candidatos.");
    }
    if (EMAIL_CHANNEL_ENABLED && !channel.email_from.trim()) {
      items.push("Configura el correo remitente antes de contactar candidatos por email.");
    }
    if (!form.linkedin.trim()) {
      items.push("Agrega LinkedIn para fortalecer la presencia institucional.");
    }
    if (!form.schedule.trim()) {
      items.push("Indica el horario de atención para responder '¿cuál es el horario?'.");
    }
    return items;
  }, [form, channel, errors]);

  // ── Guardado ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!tenantId) return;
    setError("");

    if (hasBlockingErrors) {
      setError("Revisa los campos marcados en rojo antes de guardar.");
      setSaveState("error");
      return;
    }

    // location derivada (compatibilidad con perfiles previos y contexto de María).
    const locationParts = [form.city, form.province, form.country]
      .map((part) => part.trim())
      .filter(Boolean);
    const payload = {
      ...Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, value.trim()])
      ),
      location: locationParts.join(", "),
    };

    try {
      setSaving(true);
      setSaveState("saving");
      const data = await updateCompanyInfo(tenantId, payload, {
        emailFrom: channel.email_from.trim() || null,
        emailFromName: channel.email_from_name.trim() || null,
        emailReplyTo: channel.email_reply_to.trim() || null,
        emailSubjectDefault: channel.email_subject_default.trim() || null,
        emailSignature: channel.email_signature.trim() || null,
        whatsappSender: channel.whatsapp_sender.trim() || null,
      });

      const info = data?.institutional_info || {};
      const nextForm = { ...EMPTY_FORM };
      Object.keys(EMPTY_FORM).forEach((key) => {
        nextForm[key] = info[key] || "";
      });
      const nextChannel = {
        email_from: data?.email_from || "",
        email_from_name: data?.email_from_name || "",
        email_reply_to: data?.email_reply_to || "",
        email_subject_default: data?.email_subject_default || "",
        email_signature: data?.email_signature || "",
        whatsapp_sender: data?.whatsapp_sender || "",
      };
      setForm(nextForm);
      setChannel(nextChannel);
      setSnapshot(serialize(nextForm, nextChannel));
      setSaveState("saved");
    } catch (saveError) {
      setError(saveError.message || "Error al guardar el perfil.");
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (!snapshot) return;
    if (dirty && !window.confirm("¿Descartar los cambios sin guardar?")) return;
    const parsed = JSON.parse(snapshot);
    setForm(parsed.f);
    setChannel(parsed.c);
    setSaveState("idle");
    setError("");
  }

  function goToPreview() {
    setTab("preview");
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  // ── Vista previa de María ──────────────────────────────────────────────
  const NO_INFO = "No tengo esa información registrada. Puedo ayudarte a contactar al equipo de reclutamiento.";
  const preview = useMemo(() => {
    const companyName = form.name.trim() || "la empresa";
    const addressLine = [form.address, form.city, form.province, form.country]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(", ");
    const contactBits = [
      form.email.trim() ? `por correo en ${form.email.trim()}` : "",
      form.phone.trim() ? `por teléfono al ${form.phone.trim()}` : "",
      form.whatsapp.trim() && form.whatsapp.trim() !== form.phone.trim()
        ? `por WhatsApp al ${form.whatsapp.trim()}`
        : "",
    ].filter(Boolean);

    return [
      {
        q: "¿Dónde está ubicada la empresa?",
        a: addressLine ? `${companyName} está ubicada en ${addressLine}.` : NO_INFO,
      },
      {
        q: "¿A qué se dedica?",
        a: form.description.trim() || NO_INFO,
      },
      {
        q: "¿Cuál es el horario?",
        a: form.schedule.trim()
          ? `El horario habitual es: ${form.schedule.trim()}.`
          : NO_INFO,
      },
      {
        q: "¿La posición es presencial?",
        a: form.work_mode.trim()
          ? `La modalidad de trabajo es ${form.work_mode.trim().toLowerCase()}.${
              form.remote_policy.trim() ? ` ${form.remote_policy.trim()}` : ""
            }`
          : NO_INFO,
      },
      {
        q: "¿Cuándo iniciaría?",
        a: form.start_date.trim()
          ? `La fecha estimada de inicio es ${form.start_date.trim()}.`
          : NO_INFO,
      },
      {
        q: "¿Qué beneficios ofrecen?",
        a: form.benefits.trim() || NO_INFO,
      },
      {
        q: "¿Cómo puedo contactar a la empresa?",
        a: contactBits.length
          ? `Puedes contactar a ${companyName} ${contactBits.join(" o ")}.`
          : NO_INFO,
      },
    ];
  }, [form]);

  // ── Render helpers ─────────────────────────────────────────────────────
  function FieldLabel({ htmlFor, children, level }) {
    return (
      <label className="field-label" htmlFor={htmlFor}>
        {children}
        {level ? (
          <span className={`req-badge ${level}`}>
            {level === "required" ? "Obligatorio" : level === "recommended" ? "Recomendado" : "Opcional"}
          </span>
        ) : null}
      </label>
    );
  }

  function TextInput({ id, value, onChange, placeholder, type = "text", errorText, help }) {
    return (
      <div className="field">
        <input
          id={id}
          className={`input${errorText ? " invalid" : ""}`}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(errorText)}
        />
        {help ? <div className="field-help">{help}</div> : null}
        {errorText ? <div className="field-error-text" role="alert">{errorText}</div> : null}
      </div>
    );
  }

  function SocialField({ id, kind, label, value, onChange }) {
    const suggestion = socialSuggestion(kind, value);
    const status = linkStatus(value);
    return (
      <div className="field">
        <FieldLabel htmlFor={id} level="optional">{label}</FieldLabel>
        <input
          id={id}
          className={`input${status && !status.ok && !suggestion ? " invalid" : ""}`}
          type="text"
          value={value}
          placeholder={`@usuario o https://${kind}.com/...`}
          onChange={(e) => onChange(e.target.value)}
        />
        {suggestion ? (
          <div className="field-help">
            ¿Quisiste decir{" "}
            <button className="linklike" type="button" onClick={() => onChange(suggestion)}>
              {suggestion}
            </button>
            ?
          </div>
        ) : null}
        {status ? (
          <div className={status.ok ? "field-help" : "field-error-text"}>
            Estado del enlace: {suggestion ? "Pendiente de verificar" : status.label}
          </div>
        ) : null}
      </div>
    );
  }

  const addressPreview = [form.address, form.city, form.province, form.country]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ");

  const saveStatusText = {
    idle: "Sin cambios pendientes",
    dirty: "Cambios sin guardar",
    saving: "Guardando...",
    saved: "Guardado correctamente",
    error: "Error al guardar",
  }[saveState];

  return (
    <>
      <div ref={topRef} />
      <section className="card">
        <div className="breadcrumb">Configuración / Empresa</div>
        <div className="row-space">
          <div className="page-hero">
            <MariaAvatar size={48} />
            <div>
              <h1 className="h1">Perfil de la empresa</h1>
              <p className="muted" style={{ margin: 0 }}>
                Completa la información que María utilizará para orientar a los
                candidatos y responder preguntas sobre tu organización.
              </p>
            </div>
          </div>
          <div className="row">
            <button className="btn" type="button" onClick={goToPreview}>
              Vista previa de María
            </button>
            <button
              className="btn primary"
              type="button"
              disabled={saving || !dirty}
              onClick={handleSave}
            >
              Guardar cambios
            </button>
          </div>
        </div>

        <div className="profile-progress">
          <div className="profile-progress-top">
            <span>Perfil empresarial</span>
            <button
              className="linklike"
              type="button"
              onClick={() => setShowMissing((s) => !s)}
              aria-expanded={showMissing}
            >
              {completeness.percent}% completado
            </button>
          </div>
          <div
            className="profile-progress-track"
            role="progressbar"
            aria-valuenow={completeness.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="profile-progress-fill"
              style={{ width: `${completeness.percent}%` }}
            />
          </div>

          {showMissing && completeness.missing.length > 0 ? (
            <div className="profile-missing">
              <strong>Campos pendientes:</strong>{" "}
              {completeness.missing.map((f) => f.label).join(" · ")}
            </div>
          ) : null}

          <div className="profile-status-chips">
            <span className={`profile-chip ${completeness.requiredComplete ? "ok" : "warn"}`}>
              {completeness.requiredComplete
                ? "Información esencial completa"
                : "Faltan datos esenciales"}
            </span>
            {EMAIL_CHANNEL_ENABLED ? (
              <span className={`profile-chip ${completeness.channelConfigured ? "ok" : "warn"}`}>
                {completeness.channelConfigured
                  ? "Canal de contacto configurado"
                  : "Canal de contacto pendiente"}
              </span>
            ) : null}
            <span className={`profile-chip ${completeness.socialsConfigured ? "ok" : ""}`}>
              {completeness.socialsConfigured
                ? "Redes sociales configuradas"
                : "Redes sociales no configuradas"}
            </span>
          </div>
        </div>
      </section>

      {!tenantId ? (
        <div className="warning-box">
          Selecciona una empresa en el dashboard antes de editar su perfil.
        </div>
      ) : null}

      {error ? <div className="error-box">{error}</div> : null}

      {loading ? (
        <section className="card">
          <p className="muted">Cargando perfil...</p>
        </section>
      ) : null}

      {tenantId && !loading ? (
        <div className="profile-layout">
          <div className="page-stack" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="card">
              <div className="profile-tabs" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    className={`profile-tab${tab === t.id ? " active" : ""}`}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <select
                className="input profile-tabs-select"
                value={tab}
                onChange={(e) => setTab(e.target.value)}
                aria-label="Sección del perfil"
              >
                {TABS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>

              {/* ── Información general ── */}
              {tab === "general" ? (
                <div style={{ marginTop: 16 }}>
                  <div className="future-feature" style={{ marginBottom: 16 }}>
                    <strong>Importar información desde mi página web</strong>
                    <span className="future-tag">Próximamente</span>
                    <p className="muted" style={{ margin: "6px 0 8px" }}>
                      Analizaremos tu web para proponerte nombre, descripción,
                      contacto y redes. Revisarás la información antes de guardarla:
                      María solo utilizará los datos que confirmes.
                    </p>
                    <div className="row">
                      <input className="input" type="url" placeholder="https://tuempresa.com" disabled style={{ maxWidth: 320 }} />
                      <button className="btn" type="button" disabled>Analizar página</button>
                    </div>
                  </div>

                  <FieldLabel htmlFor="pf-name" level="required">Nombre de la empresa</FieldLabel>
                  <TextInput
                    id="pf-name"
                    value={form.name}
                    onChange={(v) => setField("name", v)}
                    placeholder="Ej. CESAR IA S.R.L."
                  />

                  <FieldLabel htmlFor="pf-industry" level="required">Industria</FieldLabel>
                  <div className="field">
                    <select
                      id="pf-industry"
                      className="input"
                      value={INDUSTRIES.includes(form.industry) ? form.industry : form.industry ? "Otro" : ""}
                      onChange={(e) => setField("industry", e.target.value)}
                    >
                      <option value="">Selecciona una industria...</option>
                      {INDUSTRIES.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  {form.industry === "Otro" ? (
                    <>
                      <FieldLabel htmlFor="pf-industry-other">¿Cuál?</FieldLabel>
                      <TextInput
                        id="pf-industry-other"
                        value={form.industry_other}
                        onChange={(v) => setField("industry_other", v)}
                        placeholder="Describe la industria"
                      />
                    </>
                  ) : null}

                  <FieldLabel htmlFor="pf-description" level="required">Descripción de la empresa</FieldLabel>
                  <div className="field">
                    <textarea
                      id="pf-description"
                      className={`input${errors.description ? " invalid" : ""}`}
                      rows={4}
                      value={form.description}
                      placeholder="Empresa dedicada a…"
                      onChange={(e) => setField("description", e.target.value)}
                    />
                    <div className="char-counter">{form.description.length} caracteres</div>
                    <div className="field-help">
                      Describe qué hace la empresa, a quién sirve y qué la diferencia.
                      Ej.: “Somos una empresa de tecnología especializada en CRM,
                      inteligencia artificial, automatización y Business Intelligence
                      para equipos comerciales.”
                    </div>
                    {errors.description ? (
                      <div className="field-error-text" role="alert">{errors.description}</div>
                    ) : null}
                    <div className="row" style={{ marginTop: 8 }}>
                      <button className="btn small" type="button" disabled title="Funcionalidad futura">
                        Ayúdame a redactar
                      </button>
                      <span className="future-tag">Próximamente</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* ── Contacto y ubicación ── */}
              {tab === "contact" ? (
                <div style={{ marginTop: 16 }}>
                  <div className="detail-grid">
                    <div>
                      <FieldLabel htmlFor="pf-country">País</FieldLabel>
                      <TextInput id="pf-country" value={form.country} onChange={(v) => setField("country", v)} placeholder="República Dominicana" />
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-province">Provincia / Estado</FieldLabel>
                      <TextInput id="pf-province" value={form.province} onChange={(v) => setField("province", v)} placeholder="Santo Domingo" />
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-city" level="required">Ciudad</FieldLabel>
                      <TextInput id="pf-city" value={form.city} onChange={(v) => setField("city", v)} placeholder="Santo Domingo Este" />
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-address">Dirección</FieldLabel>
                      <TextInput id="pf-address" value={form.address} onChange={(v) => setField("address", v)} placeholder="Alma Rosa" />
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-phone" level="required">Teléfono principal</FieldLabel>
                      <TextInput
                        id="pf-phone"
                        type="tel"
                        value={form.phone}
                        onChange={(v) => setField("phone", v)}
                        placeholder="+18095551234"
                        errorText={errors.phone}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-whatsapp" level="recommended">WhatsApp</FieldLabel>
                      <TextInput
                        id="pf-whatsapp"
                        type="tel"
                        value={form.whatsapp}
                        onChange={(v) => setField("whatsapp", v)}
                        placeholder="+18095551234"
                        errorText={errors.whatsapp}
                      />
                      <label className="field-label" style={{ fontWeight: 400 }}>
                        <input
                          type="checkbox"
                          checked={sameWhatsapp}
                          onChange={(e) => handleSameWhatsapp(e.target.checked)}
                        />{" "}
                        Usar el mismo número para teléfono y WhatsApp
                      </label>
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-email" level="required">Email de contacto</FieldLabel>
                      <TextInput
                        id="pf-email"
                        type="email"
                        value={form.email}
                        onChange={(v) => setField("email", v)}
                        placeholder="contacto@tuempresa.com"
                        errorText={errors.email}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-schedule" level="recommended">Horario de atención</FieldLabel>
                      <TextInput
                        id="pf-schedule"
                        value={form.schedule}
                        onChange={(v) => setField("schedule", v)}
                        placeholder="Lunes a viernes, 8:00 a 17:00"
                      />
                    </div>
                  </div>

                  {addressPreview ? (
                    <p className="field-help" style={{ marginTop: 8 }}>
                      Dirección completa: <strong>{addressPreview}</strong>
                    </p>
                  ) : null}

                  <div className="future-feature" style={{ marginTop: 14 }}>
                    <strong>Canal de WhatsApp (remitente)</strong>
                    <p className="muted" style={{ margin: "6px 0 8px" }}>
                      Número desde el que María contacta a los candidatos por
                      WhatsApp. Debe ser un número aprobado para WhatsApp en la
                      plataforma de mensajería; si se deja vacío se usa el número
                      general de la plataforma.
                    </p>
                    <input
                      id="pf-wa-sender"
                      className={`input${errors.whatsapp_sender ? " invalid" : ""}`}
                      type="tel"
                      style={{ maxWidth: 280 }}
                      value={channel.whatsapp_sender}
                      placeholder="+18095551234"
                      onChange={(e) => setChannelField("whatsapp_sender", e.target.value)}
                    />
                    {errors.whatsapp_sender ? (
                      <div className="field-error-text" role="alert">{errors.whatsapp_sender}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* ── Presencia digital ── */}
              {tab === "digital" ? (
                <div style={{ marginTop: 16 }}>
                  <FieldLabel htmlFor="pf-website" level="recommended">Página web</FieldLabel>
                  <TextInput
                    id="pf-website"
                    type="url"
                    value={form.website}
                    onChange={(v) => setField("website", v)}
                    placeholder="https://tuempresa.com"
                    errorText={errors.website}
                  />
                  <div className="detail-grid">
                    <SocialField id="pf-instagram" kind="instagram" label="Instagram" value={form.instagram} onChange={(v) => setField("instagram", v)} />
                    <SocialField id="pf-facebook" kind="facebook" label="Facebook" value={form.facebook} onChange={(v) => setField("facebook", v)} />
                    <SocialField id="pf-linkedin" kind="linkedin" label="LinkedIn" value={form.linkedin} onChange={(v) => setField("linkedin", v)} />
                    <SocialField id="pf-tiktok" kind="tiktok" label="TikTok" value={form.tiktok} onChange={(v) => setField("tiktok", v)} />
                  </div>
                  <FieldLabel htmlFor="pf-other-url" level="optional">Otra red o enlace</FieldLabel>
                  <TextInput
                    id="pf-other-url"
                    value={form.other_url}
                    onChange={(v) => setField("other_url", v)}
                    placeholder="https://..."
                  />
                  <p className="field-help">
                    Los enlaces se validan por formato; la verificación de
                    disponibilidad en línea se marca como “Pendiente de verificar”.
                  </p>
                </div>
              ) : null}

              {/* ── Cultura y propuesta laboral ── */}
              {tab === "culture" ? (
                <div style={{ marginTop: 16 }}>
                  <FieldLabel htmlFor="pf-about" level="recommended">Quiénes somos</FieldLabel>
                  <div className="field">
                    <textarea id="pf-about" className="input" rows={3} value={form.about} placeholder="Nuestra historia y propósito…" onChange={(e) => setField("about", e.target.value)} />
                  </div>

                  <FieldLabel htmlFor="pf-culture" level="recommended">Cultura de trabajo</FieldLabel>
                  <div className="field">
                    <textarea id="pf-culture" className="input" rows={3} value={form.culture} placeholder="Promovemos un ambiente…" onChange={(e) => setField("culture", e.target.value)} />
                    <div className="field-help">¿Cómo describirías el ambiente de trabajo?</div>
                  </div>

                  <FieldLabel htmlFor="pf-values" level="optional">Valores</FieldLabel>
                  <TextInput id="pf-values" value={form.values} onChange={(v) => setField("values", v)} placeholder="Compromiso, innovación, servicio…" />

                  <FieldLabel htmlFor="pf-benefits" level="recommended">Beneficios</FieldLabel>
                  <div className="field">
                    <textarea id="pf-benefits" className="input" rows={3} value={form.benefits} placeholder="Incluimos…" onChange={(e) => setField("benefits", e.target.value)} />
                    <div className="field-help">¿Qué beneficios reciben los colaboradores?</div>
                  </div>

                  <div className="detail-grid">
                    <div>
                      <FieldLabel htmlFor="pf-workmode" level="recommended">Modalidad de trabajo</FieldLabel>
                      <div className="field">
                        <select id="pf-workmode" className="input" value={form.work_mode} onChange={(e) => setField("work_mode", e.target.value)}>
                          <option value="">Selecciona...</option>
                          {WORK_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <div className="field-help">¿La posición es presencial, híbrida o remota?</div>
                      </div>
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-dresscode" level="optional">Código de vestimenta</FieldLabel>
                      <TextInput id="pf-dresscode" value={form.dress_code} onChange={(v) => setField("dress_code", v)} placeholder="Casual de negocios" />
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-selection" level="recommended">Proceso de selección</FieldLabel>
                      <TextInput id="pf-selection" value={form.selection_process} onChange={(v) => setField("selection_process", v)} placeholder="Postulación → entrevista → prueba → oferta" help="¿Cuántas etapas tiene el proceso de selección?" />
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-startdate" level="optional">Fecha estimada de inicio</FieldLabel>
                      <TextInput id="pf-startdate" value={form.start_date} onChange={(v) => setField("start_date", v)} placeholder="Inmediata / próximo mes" help="¿Cuándo podría iniciar el candidato seleccionado?" />
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-remote" level="optional">Política de trabajo remoto</FieldLabel>
                      <TextInput id="pf-remote" value={form.remote_policy} onChange={(v) => setField("remote_policy", v)} placeholder="2 días remotos por semana" />
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-growth" level="optional">Oportunidades de crecimiento</FieldLabel>
                      <TextInput id="pf-growth" value={form.growth} onChange={(v) => setField("growth", v)} placeholder="Plan de carrera, formación continua…" />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* ── Correo de reclutamiento ── */}
              {tab === "email" ? (
                <div style={{ marginTop: 16 }}>
                  <p className="muted">
                    Este será el correo utilizado para contactar candidatos y enviar
                    notificaciones.{" "}
                    <span className={`profile-chip ${channel.email_from ? "ok" : "warn"}`}>
                      {channel.email_from ? "Configurado" : "No configurado"}
                    </span>
                  </p>

                  <div className="detail-grid">
                    <div>
                      <FieldLabel htmlFor="pf-emailfrom" level="required">Correo remitente</FieldLabel>
                      <TextInput
                        id="pf-emailfrom"
                        type="email"
                        value={channel.email_from}
                        onChange={(v) => setChannelField("email_from", v)}
                        placeholder="rrhh@tuempresa.com"
                        errorText={errors.email_from}
                        help="Debe estar verificado antes de poder enviar correos."
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-emailname" level="recommended">Nombre visible del remitente</FieldLabel>
                      <TextInput
                        id="pf-emailname"
                        value={channel.email_from_name}
                        onChange={(v) => setChannelField("email_from_name", v)}
                        placeholder="Empresa X — Reclutamiento"
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-emailreply" level="optional">Correo para respuestas</FieldLabel>
                      <TextInput
                        id="pf-emailreply"
                        type="email"
                        value={channel.email_reply_to}
                        onChange={(v) => setChannelField("email_reply_to", v)}
                        placeholder="(automático si se deja vacío)"
                        errorText={errors.email_reply_to}
                        help="Si se deja vacío, las respuestas llegan al sistema automáticamente (recomendado)."
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="pf-emailsubject" level="optional">Asunto predeterminado</FieldLabel>
                      <TextInput
                        id="pf-emailsubject"
                        value={channel.email_subject_default}
                        onChange={(v) => setChannelField("email_subject_default", v)}
                        placeholder="Actualización sobre tu candidatura"
                      />
                    </div>
                  </div>

                  <FieldLabel htmlFor="pf-emailsignature" level="optional">Firma de correo</FieldLabel>
                  <div className="field">
                    <textarea
                      id="pf-emailsignature"
                      className="input"
                      rows={3}
                      value={channel.email_signature}
                      placeholder={"Equipo de Reclutamiento\nEmpresa X"}
                      onChange={(e) => setChannelField("email_signature", e.target.value)}
                    />
                  </div>

                  <div className="future-feature">
                    <strong>Vista previa</strong>
                    <p className="muted" style={{ margin: "6px 0 0" }}>
                      De: {channel.email_from_name || form.name || "Empresa"}{" "}
                      {channel.email_from ? `<${channel.email_from}>` : ""}
                      <br />
                      Asunto: {channel.email_subject_default || "Actualización sobre tu candidatura"}
                    </p>
                    <div className="row" style={{ marginTop: 10 }}>
                      <button className="btn small" type="button" disabled title="Funcionalidad futura">
                        Enviar correo de prueba
                      </button>
                      <span className="future-tag">Próximamente</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* ── Vista previa de María ── */}
              {tab === "preview" ? (
                <div style={{ marginTop: 16 }}>
                  <h2 className="h2">Así responderá María</h2>
                  <p className="muted">
                    Respuestas generadas únicamente con los campos completados.
                    María no inventa datos faltantes.
                  </p>
                  {preview.map((item) => (
                    <div key={item.q}>
                      <div className="maria-preview-q">{item.q}</div>
                      <div className="maria-preview-bubble">
                        <MariaAvatar size={30} />
                        <div className="chat-bubble in">
                          <div className="chat-bubble-text">{item.a}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <div className="sticky-savebar">
              <span
                className={`save-status ${
                  saveState === "dirty" ? "dirty" : saveState === "saved" ? "saved" : saveState === "error" ? "error" : ""
                }`}
                role="status"
              >
                {saveStatusText}
              </span>
              <div className="row">
                <button className="btn" type="button" onClick={goToPreview}>
                  Vista previa de María
                </button>
                <button className="btn" type="button" disabled={!dirty || saving} onClick={handleDiscard}>
                  Descartar cambios
                </button>
                <button className="btn primary" type="button" disabled={!dirty || saving} onClick={handleSave}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>

            <p className="muted" style={{ fontSize: "0.8rem" }}>
              Esta información será utilizada únicamente para responder preguntas
              relacionadas con la empresa y sus procesos de reclutamiento.
            </p>
          </div>

          <aside className="reco-panel">
            <section className="card">
              <h2 className="h2">Recomendaciones para mejorar el perfil</h2>
              {recommendations.length === 0 ? (
                <p className="muted">
                  ¡Perfil en gran forma! María tiene lo necesario para responder a
                  los candidatos.
                </p>
              ) : (
                <ul>
                  {recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      ) : null}
    </>
  );
}
