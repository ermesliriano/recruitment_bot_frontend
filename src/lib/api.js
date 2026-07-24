import { getAuthToken } from "./auth";

// Ojo: VITE_ADMIN_TOKEN es útil para demo, pero no es un secreto real.
// Si existe, quedará embebido en el bundle del frontend.

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");

const ENV_ADMIN_TOKEN = String(import.meta.env.VITE_ADMIN_TOKEN || "").trim();

console.log("[ENV DEBUG]", {
  MODE: import.meta.env.MODE,
  PROD: import.meta.env.PROD,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_TENANT_ID: import.meta.env.VITE_TENANT_ID,
  VITE_VACANCY_ID: import.meta.env.VITE_VACANCY_ID,
  hasAdminToken: Boolean(import.meta.env.VITE_ADMIN_TOKEN),
});

export class ApiError extends Error {
  constructor(message, { status = 0, body = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function getNormalizedBaseUrl() {
  if (!API_BASE_URL) {
    throw new ApiError(
      "Falta VITE_API_BASE_URL en el entorno del frontend."
    );
  }

  return `${API_BASE_URL}/`;
}

function buildUrl(path, query = {}) {
  const normalizedPath = String(path || "").replace(/^\//, "");
  const url = new URL(normalizedPath, getNormalizedBaseUrl());

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    const parsedValue = String(value).trim();
    if (parsedValue) {
      url.searchParams.set(key, parsedValue);
    }
  });

  return url.toString();
}

function extractErrorMessage(body, response) {
  if (!body) {
    return response.statusText || `Error HTTP ${response.status}`;
  }

  if (typeof body === "string") {
    return body;
  }

  if (Array.isArray(body.detail)) {
    return body.detail.map((item) => item.msg || JSON.stringify(item)).join(" | ");
  }

  if (typeof body.detail === "string") {
    return body.detail;
  }

  if (
    typeof body.detail === "object" &&
    body.detail !== null &&
    typeof body.detail.message === "string"
  ) {
    return body.detail.message;
  }

  if (typeof body.error === "string") {
    return body.error;
  }

  if (typeof body.message === "string") {
    return body.message;
  }

  return JSON.stringify(body);
}

async function parseResponseBody(response) {
  if (response.status === 204) {
    return null;
  }

  const rawText = await response.text();
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

export async function apiFetch(
  path,
  { method = "GET", token, headers, body, query } = {}
) {
  const finalHeaders = new Headers(headers || {});
  finalHeaders.set("Accept", "application/json");

  const effectiveToken = String(
    token || getAuthToken() || ENV_ADMIN_TOKEN || ""
  ).trim();

  if (effectiveToken) {
    finalHeaders.set("Authorization", `Bearer ${effectiveToken}`);
  }

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const hasBody = body !== undefined && body !== null;
  if (hasBody && !isFormData && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  let response;

  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: finalHeaders,
      body: hasBody ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });
  } catch (networkError) {
    throw new ApiError(
      networkError.message || "No se pudo conectar con la API."
    );
  }

  const parsedBody = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(parsedBody, response), {
      status: response.status,
      body: parsedBody,
    });
  }

  return parsedBody;
}

export function splitLinesToList(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeVacancyListResponse(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

export async function listVacancies(tenantId, options = {}) {
  const response = await apiFetch("/vacancies/", {
    method: "GET",
    query: {
      tenant_id: tenantId,
    },
    token: options.token,
  });

  return normalizeVacancyListResponse(response);
}

export async function getRanking(tenantId, vacancyId, options = {}) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(
      String(tenantId).trim()
    )}/vacancies/${encodeURIComponent(String(vacancyId).trim())}/ranking`,
    {
      method: "GET",
      token: options.token,
    }
  );
}

export async function getApplicationDetail(
  tenantId,
  applicationId,
  options = {}
) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(
      String(tenantId).trim()
    )}/applications/${encodeURIComponent(String(applicationId).trim())}`,
    {
      method: "GET",
      token: options.token,
    }
  );
}

export async function createVacancy(payload, options = {}) {
  return apiFetch("/vacancies/", {
    method: "POST",
    body: payload,
    token: options.token,
  });
}

export async function getVacancy(vacancyId, options = {}) {
  return apiFetch(
    `/vacancies/${encodeURIComponent(String(vacancyId).trim())}`,
    { method: "GET", token: options.token }
  );
}

export async function updateVacancy(vacancyId, payload, options = {}) {
  return apiFetch(
    `/vacancies/${encodeURIComponent(String(vacancyId).trim())}`,
    { method: "PUT", body: payload, token: options.token }
  );
}

export async function setVacancyStatus(vacancyId, status, options = {}) {
  return apiFetch(
    `/vacancies/${encodeURIComponent(String(vacancyId).trim())}/status`,
    { method: "PATCH", body: { status }, token: options.token }
  );
}

export async function listVacancyQuestions(vacancyId, options = {}) {
  return apiFetch(
    `/vacancies/${encodeURIComponent(String(vacancyId).trim())}/questions`,
    { method: "GET", token: options.token }
  );
}

export function buildQuestionPayload({
  tenantId,
  code,
  text,
  type,
  required,
  order,
  options,
  max_points,
}) {
  const normalizedCode = String(code || "").trim();
  const normalizedText = String(text || "").trim();

  const normalizedAnswerType = normalizeAnswerType(type);

  return {
    question_code: normalizedCode || `q_${Date.now()}`,
    prompt_text: normalizedText,
    answer_type: normalizedAnswerType,

    question_order:
      Number.isFinite(Number(order)) && Number(order) > 0
        ? Number(order)
        : 1,

    field_key: normalizedCode || `q_${Date.now()}`,

    prompt_override: null,
    validation: buildValidation(type, options),
    required: Boolean(required),
    scoring_enabled: true,
    max_points:
      Number.isFinite(Number(max_points)) && Number(max_points) >= 0
        ? Number(max_points)
        : 0,
  };
}

function normalizeAnswerType(type) {
  const value = String(type || "text").trim().toLowerCase();

  if (value === "textarea") {
    return "text";
  }

  if (value === "select") {
    return "text";
  }

  if (value === "boolean") {
    return "boolean";
  }

  if (value === "number") {
    return "number";
  }

  return "text";
}

function buildValidation(type, options) {
  const value = String(type || "").trim().toLowerCase();

  if (value === "boolean") {
    return {
      true_values: ["si", "sí", "s", "yes", "true"],
      false_values: ["no", "n", "false"],
    };
  }

  if (value === "number") {
    return {
      min: 0,
      max: 100,
    };
  }

  const optionList = splitLinesToList(options);

  if (value === "select" && optionList.length > 0) {
    return {
      options: optionList,
    };
  }

  return {};
}

export async function createVacancyQuestion(
  vacancyId,
  tenantId,
  payload,
  options = {}
) {
  return apiFetch(
    `/vacancies/${encodeURIComponent(String(vacancyId).trim())}/questions`,
    {
      method: "POST",
      body: payload,
      query: { tenant_id: tenantId },
      token: options.token,
    }
  );
}

export async function updateVacancyQuestion(
  vacancyId,
  vqId,
  payload,
  options = {}
) {
  return apiFetch(
    `/vacancies/${encodeURIComponent(String(vacancyId).trim())}/questions/${encodeURIComponent(String(vqId).trim())}`,
    {
      method: "PATCH",
      body: payload,
      token: options.token,
    }
  );
}

export async function deleteVacancy(vacancyId, options = {}) {
  return apiFetch(
    `/vacancies/${encodeURIComponent(String(vacancyId).trim())}`,
    {
      method: "DELETE",
      token: options.token,
    }
  );
}

export async function deleteVacancyQuestion(vacancyId, vqId, options = {}) {
  return apiFetch(
    `/vacancies/${encodeURIComponent(String(vacancyId).trim())}/questions/${encodeURIComponent(String(vqId).trim())}`,
    {
      method: "DELETE",
      token: options.token,
    }
  );
}

// ── Tenant screening questions (genéricas por tenant) ──────────────────────────

export function buildTenantQuestionPayload({ code, text, type, required, order, display_condition = {}, includeInCvScore = true }) {
  const normalizedCode = String(code || "").trim();
  const fallbackCode = normalizedCode || `tenant_q_${Date.now()}`;
  const answerType = String(type || "text").trim().toLowerCase();

  const validation =
    answerType === "boolean"
      ? { true_values: ["si", "sí", "s", "yes", "true"], false_values: ["no", "n", "false"] }
      : answerType === "number"
      ? { min: 0 }
      : {};

  return {
    question_code: fallbackCode,
    prompt_text: String(text || "").trim(),
    answer_type: answerType,
    default_validation: validation,
    field_key: fallbackCode,
    question_order:
      Number.isFinite(Number(order)) && Number(order) > 0 ? Number(order) : 1,
    prompt_override: null,
    validation,
    display_condition: display_condition && Object.keys(display_condition).length > 0 ? display_condition : {},
    required: Boolean(required),
    ask_before_cv: true,
    include_in_cv_score: Boolean(includeInCvScore),
  };
}

export async function listTenantQuestions(tenantId, options = {}) {
  return apiFetch(
    `/tenants/${encodeURIComponent(String(tenantId).trim())}/screening-questions`,
    { method: "GET", token: options.token }
  );
}

export async function createTenantQuestion(tenantId, payload, options = {}) {
  return apiFetch(
    `/tenants/${encodeURIComponent(String(tenantId).trim())}/screening-questions`,
    { method: "POST", body: payload, token: options.token }
  );
}

export async function updateTenantQuestion(tenantId, tqId, payload, options = {}) {
  return apiFetch(
    `/tenants/${encodeURIComponent(String(tenantId).trim())}/screening-questions/${encodeURIComponent(String(tqId).trim())}`,
    { method: "PATCH", body: payload, token: options.token }
  );
}

export async function deleteTenantQuestion(tenantId, tqId, options = {}) {
  return apiFetch(
    `/tenants/${encodeURIComponent(String(tenantId).trim())}/screening-questions/${encodeURIComponent(String(tqId).trim())}`,
    { method: "DELETE", token: options.token }
  );
}

/**
 * Llama al endpoint que genera preguntas de screening automáticamente
 * a partir de los requisitos obligatorios de la vacante usando el LLM.
 *
 * Solo disponible si la vacante tiene entre 1 y 10 requisitos obligatorios
 * y no tiene preguntas activas previas.
 */
export async function generateVacancyQuestionsFromRequirements(
  vacancyId,
  tenantId,
  options = {}
) {
  return apiFetch(
    `/vacancies/${encodeURIComponent(String(vacancyId).trim())}/questions/generate-from-requirements`,
    {
      method: "POST",
      query: { tenant_id: tenantId },
      body: { force: false },
      token: options.token,
    }
  );
}

export async function probeAdminToken({
  tenantId,
  vacancyId,
  token,
} = {}) {
  const normalizedToken = String(token || "").trim();

  if (!normalizedToken) {
    throw new ApiError("Debes informar un token de administrador.");
  }

  if (!tenantId || !vacancyId) {
    return {
      ok: true,
      deferred: true,
      message:
        "Sesión guardada. La verificación real se hará cuando invoques el primer endpoint protegido.",
    };
  }

  try {
    await getRanking(tenantId, vacancyId, { token: normalizedToken });

    return {
      ok: true,
      deferred: false,
      message:
        "Token verificado correctamente contra el endpoint protegido de ranking.",
    };
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      throw error;
    }

    return {
      ok: true,
      deferred: true,
      message:
        "Sesión guardada. No se pudo completar la verificación previa, pero el backend seguirá validando el token en cada operación protegida.",
    };
  }
}

export async function createCvImportJob(tenantId, vacancyId, files, options = {}) {
  const formData = new FormData();
  formData.append("vacancy_id", vacancyId);
  if (options.scheduledAt) {
    formData.append("scheduled_at", options.scheduledAt);
  }
  if (options.channel) {
    formData.append("channel", options.channel);
  }
  files.forEach((file) => formData.append("files", file));

  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/cv-imports`,
    {
      method: "POST",
      body: formData,
      token: options.token,
    }
  );
}

export async function runScheduledCvImports(tenantId, jobId, options = {}) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/cv-imports/run-scheduled`,
    {
      method: "POST",
      query: jobId ? { job_id: jobId } : {},
      token: options.token,
    }
  );
}

export async function getCvImportJob(tenantId, jobId, options = {}) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/cv-imports/${encodeURIComponent(String(jobId).trim())}`,
    {
      method: "GET",
      token: options.token,
    }
  );
}

export async function listCvImportJobs(tenantId, vacancyId, options = {}) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/cv-imports`,
    {
      method: "GET",
      query: { vacancy_id: vacancyId },
      token: options.token,
    }
  );
}

export async function retryOutboundMessage(tenantId, jobId, itemId, options = {}) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/cv-imports/${encodeURIComponent(String(jobId).trim())}/items/${encodeURIComponent(String(itemId).trim())}/retry-outbound`,
    {
      method: "POST",
      token: options.token,
    }
  );
}

export async function resolveCvImportPhone(tenantId, jobId, itemId, phone, options = {}) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/cv-imports/${encodeURIComponent(String(jobId).trim())}/items/${encodeURIComponent(String(itemId).trim())}/resolve-phone`,
    {
      method: "POST",
      body: { phone },
      token: options.token,
    }
  );
}

export async function resolveCvImportEmail(tenantId, jobId, itemId, email, options = {}) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/cv-imports/${encodeURIComponent(String(jobId).trim())}/items/${encodeURIComponent(String(itemId).trim())}/resolve-email`,
    {
      method: "POST",
      body: { email },
      token: options.token,
    }
  );
}

// ── Flujo de conversación por tenant (bot clásico vs flujo LLM) ──────────
// Solo máximos administradores (token de administrador).

export async function getConversationFlow(tenantId, options = {}) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/conversation-flow`,
    { method: "GET", token: options.token }
  );
}

export async function updateConversationFlow(tenantId, payload, options = {}) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/conversation-flow`,
    { method: "PUT", body: payload, token: options.token }
  );
}

export async function getCompanyInfo(tenantId, options = {}) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/company-info`,
    { method: "GET", token: options.token }
  );
}

export async function updateCompanyInfo(tenantId, institutionalInfo, options = {}) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/company-info`,
    {
      method: "PUT",
      body: {
        institutional_info: institutionalInfo,
        email_from: options.emailFrom ?? null,
        email_from_name: options.emailFromName ?? null,
        email_reply_to: options.emailReplyTo ?? null,
        email_subject_default: options.emailSubjectDefault ?? null,
        email_signature: options.emailSignature ?? null,
        whatsapp_sender: options.whatsappSender ?? null,
      },
      token: options.token,
    }
  );
}

// ── Autenticación de usuarios y administración (roles) ─────────────

export async function authBootstrapStatus() {
  return apiFetch("/auth/bootstrap-status", { method: "GET" });
}

export async function authBootstrap({ email, password, fullName }) {
  return apiFetch("/auth/bootstrap", {
    method: "POST",
    body: { email, password, full_name: fullName || null },
  });
}

export async function authLogin({ email, password }) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function authMe(token) {
  return apiFetch("/auth/me", { method: "GET", token });
}

export async function listTenantsAdmin(options = {}) {
  return apiFetch("/admin/v1/tenants", { method: "GET", token: options.token });
}

export async function createTenant({ name, slug }, options = {}) {
  return apiFetch("/admin/v1/tenants", {
    method: "POST",
    body: { name, slug: slug || null },
    token: options.token,
  });
}

export async function listUsersAdmin(options = {}) {
  return apiFetch("/admin/v1/users", { method: "GET", token: options.token });
}

export async function createUserAdmin(
  { email, password, role, tenantId, fullName },
  options = {}
) {
  return apiFetch("/admin/v1/users", {
    method: "POST",
    body: {
      email,
      password,
      role,
      tenant_id: tenantId || null,
      full_name: fullName || null,
    },
    token: options.token,
  });
}

// ── Conversaciones con candidatos (transcripción) ────────────────────

export async function getConversations(tenantId, options = {}) {
  const query = {};
  if (options.vacancyId) query.vacancy_id = options.vacancyId;

  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/conversations`,
    { method: "GET", query, token: options.token }
  );
}

export async function getConversationMessages(
  tenantId,
  platform,
  chatId,
  options = {}
) {
  const query = {
    platform,
    chat_id: chatId,
  };
  if (options.limit) query.limit = options.limit;
  if (options.before) query.before = options.before;

  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/conversations/messages`,
    { method: "GET", query, token: options.token }
  );
}

export async function sendConversationMessage(
  tenantId,
  platform,
  chatId,
  text,
  options = {}
) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/conversations/messages`,
    {
      method: "POST",
      body: { platform, chat_id: chatId, text },
      token: options.token,
    }
  );
}

// ── Fichero original del CV ─────────────────────────────────

/**
 * Descarga el fichero original del CV como Blob (pdf/imagen/doc).
 * Devuelve { blob, mimeType, filename }. Lanza ApiError con el detalle del
 * backend si el fichero no está disponible.
 */
export async function fetchApplicationCvFile(tenantId, applicationId, options = {}) {
  const effectiveToken = String(
    options.token || getAuthToken() || ENV_ADMIN_TOKEN || ""
  ).trim();

  const headers = new Headers();
  if (effectiveToken) {
    headers.set("Authorization", `Bearer ${effectiveToken}`);
  }

  let response;
  try {
    response = await fetch(
      buildUrl(
        `/admin/v1/tenants/${encodeURIComponent(String(tenantId).trim())}/applications/${encodeURIComponent(String(applicationId).trim())}/cv-file`
      ),
      { method: "GET", headers }
    );
  } catch (networkError) {
    throw new ApiError(networkError.message || "No se pudo conectar con la API.");
  }

  if (!response.ok) {
    let detail = `Error ${response.status}`;
    try {
      const data = await response.json();
      detail = data?.detail || detail;
    } catch {
      // cuerpo no JSON: dejamos el mensaje generico
    }
    throw new ApiError(detail, { status: response.status });
  }

  const blob = await response.blob();
  const mimeType = response.headers.get("Content-Type") || "application/octet-stream";

  let filename = "cv";
  const disposition = response.headers.get("Content-Disposition") || "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (utf8Match) {
    try {
      filename = decodeURIComponent(utf8Match[1]);
    } catch {
      filename = utf8Match[1];
    }
  } else if (plainMatch) {
    filename = plainMatch[1];
  }

  return { blob, mimeType, filename };
}
