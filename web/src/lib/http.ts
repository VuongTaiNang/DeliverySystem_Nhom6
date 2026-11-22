export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

// Deduplicate simultaneous identical GET requests across Customer, Staff,
// and Operations (including React StrictMode development re-mounts).
// This is not a persistent cache: fresh data is requested after completion.
const inFlightGets = new Map<string, Promise<unknown>>();

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
  if (method !== "GET" || init?.signal || init?.headers || init?.body) {
    return requestOnce<T>(path, init);
  }

  const key = `${localStorage.getItem("express-token") ?? ""}:${path}`;
  const existing = inFlightGets.get(key);
  if (existing) return existing as Promise<T>;

  const task = requestReadWithRetry<T>(path, init);
  inFlightGets.set(key, task);
  const cleanup = () => {
    if (inFlightGets.get(key) === task) inFlightGets.delete(key);
  };
  void task.then(cleanup, cleanup);
  return task;
}

// Chỉ thử lại GET (không tác động dữ liệu) khi lỗi mạng thoáng qua/503.
// Tuyệt đối không thử lại POST/PUT để tránh tạo đơn hoặc thu tiền hai lần.
// Không thử lại khi request đã timeout 15–30 giây, tránh dồn tải lên SQL Server.
async function requestReadWithRetry<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await requestOnce<T>(path, init);
  } catch (error) {
    if (!(error instanceof ApiError) ||
        (error.status !== 0 && ![502, 503, 504].includes(error.status)) ||
        /phản hồi quá chậm|đã bị hủy/i.test(error.message)) {
      throw error;
    }

    if (import.meta.env.DEV) {
      console.warn("[API retry] GET", path.split("?")[0], "after a transient error");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    return requestOnce<T>(path, init);
  }
}

async function requestOnce<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  const token = localStorage.getItem("express-token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");

  const method = (init?.method ?? "GET").toUpperCase();
  // On a cold local SQL Server, Operations GETs can take longer than 15s.
  // Shipment list also serves the Operations Orders page: give its initial
  // cold SQL Server request the same diagnostic window as Operations GETs.
  // This is a temporary guard; slow requests still require backend diagnosis.
  const slowerList = method === "GET" &&
    (path.startsWith("/operations/") || path === "/shipments");
  const timeoutMs = slowerList ? 30000 : 15000;
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
