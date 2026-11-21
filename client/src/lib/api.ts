import { MenuItem, Order, Shift, User, UserRole } from '../types/pos';

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

// ---- Menus (Ilham) ----
export interface MenuInput {
  code?: string;
  name: string;
  category: 'Kopi' | 'Non-Kopi' | 'Makanan' | 'Cemilan';
  price: number;
  serving_label?: string;
  badge_text?: string;
  image_url?: string | null;
  is_available?: boolean;
  is_active?: boolean;
}

export const menuApi = {
  list: (all?: boolean) => api.get<MenuItem[]>(`/menus${all ? '?all=true' : ''}`),
  create: (data: MenuInput) => api.post<MenuItem>('/menus', data),
  update: (id: string | number, data: Partial<MenuInput>) =>
    api.put<MenuItem>(`/menus/${id}`, data),
  patch: (id: string | number, data: Partial<MenuInput>) =>
    api.patch<MenuItem>(`/menus/${id}`, data),
  toggleAvailable: (id: string | number, is_available: boolean) =>
    api.patch<MenuItem>(`/menus/${id}`, { is_available }),
  toggleActive: (id: string | number, is_active: boolean) =>
    api.patch<MenuItem>(`/menus/${id}`, { is_active }),
  delete: (id: string | number) => api.delete<{ message: string }>(`/menus/${id}`),
  uploadImage: async (file: File): Promise<ApiResult<{ url: string }>> => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${BASE_URL}/api/menus/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      let json: { success?: boolean; data?: { url: string }; message?: string } = {};
      try {
        json = await res.json();
      } catch {}
      return {
        success: res.ok && json.success !== false,
        message: json.message ?? (res.ok ? '' : `Upload gagal (${res.status}).`),
        data: json.data,
        status: res.status,
      };
    } catch {
      return {
        success: false,
        message: 'Tidak dapat mengunggah foto ke server.',
        status: 0,
      };
    }
  },
};

// ---- Users (Ilham) ----
export interface UserInput {
  name: string;
  username: string;
  role: UserRole;
  password?: string;
  is_active?: boolean;
}

export const userApi = {
  list: () => api.get<User[]>('/users'),
  create: (data: UserInput) => api.post<User>('/users', data),
  update: (id: string | number, data: Partial<UserInput>) =>
    api.put<User>(`/users/${id}`, data),
  patch: (id: string | number, data: Partial<UserInput>) =>
    api.patch<User>(`/users/${id}`, data),
  toggleActive: (id: string | number, is_active: boolean) =>
    api.patch<User>(`/users/${id}`, { is_active }),
  resetPassword: (id: string | number, newPassword: string) =>
    api.patch<{ message: string }>(`/users/${id}/reset-password`, { password: newPassword }),
  delete: (id: string | number) => api.delete<{ message: string }>(`/users/${id}`),
};

// ---- Reports & History (Ilham) ----
export interface SalesReportSummary {
  totalRevenue: number;
  totalCount: number;
  cashRevenue: number;
  cashCount: number;
  qrisRevenue: number;
  qrisCount: number;
  avgTransaction: number;
}

export interface TopMenuItem {
  menu_id: string;
  menu_name: string;
  category: string;
  qty: number;
  revenue: number;
}

export interface CashierSalesItem {
  cashier_id: string;
  cashier_name: string;
  txCount: number;
  cashTotal: number;
  qrisTotal: number;
  total: number;
}

export interface CategorySalesItem {
  category: string;
  qty: number;
  revenue: number;
}

export interface SalesReportResponse {
  summary: SalesReportSummary;
  topMenus: TopMenuItem[];
  perCashierSummary: CashierSalesItem[];
  perCategory: CategorySalesItem[];
  shifts: Shift[];
  paidOrders: Order[];
}

export interface HistoryFilterParams {
  startDate?: string;
  endDate?: string;
  status?: string;
  method?: string;
  search?: string;
  shiftId?: string;
}

export const reportApi = {
  getHistory: (params?: HistoryFilterParams) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.append('startDate', params.startDate);
    if (params?.endDate) sp.append('endDate', params.endDate);
    if (params?.status && params.status !== 'all') sp.append('status', params.status);
    if (params?.method && params.method !== 'all') sp.append('method', params.method);
    if (params?.search) sp.append('search', params.search);
    if (params?.shiftId) sp.append('shiftId', params.shiftId);
    const query = sp.toString() ? `?${sp.toString()}` : '';
    return api.get<Order[]>(`/reports/history${query}`);
  },
  getSalesReport: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.append('startDate', params.startDate);
    if (params?.endDate) sp.append('endDate', params.endDate);
    const query = sp.toString() ? `?${sp.toString()}` : '';
    return api.get<SalesReportResponse>(`/reports/sales${query}`);
  },
};

// ---- Contoh untuk modul lain (hapus komentar saat endpoint sudah ada) ----
// Dwi:   export const orderApi = { list: () => api.get('/orders'), ... };


