/**
 * Lapisan API frontend -> backend Express.
 * Semua pemanggilan ke server lewat sini (fetch + cookie httpOnly).
 * Format respons server: { success: true, data } atau { success: false, message }.
 * Dwi dan Ilham: tambahkan fungsi per modul di bagian bawah (lihat contoh).
 */

const BASE_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export interface ApiResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  status: number;
}

export interface ApiUser {
  id: number;
  name: string;
  username: string;
  role: 'owner' | 'cashier';
}

let unauthorizedHandler: (() => void) | null = null;

/** Dipanggil saat server membalas 401 (sesi habis) pada request selain login/me. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

export async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  options: { silent401?: boolean } = {}
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE_URL}/api${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json: { success?: boolean; data?: T; message?: string } = {};
    try {
      json = await res.json();
    } catch {
      // body kosong / bukan JSON
    }
    if (res.status === 401 && !options.silent401) unauthorizedHandler?.();
    return {
      success: res.ok && json.success !== false,
      message: json.message ?? (res.ok ? '' : `Permintaan gagal (${res.status}).`),
      data: json.data,
      status: res.status,
    };
  } catch {
    return {
      success: false,
      message: 'Tidak dapat terhubung ke server. Pastikan backend berjalan.',
      status: 0,
    };
  }
}

export const api = {
  get: <T = unknown>(path: string) => request<T>('GET', path),
  post: <T = unknown>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T = unknown>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T = unknown>(path: string) => request<T>('DELETE', path),
};

// ---- Auth (Karel) ----
export const authApi = {
  login: (username: string, password: string) =>
    request<ApiUser>('POST', '/auth/login', { username, password }, { silent401: true }),
  logout: () => request('POST', '/auth/logout', {}, { silent401: true }),
  me: () => request<ApiUser>('GET', '/auth/me', undefined, { silent401: true }),
};

// ---- Contoh untuk modul lain (hapus komentar saat endpoint sudah ada) ----
// Dwi:   export const orderApi = { list: () => api.get('/orders'), ... };
// Ilham: export const menuApi  = { list: () => api.get('/menus'), ... };
