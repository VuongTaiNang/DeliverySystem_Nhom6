export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

// React StrictMode can mount effects twice in development. Reuse identical
// in-flight Operations GETs so they do not double the database work.
const inFlightOperationsGets = new Map<string, Promise<unknown>>();

function normalizeUtcDates(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeUtcDates);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, current]) => {
        if (
          typeof current === "string" &&
          (key === "at" || key.endsWith("At")) &&
          /^\d{4}-\d{2}-\d{2}T/.test(current) &&
          !/(?:Z|[+-]\d{2}:\d{2})$/i.test(current)
        ) {
          return [key, `${current}Z`];
        }

        return [key, normalizeUtcDates(current)];
      }),
    );
  }

  return value;
}

export function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET" || !path.startsWith("/operations/") || init?.signal || init?.headers || init?.body) {
    return requestOnce<T>(path, init);
  }

  const key = `${localStorage.getItem("express-token") ?? ""}:${path}`;
  const existing = inFlightOperationsGets.get(key);
  if (existing) return existing as Promise<T>;

  const task = requestOnce<T>(path, init);
  inFlightOperationsGets.set(key, task);
  const cleanup = () => {
    if (inFlightOperationsGets.get(key) === task) inFlightOperationsGets.delete(key);
  };
  void task.then(cleanup, cleanup);
  return task;
}

async function requestOnce<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  const token = localStorage.getItem("express-token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");

  const method = (init?.method ?? "GET").toUpperCase();
  // On a cold local SQL Server, Operations GETs can take longer than 15s.
  const timeoutMs = method === "GET" && path.startsWith("/operations/") ? 30000 : 15000;
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(`${BASE}/api/v1${path}`, {
      ...init,
      headers,
      signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    if (import.meta.env.DEV) {
      console.warn(`[API] ${method} ${path.split("?")[0]} failed after ${elapsedMs} ms`, error);
    }
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ApiError(0, `Máy chủ phản hồi quá chậm (quá ${timeoutMs / 1000} giây). Vui lòng kiểm tra API Operations và SQL Server.`);
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(0, "Yêu cầu đã bị hủy trước khi máy chủ trả lời.");
    }
    throw new ApiError(0, "Không kết nối được máy chủ. Vui lòng kiểm tra địa chỉ API và kết nối mạng.");
  }

  const elapsedMs = Math.round(performance.now() - startedAt);
  if (import.meta.env.DEV && elapsedMs >= 3000) {
    console.warn(`[API slow] ${method} ${path.split("?")[0]}: ${elapsedMs} ms, HTTP ${response.status}`);
  }

  const raw = await response.text();
  let body: unknown = null;

  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    // Validated below.
  }

  if (!response.ok) {
    if (
      response.status === 401 &&
      !path.startsWith("/auth/") &&
      token &&
      localStorage.getItem("express-token") === token
    ) {
      localStorage.removeItem("express-token");
      localStorage.removeItem("express-user");
      window.dispatchEvent(new Event("express:session-expired"));
    }

    if (response.status === 403) {
      throw new ApiError(403, "Bạn không có quyền truy cập chức năng này.");
    }

    const problem = body as {
      message?: string;
      title?: string;
      errors?: Record<string, string[]>;
    } | null;

    const fields = problem?.errors &&
      Object.values(problem.errors)
        .flat()
        .filter((v) => typeof v === "string");

    throw new ApiError(
      response.status,
      problem?.message ||
        (fields?.length ? fields.join(" ") : problem?.title) ||
        `Yêu cầu không thành công (${response.status}).`,
    );
  }

  if (response.status === 204) return undefined as T;

  if (!raw || (body === null && raw.trim() !== "null")) {
    throw new ApiError(response.status, "Máy chủ trả về dữ liệu không hợp lệ.");
  }

  return normalizeUtcDates(body) as T;
}
