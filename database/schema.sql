CREATE DATABASE IF NOT EXISTS tongkrongan_hiroo_pos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tongkrongan_hiroo_pos;

-- 1. roles
CREATE TABLE roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name ENUM('owner', 'cashier') NOT NULL UNIQUE
) ENGINE=InnoDB;

-- 2. users
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- 3. menus
CREATE TABLE menus (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(24) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  category ENUM('Kopi', 'Non-Kopi', 'Makanan', 'Cemilan') NOT NULL,
  price DECIMAL(12, 2) NOT NULL CHECK (price > 0),
  serving_label VARCHAR(120) NULL,
  image_url VARCHAR(500) NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. shifts
CREATE TABLE shifts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shift_code VARCHAR(30) NOT NULL UNIQUE,
  cashier_id INT UNSIGNED NOT NULL,
  business_date DATE NOT NULL,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  opening_cash DECIMAL(12, 2) NOT NULL DEFAULT 0,
  expected_cash DECIMAL(12, 2) NULL,
  actual_cash DECIMAL(12, 2) NULL,
  difference DECIMAL(12, 2) NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  closed_by INT UNSIGNED NULL,
  note TEXT NULL,
  INDEX idx_shifts_status (status),
  INDEX idx_shifts_business_date (business_date),
  CONSTRAINT fk_shifts_cashier FOREIGN KEY (cashier_id) REFERENCES users(id),
  CONSTRAINT fk_shifts_closed_by FOREIGN KEY (closed_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- 5. orders
CREATE TABLE orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(32) NOT NULL UNIQUE,
  idempotency_key VARCHAR(64) NOT NULL UNIQUE,
  shift_id INT UNSIGNED NOT NULL,
  business_date DATE NOT NULL,
  cashier_id INT UNSIGNED NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  note TEXT NULL,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status ENUM('pending_payment', 'processing', 'completed', 'cancelled') NOT NULL DEFAULT 'pending_payment',
  cancel_reason VARCHAR(255) NULL,
  cancelled_by INT UNSIGNED NULL,
  cancelled_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_business_date (business_date),
  INDEX idx_orders_status (status),
  CONSTRAINT fk_orders_shift FOREIGN KEY (shift_id) REFERENCES shifts(id),
  CONSTRAINT fk_orders_cashier FOREIGN KEY (cashier_id) REFERENCES users(id),
  CONSTRAINT fk_orders_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- 6. order_items (unit_price snapshot)
CREATE TABLE order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  menu_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12, 2) NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_menu FOREIGN KEY (menu_id) REFERENCES menus(id)
) ENGINE=InnoDB;

-- 7. payments (1 metode per pesanan; data QRIS dibatasi hanya untuk Owner di backend)
CREATE TABLE payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL UNIQUE,
  method ENUM('cash', 'qris') NOT NULL,
  status ENUM('pending', 'paid', 'failed') NOT NULL DEFAULT 'paid',
  amount_paid DECIMAL(12, 2) NOT NULL,
  change_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  qris_account_number VARCHAR(100) NULL,
  qris_account_name VARCHAR(120) NULL,
  paid_at DATETIME NOT NULL,
  sheet_synced_at DATETIME NULL,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB;
