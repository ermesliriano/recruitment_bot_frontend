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

  const hasBody = body !== undefined && body !== null;
  if (hasBody && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  let response;

  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: finalHeaders,
      body: hasBody ? JSON.stringify(body) : undefined,
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
