export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

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

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  const token = localStorage.getItem("express-token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${BASE}/api/v1${path}`, {
      ...init,
      headers,
      signal: init?.signal ?? AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(0, "Không kết nối được máy chủ. Vui lòng thử lại sau.");
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
