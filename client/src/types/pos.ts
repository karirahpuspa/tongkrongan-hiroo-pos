export type UserRole = 'owner' | 'cashier';

export type MenuCategory = 'Kopi' | 'Non-Kopi' | 'Makanan' | 'Cemilan';

export type OrderStatus =
  | 'pending_payment'
  | 'processing'
  | 'completed'
  | 'cancelled';

export type PaymentMethod = 'cash' | 'qris';

export type PaymentStatus = 'pending' | 'paid' | 'failed';

export type ShiftStatus = 'open' | 'closed';

export interface User {
  id: string;
  role: UserRole;
  name: string;
  username: string;
  password: string;
  is_active: boolean;
  created_at: string;
}

export interface MenuItem {
  id: string;
  code: string;
  name: string;
  category: MenuCategory;
  price: number;
  serving_label: string;
  badge_text?: string;
  illustration_key: string;
  image_url: string | null;
  is_available: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  shift_code: string;
  cashier_id: string;
  cashier_name: string;
  business_date: string; // YYYY-MM-DD
  started_at: string; // ISO
  ended_at: string | null; // ISO
  opening_cash: number;
  expected_cash: number | null;
  actual_cash: number | null;
  difference: number | null;
  status: ShiftStatus;
  closed_by: string | null;
  closed_by_name: string | null;
  note: string;
}

export interface OrderItem {
  id: string;
  menu_id: string;
  menu_code: string;
  menu_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount_paid: number;
  change_amount: number;
  qris_account_number: string | null;
  qris_account_name: string | null;
  paid_at: string;
  sheet_synced_at: string | null;
}

export interface Order {
  id: string;
  order_number: string; // HRO-YYMMDD-001
  idempotency_key: string;
  shift_id: string;
  business_date: string; // YYYY-MM-DD (shift's business_date)
  cashier_id: string;
  cashier_name: string;
  customer_name: string;
  note: string; // Order-level note only (PRD v2.3)
  total: number;
  status: OrderStatus;
  cancel_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  payment: Payment | null;
}

export interface CartDraftItem {
  menu_id: string;
  quantity: number;
}
