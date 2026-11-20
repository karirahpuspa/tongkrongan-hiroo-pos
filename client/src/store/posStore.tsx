import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  CartDraftItem,
  MenuCategory,
  MenuItem,
  Order,
  OrderItem,
  PaymentMethod,
  Shift,
  User,
  UserRole,
} from '../types/pos';
import {
  createInitialSeedShiftsAndOrders,
  SEED_MENUS,
  SEED_USERS,
} from '../data/seedData';
import { generateOrderNumber, getTodayDateStr } from '../utils/format';
import { ApiUser, authApi, setUnauthorizedHandler } from '../lib/api';

const STORAGE_KEY = 'th_pos_state_v23';

interface PersistedState {
  users: User[];
  menus: MenuItem[];
  shifts: Shift[];
  orders: Order[];
  currentUserId: string | null;
}

interface ActionResult<T = undefined> {
  success: boolean;
  message: string;
  data?: T;
}

interface StartShiftPayload {
  startTimeHHMM: string;
  openingCash: number;
}

interface CloseShiftPayload {
  shiftId: string;
  actualCash: number;
  note?: string;
}

interface CreateOrderPayload {
  customerName: string;
  note: string;
  items: CartDraftItem[];
  idempotencyKey: string;
}

interface PayOrderPayload {
  orderId: string;
  method: PaymentMethod;
  amountPaid?: number;
  qrisAccountNumber?: string;
  qrisAccountName?: string;
}

interface MenuInputPayload {
  code: string;
  name: string;
  category: MenuCategory;
  price: number;
  serving_label: string;
  badge_text?: string;
  image_url: string | null;
}

interface UserInputPayload {
  name: string;
  username: string;
  role: UserRole;
  password?: string;
}

interface PosContextValue {
  users: User[];
  menus: MenuItem[];
  shifts: Shift[];
  orders: Order[];
  currentUser: User | null;
  activeShift: Shift | null;

  /** true setelah pengecekan sesi ke server selesai (mencegah kilatan layar login). */
  authReady: boolean;
  login: (username: string, password: string) => Promise<ActionResult<User>>;
  logout: () => void;
  resetDemoData: () => void;

  startShift: (payload: StartShiftPayload) => ActionResult<Shift>;
  closeShift: (payload: CloseShiftPayload) => ActionResult<Shift>;
  getShiftCashSummary: (shiftId: string) => {
    openingCash: number;
    cashSales: number;
    qrisSales: number;
    expectedCash: number;
    paidOrdersCount: number;
    cancelledCount: number;
  };

  createOrder: (payload: CreateOrderPayload) => ActionResult<Order>;
  updatePendingOrderItems: (
    orderId: string,
    payload: { customerName: string; note: string; items: CartDraftItem[] }
  ) => ActionResult<Order>;
  ownerCorrectOrder: (
    orderId: string,
    payload: { customerName: string; note: string; items: CartDraftItem[] }
  ) => ActionResult<Order>;
  payOrder: (payload: PayOrderPayload) => ActionResult<Order>;
  completeOrder: (orderId: string) => ActionResult<Order>;
  cancelOrder: (orderId: string, reason: string) => ActionResult<Order>;

  addMenu: (payload: MenuInputPayload) => ActionResult<MenuItem>;
  updateMenu: (menuId: string, payload: MenuInputPayload) => ActionResult<MenuItem>;
  toggleMenuAvailability: (menuId: string) => ActionResult<MenuItem>;
  toggleMenuActive: (menuId: string) => ActionResult<MenuItem>;

  addUser: (payload: UserInputPayload) => ActionResult<User>;
  updateUser: (userId: string, payload: Omit<UserInputPayload, 'password'>) => ActionResult<User>;
  toggleUserActive: (userId: string) => ActionResult<User>;
  resetUserPassword: (userId: string, newPassword: string) => ActionResult<User>;

  sanitizeOrderForViewer: (order: Order) => Order;
}

const PosContext = createContext<PosContextValue | null>(null);

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (
        Array.isArray(parsed.users) &&
        Array.isArray(parsed.menus) &&
        Array.isArray(parsed.shifts) &&
        Array.isArray(parsed.orders)
      ) {
        return parsed;
      }
    }
  } catch {
    // Fallback to fresh seed
  }
  const { shifts, orders } = createInitialSeedShiftsAndOrders();
  return {
    users: SEED_USERS,
    menus: SEED_MENUS,
    shifts,
    orders,
    currentUserId: null,
  };
}

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedState>(() => loadInitialState());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota issues gracefully
    }
  }, [state]);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? null,
    [state.users, state.currentUserId]
  );

  const activeShift = useMemo(
    () => state.shifts.find((s) => s.status === 'open') ?? null,
    [state.shifts]
  );

  // ---- Auth: sumber kebenaran = server (JWT cookie httpOnly) ----
  const [authReady, setAuthReady] = useState(false);

  const toStoreUser = (u: ApiUser): User => ({
    id: String(u.id),
    role: u.role,
    name: u.name,
    username: u.username,
    password: '', // password tidak pernah dikirim ke frontend
    is_active: true,
    created_at: new Date().toISOString(),
  });

  const applyServerUser = (apiUser: ApiUser): User => {
    const user = toStoreUser(apiUser);
    setState((prev) => ({
      ...prev,
      // Ganti akun tiruan dengan username sama agar currentUser berasal dari server
      users: [...prev.users.filter((u) => u.username.toLowerCase() !== user.username.toLowerCase()), user],
      currentUserId: user.id,
    }));
    return user;
  };

  const clearSession = () => setState((prev) => ({ ...prev, currentUserId: null }));

  // Pulihkan sesi saat halaman dibuka; sesi lama di localStorage tidak dipercaya.
  useEffect(() => {
    let cancelled = false;
    setUnauthorizedHandler(clearSession);
    authApi.me().then((res) => {
      if (cancelled) return;
      if (res.success && res.data) applyServerUser(res.data);
      else clearSession();
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username: string, password: string): Promise<ActionResult<User>> => {
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || !password) {
      return { success: false, message: 'Username dan kata sandi wajib diisi.' };
    }
    const res = await authApi.login(cleanUser, password);
    if (!res.success || !res.data) {
      return { success: false, message: res.message || 'Login gagal.' };
    }
    const user = applyServerUser(res.data);
    return { success: true, message: `Selamat datang, ${user.name}.`, data: user };
  };

  const logout = () => {
    void authApi.logout();
    clearSession();
  };

  const resetDemoData = () => {
    const { shifts, orders } = createInitialSeedShiftsAndOrders();
    const fresh: PersistedState = {
      users: SEED_USERS,
      menus: SEED_MENUS,
      shifts,
      orders,
      currentUserId: null,
    };
    setState(fresh);
  };

  const startShift = ({ startTimeHHMM, openingCash }: StartShiftPayload): ActionResult<Shift> => {
    if (!currentUser) {
      return { success: false, message: 'Sesi login tidak ditemukan.' };
    }
    if (activeShift) {
      return {
        success: false,
        message: `Masih ada shift aktif (${activeShift.shift_code} · ${activeShift.cashier_name}). Tutup shift terlebih dahulu.`,
      };
    }
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      return { success: false, message: 'Modal awal kas minimal Rp 0.' };
    }
    if (!/^\d{2}:\d{2}$/.test(startTimeHHMM)) {
      return { success: false, message: 'Format jam mulai tidak valid (JJ:MM).' };
    }

    const businessDate = getTodayDateStr();
    const startedAtIso = new Date(`${businessDate}T${startTimeHHMM}:00`).toISOString();
    const nextNum = state.shifts.length + 1;
    const newShift: Shift = {
      id: `shf-${Date.now()}`,
      shift_code: `SH-${String(nextNum).padStart(3, '0')}`,
      cashier_id: currentUser.id,
      cashier_name: currentUser.name,
      business_date: businessDate,
      started_at: startedAtIso,
      ended_at: null,
      opening_cash: Math.round(openingCash),
      expected_cash: null,
      actual_cash: null,
      difference: null,
      status: 'open',
      closed_by: null,
      closed_by_name: null,
      note: '',
    };

    setState((prev) => ({
      ...prev,
      shifts: [newShift, ...prev.shifts],
    }));

    return { success: true, message: 'Shift berhasil dimulai.', data: newShift };
  };

  const getShiftCashSummary = (shiftId: string) => {
    const shift = state.shifts.find((s) => s.id === shiftId);
    const openingCash = shift?.opening_cash ?? 0;
    const shiftOrders = state.orders.filter((o) => o.shift_id === shiftId);
    const paidOrders = shiftOrders.filter((o) => o.payment?.status === 'paid');
    const cashSales = paidOrders
      .filter((o) => o.payment?.method === 'cash')
      .reduce((acc, o) => acc + o.total, 0);
    const qrisSales = paidOrders
      .filter((o) => o.payment?.method === 'qris')
      .reduce((acc, o) => acc + o.total, 0);
    const cancelledCount = shiftOrders.filter((o) => o.status === 'cancelled').length;

    return {
      openingCash,
      cashSales,
      qrisSales,
      expectedCash: openingCash + cashSales,
      paidOrdersCount: paidOrders.length,
      cancelledCount,
    };
  };

  const closeShift = ({ shiftId, actualCash, note = '' }: CloseShiftPayload): ActionResult<Shift> => {
    if (!currentUser) {
      return { success: false, message: 'Sesi login tidak ditemukan.' };
    }
    const target = state.shifts.find((s) => s.id === shiftId);
    if (!target) {
      return { success: false, message: 'Shift tidak ditemukan.' };
    }
    if (target.status === 'closed') {
      return { success: false, message: 'Shift ini sudah ditutup sebelumnya.' };
    }
    if (!Number.isFinite(actualCash) || actualCash < 0) {
      return { success: false, message: 'Uang fisik kas wajib diisi (minimal Rp 0).' };
    }
    // Check if closing another cashier's shift -> only Owner allowed (FR-11)
    if (target.cashier_id !== currentUser.id && currentUser.role !== 'owner') {
      return {
        success: false,
        message: 'Hanya Owner yang dapat menutup paksa shift milik kasir lain.',
      };
    }
    if (target.cashier_id !== currentUser.id && currentUser.role === 'owner' && !note.trim()) {
      return {
        success: false,
        message: 'Catatan wajib diisi saat Owner menutup paksa shift kasir lain.',
      };
    }

    const summary = getShiftCashSummary(shiftId);
    const roundedActual = Math.round(actualCash);
    const diff = roundedActual - summary.expectedCash;

    const updatedShift: Shift = {
      ...target,
      ended_at: new Date().toISOString(),
      expected_cash: summary.expectedCash,
      actual_cash: roundedActual,
      difference: diff,
      status: 'closed',
      closed_by: currentUser.id,
      closed_by_name: currentUser.name,
      note: note.trim(),
    };

    setState((prev) => ({
      ...prev,
      shifts: prev.shifts.map((s) => (s.id === shiftId ? updatedShift : s)),
    }));

    return { success: true, message: 'Shift berhasil ditutup & kas direkonsiliasi.', data: updatedShift };
  };

  const buildAuthoritativeItems = (
    draftItems: CartDraftItem[]
  ): { ok: true; items: OrderItem[]; total: number } | { ok: false; message: string } => {
    if (!draftItems.length) {
      return { ok: false, message: 'Keranjang pesanan masih kosong.' };
    }
    const resolved: OrderItem[] = [];
    for (const draft of draftItems) {
      if (!Number.isInteger(draft.quantity) || draft.quantity <= 0) {
        return { ok: false, message: 'Jumlah item harus lebih dari 0.' };
      }
      const menu = state.menus.find((m) => m.id === draft.menu_id);
      if (!menu) {
        return { ok: false, message: 'Menu tidak ditemukan.' };
      }
      if (!menu.is_active || !menu.is_available) {
        return {
          success: false,
          ok: false,
          message: `Menu "${menu.name}" sedang habis atau nonaktif.`,
        } as { ok: false; message: string };
      }
      const unitPrice = menu.price; // Always server/menu authoritative price!
      resolved.push({
        id: `oi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        menu_id: menu.id,
        menu_code: menu.code,
        menu_name: menu.name,
        quantity: draft.quantity,
        unit_price: unitPrice,
        subtotal: unitPrice * draft.quantity,
      });
    }
    const total = resolved.reduce((acc, item) => acc + item.subtotal, 0);
    return { ok: true, items: resolved, total };
  };

  const createOrder = ({
    customerName,
    note,
    items,
    idempotencyKey,
  }: CreateOrderPayload): ActionResult<Order> => {
    if (!currentUser) {
      return { success: false, message: 'Silakan login terlebih dahulu.' };
    }
    if (!activeShift) {
      return {
        success: false,
        message: 'Tidak ada shift aktif. Mulai shift terlebih dahulu sebelum membuat pesanan.',
      };
    }
    // Prevent duplicate submission (FR-28)
    const duplicate = state.orders.find((o) => o.idempotency_key === idempotencyKey);
    if (duplicate) {
      return { success: true, message: 'Pesanan sudah tercatat.', data: duplicate };
    }
    const cleanCustomer = customerName.trim();
    if (!cleanCustomer) {
      return { success: false, message: 'Nama pelanggan wajib diisi.' };
    }
    const built = buildAuthoritativeItems(items);
    if (!built.ok) {
      return { success: false, message: built.message };
    }

    const businessDate = activeShift.business_date;
    const countOnDate = state.orders.filter((o) => o.business_date === businessDate).length;
    const orderNumber = generateOrderNumber(businessDate, countOnDate);
    const nowIso = new Date().toISOString();

    const newOrder: Order = {
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      order_number: orderNumber,
      idempotency_key: idempotencyKey,
      shift_id: activeShift.id,
      business_date: businessDate,
      cashier_id: currentUser.id,
      cashier_name: currentUser.name,
      customer_name: cleanCustomer,
      note: note.trim(),
      total: built.total,
      status: 'pending_payment',
      cancel_reason: null,
      cancelled_by: null,
      cancelled_at: null,
      created_at: nowIso,
      updated_at: nowIso,
      items: built.items,
      payment: null,
    };

    setState((prev) => ({
      ...prev,
      orders: [newOrder, ...prev.orders],
    }));

    return {
      success: true,
      message: `Pesanan ${orderNumber} dibuat (Menunggu Pembayaran).`,
      data: newOrder,
    };
  };

  const updatePendingOrderItems = (
    orderId: string,
    payload: { customerName: string; note: string; items: CartDraftItem[] }
  ): ActionResult<Order> => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, message: 'Pesanan tidak ditemukan.' };
    }
    if (order.status !== 'pending_payment') {
      return {
        success: false,
        message: 'Isi pesanan hanya dapat diubah saat status masih Menunggu Pembayaran.',
      };
    }
    const cleanCustomer = payload.customerName.trim();
    if (!cleanCustomer) {
      return { success: false, message: 'Nama pelanggan wajib diisi.' };
    }
    const built = buildAuthoritativeItems(payload.items);
    if (!built.ok) {
      return { success: false, message: built.message };
    }

    const updatedOrder: Order = {
      ...order,
      customer_name: cleanCustomer,
      note: payload.note.trim(),
      items: built.items,
      total: built.total,
      updated_at: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
    }));

    return {
      success: true,
      message: `Pesanan ${order.order_number} berhasil diperbarui.`,
      data: updatedOrder,
    };
  };

  const ownerCorrectOrder = (
    orderId: string,
    payload: { customerName: string; note: string; items: CartDraftItem[] }
  ): ActionResult<Order> => {
    if (!currentUser || currentUser.role !== 'owner') {
      return {
        success: false,
        message: 'Hanya Owner yang dapat mengoreksi pesanan setelah dibayar.',
      };
    }
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, message: 'Pesanan tidak ditemukan.' };
    }
    if (order.status === 'cancelled') {
      return { success: false, message: 'Pesanan yang dibatalkan tidak dapat dikoreksi.' };
    }
    const cleanCustomer = payload.customerName.trim();
    if (!cleanCustomer) {
      return { success: false, message: 'Nama pelanggan wajib diisi.' };
    }
    const built = buildAuthoritativeItems(payload.items);
    if (!built.ok) {
      return { success: false, message: built.message };
    }

    const updatedOrder: Order = {
      ...order,
      customer_name: cleanCustomer,
      note: payload.note.trim(),
      items: built.items,
      total: built.total,
      payment: order.payment
        ? {
            ...order.payment,
            amount_paid:
              order.payment.method === 'qris'
                ? built.total
                : Math.max(order.payment.amount_paid, built.total),
            change_amount:
              order.payment.method === 'cash'
                ? Math.max(0, order.payment.amount_paid - built.total)
                : 0,
          }
        : null,
      updated_at: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
    }));

    return {
      success: true,
      message: `Koreksi Owner pada ${order.order_number} tersimpan.`,
      data: updatedOrder,
    };
  };

  const payOrder = ({
    orderId,
    method,
    amountPaid,
    qrisAccountNumber,
    qrisAccountName,
  }: PayOrderPayload): ActionResult<Order> => {
    if (!currentUser) {
      return { success: false, message: 'Sesi login tidak ditemukan.' };
    }
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, message: 'Pesanan tidak ditemukan.' };
    }
    if (order.status !== 'pending_payment') {
      return {
        success: false,
        message: 'Pesanan ini sudah dibayar atau telah dibatalkan.',
      };
    }

    const nowIso = new Date().toISOString();

    if (method === 'cash') {
      const cashVal = Number(amountPaid);
      if (!Number.isFinite(cashVal) || cashVal < order.total) {
        return {
          success: false,
          message: 'Uang tunai yang diterima kurang dari total pembayaran.',
        };
      }
      const change = cashVal - order.total;
      const updatedOrder: Order = {
        ...order,
        status: 'processing',
        updated_at: nowIso,
        payment: {
          id: `pay-${Date.now()}`,
          method: 'cash',
          status: 'paid',
          amount_paid: Math.round(cashVal),
          change_amount: Math.round(change),
          qris_account_number: null,
          qris_account_name: null,
          paid_at: nowIso,
          sheet_synced_at: nowIso, // Async non-blocking sync in backend
        },
      };
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
      }));
      return {
        success: true,
        message: 'Pembayaran tunai berhasil dicatat.',
        data: updatedOrder,
      };
    }

    if (method === 'qris') {
      const accNum = (qrisAccountNumber ?? '').trim();
      const accName = (qrisAccountName ?? '').trim();
      if (!accNum || !accName) {
        return {
          success: false,
          message: 'Nomor rekening / e-wallet dan nama pemilik wajib diisi untuk QRIS.',
        };
      }
      const updatedOrder: Order = {
        ...order,
        status: 'processing',
        updated_at: nowIso,
        payment: {
          id: `pay-${Date.now()}`,
          method: 'qris',
          status: 'paid',
          amount_paid: order.total,
          change_amount: 0,
          qris_account_number: accNum,
          qris_account_name: accName,
          paid_at: nowIso,
          sheet_synced_at: nowIso,
        },
      };
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
      }));
      return {
        success: true,
        message: 'Pembayaran QRIS berhasil dicatat.',
        data: updatedOrder,
      };
    }

    return { success: false, message: 'Metode pembayaran wajib dipilih.' };
  };

  const completeOrder = (orderId: string): ActionResult<Order> => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, message: 'Pesanan tidak ditemukan.' };
    }
    if (order.status !== 'processing') {
      return {
        success: false,
        message: 'Hanya pesanan berstatus Diproses yang dapat ditandai selesai.',
      };
    }
    const updatedOrder: Order = {
      ...order,
      status: 'completed',
      updated_at: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
    }));
    return {
      success: true,
      message: `Pesanan ${order.order_number} selesai & telah diserahkan.`,
      data: updatedOrder,
    };
  };

  const cancelOrder = (orderId: string, reason: string): ActionResult<Order> => {
    if (!currentUser) {
      return { success: false, message: 'Sesi login tidak ditemukan.' };
    }
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, message: 'Pesanan tidak ditemukan.' };
    }
    if (order.status !== 'pending_payment') {
      return {
        success: false,
        message: 'Pembatalan hanya dapat dilakukan saat pesanan belum dibayar.',
      };
    }
    const cleanReason = reason.trim();
    if (!cleanReason) {
      return { success: false, message: 'Alasan pembatalan wajib diisi.' };
    }
    const nowIso = new Date().toISOString();
    const updatedOrder: Order = {
      ...order,
      status: 'cancelled',
      cancel_reason: cleanReason,
      cancelled_by: currentUser.name,
      cancelled_at: nowIso,
      updated_at: nowIso,
    };
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
    }));
    return {
      success: true,
      message: `Pesanan ${order.order_number} dibatalkan.`,
      data: updatedOrder,
    };
  };

  const addMenu = (payload: MenuInputPayload): ActionResult<MenuItem> => {
    if (!currentUser || currentUser.role !== 'owner') {
      return { success: false, message: 'Hanya Owner yang dapat menambah menu.' };
    }
    if (!payload.name.trim()) {
      return { success: false, message: 'Nama menu wajib diisi.' };
    }
    if (!Number.isFinite(payload.price) || payload.price <= 0) {
      return { success: false, message: 'Harga menu harus lebih dari Rp 0.' };
    }
    const nowIso = new Date().toISOString();
    const newMenu: MenuItem = {
      id: `mnu-${Date.now()}`,
      code:
        payload.code.trim().toUpperCase() ||
        `${payload.category.slice(0, 3).toUpperCase()}-${String(state.menus.length + 1).padStart(2, '0')}`,
      name: payload.name.trim(),
      category: payload.category,
      price: Math.round(payload.price),
      serving_label: payload.serving_label.trim() || 'Porsi Reguler',
      badge_text: payload.badge_text?.trim() || undefined,
      illustration_key:
        payload.category === 'Kopi'
          ? 'kopi_susu'
          : payload.category === 'Non-Kopi'
          ? 'lemon_tea'
          : payload.category === 'Cemilan'
          ? 'pisang_goreng'
          : 'mie_goreng',
      image_url: payload.image_url,
      is_available: true,
      is_active: true,
      created_at: nowIso,
      updated_at: nowIso,
    };
    setState((prev) => ({ ...prev, menus: [...prev.menus, newMenu] }));
    return { success: true, message: `Menu "${newMenu.name}" berhasil ditambahkan.`, data: newMenu };
  };

  const updateMenu = (menuId: string, payload: MenuInputPayload): ActionResult<MenuItem> => {
    if (!currentUser || currentUser.role !== 'owner') {
      return { success: false, message: 'Hanya Owner yang dapat mengubah menu.' };
    }
    const target = state.menus.find((m) => m.id === menuId);
    if (!target) {
      return { success: false, message: 'Menu tidak ditemukan.' };
    }
    if (!payload.name.trim()) {
      return { success: false, message: 'Nama menu wajib diisi.' };
    }
    if (!Number.isFinite(payload.price) || payload.price <= 0) {
      return { success: false, message: 'Harga menu harus lebih dari Rp 0.' };
    }
    const updated: MenuItem = {
      ...target,
      code: payload.code.trim().toUpperCase() || target.code,
      name: payload.name.trim(),
      category: payload.category,
      price: Math.round(payload.price),
      serving_label: payload.serving_label.trim() || target.serving_label,
      badge_text: payload.badge_text?.trim() || undefined,
      image_url: payload.image_url,
      updated_at: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      menus: prev.menus.map((m) => (m.id === menuId ? updated : m)),
    }));
    return { success: true, message: `Menu "${updated.name}" berhasil diperbarui.`, data: updated };
  };

  const toggleMenuAvailability = (menuId: string): ActionResult<MenuItem> => {
    const target = state.menus.find((m) => m.id === menuId);
    if (!target) return { success: false, message: 'Menu tidak ditemukan.' };
    const updated = {
      ...target,
      is_available: !target.is_available,
      updated_at: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      menus: prev.menus.map((m) => (m.id === menuId ? updated : m)),
    }));
    return {
      success: true,
      message: `${updated.name} ditandai ${updated.is_available ? 'Tersedia' : 'Habis'}.`,
      data: updated,
    };
  };

  const toggleMenuActive = (menuId: string): ActionResult<MenuItem> => {
    if (!currentUser || currentUser.role !== 'owner') {
      return { success: false, message: 'Hanya Owner yang dapat mengaktifkan/menonaktifkan menu.' };
    }
    const target = state.menus.find((m) => m.id === menuId);
    if (!target) return { success: false, message: 'Menu tidak ditemukan.' };
    const updated = {
      ...target,
      is_active: !target.is_active,
      updated_at: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      menus: prev.menus.map((m) => (m.id === menuId ? updated : m)),
    }));
    return {
      success: true,
      message: `${updated.name} ${updated.is_active ? 'diaktifkan' : 'dinonaktifkan'}.`,
      data: updated,
    };
  };

  const addUser = (payload: UserInputPayload): ActionResult<User> => {
    if (!currentUser || currentUser.role !== 'owner') {
      return { success: false, message: 'Akses ditolak.' };
    }
    const uname = payload.username.trim().toLowerCase();
    if (!payload.name.trim() || !uname || !payload.password) {
      return { success: false, message: 'Nama, username, dan password awal wajib diisi.' };
    }
    if (state.users.some((u) => u.username.toLowerCase() === uname)) {
      return { success: false, message: 'Username sudah dipakai. Gunakan username lain.' };
    }
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: payload.name.trim(),
      username: uname,
      role: payload.role,
      password: payload.password,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, users: [...prev.users, newUser] }));
    return { success: true, message: `Akun ${newUser.name} berhasil dibuat.`, data: newUser };
  };

  const updateUser = (
    userId: string,
    payload: Omit<UserInputPayload, 'password'>
  ): ActionResult<User> => {
    if (!currentUser || currentUser.role !== 'owner') {
      return { success: false, message: 'Akses ditolak.' };
    }
    const target = state.users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Akun tidak ditemukan.' };
    const uname = payload.username.trim().toLowerCase();
    if (!payload.name.trim() || !uname) {
      return { success: false, message: 'Nama dan username wajib diisi.' };
    }
    if (state.users.some((u) => u.id !== userId && u.username.toLowerCase() === uname)) {
      return { success: false, message: 'Username sudah digunakan akun lain.' };
    }
    const updated: User = {
      ...target,
      name: payload.name.trim(),
      username: uname,
      role: payload.role,
    };
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === userId ? updated : u)),
    }));
    return { success: true, message: `Data akun ${updated.name} diperbarui.`, data: updated };
  };

  const toggleUserActive = (userId: string): ActionResult<User> => {
    if (!currentUser || currentUser.role !== 'owner') {
      return { success: false, message: 'Akses ditolak.' };
    }
    if (userId === currentUser.id) {
      return { success: false, message: 'Anda tidak dapat menonaktifkan akun yang sedang dipakai.' };
    }
    const target = state.users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Akun tidak ditemukan.' };
    const updated = { ...target, is_active: !target.is_active };
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === userId ? updated : u)),
    }));
    return {
      success: true,
      message: `Akun ${updated.name} ${updated.is_active ? 'diaktifkan' : 'dinonaktifkan'}.`,
      data: updated,
    };
  };

  const resetUserPassword = (userId: string, newPassword: string): ActionResult<User> => {
    if (!currentUser || currentUser.role !== 'owner') {
      return { success: false, message: 'Akses ditolak.' };
    }
    if (newPassword.trim().length < 4) {
      return { success: false, message: 'Password baru minimal 4 karakter.' };
    }
    const target = state.users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Akun tidak ditemukan.' };
    const updated = { ...target, password: newPassword.trim() };
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === userId ? updated : u)),
    }));
    return {
      success: true,
      message: `Password akun ${updated.name} berhasil direset.`,
      data: updated,
    };
  };

  // FR-34: Cashier cannot see saved QRIS account number / owner name after saving
  const sanitizeOrderForViewer = (order: Order): Order => {
    if (currentUser?.role === 'owner') {
      return order;
    }
    if (!order.payment || order.payment.method !== 'qris') {
      return order;
    }
    return {
      ...order,
      payment: {
        ...order.payment,
        qris_account_number: null,
        qris_account_name: null,
      },
    };
  };

  return (
    <PosContext.Provider
      value={{
        users: state.users,
        menus: state.menus,
        shifts: state.shifts,
        orders: state.orders,
        currentUser,
        activeShift,
        authReady,
        login,
        logout,
        resetDemoData,
        startShift,
        closeShift,
        getShiftCashSummary,
        createOrder,
        updatePendingOrderItems,
        ownerCorrectOrder,
        payOrder,
        completeOrder,
        cancelOrder,
        addMenu,
        updateMenu,
        toggleMenuAvailability,
        toggleMenuActive,
        addUser,
        updateUser,
        toggleUserActive,
        resetUserPassword,
        sanitizeOrderForViewer,
      }}
    >
      {children}
    </PosContext.Provider>
  );
};

export function usePos(): PosContextValue {
  const ctx = useContext(PosContext);
  if (!ctx) {
    throw new Error('usePos must be used within PosProvider');
  }
  return ctx;
}
