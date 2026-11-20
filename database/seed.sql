USE tongkrongan_hiroo_pos;

INSERT INTO roles (name) VALUES ('owner'), ('cashier');

-- Akun pengguna (owner dan kasir) dibuat oleh `npm run seed` di folder server,
-- karena password harus di-hash bcrypt (jangan simpan password polos di SQL).

INSERT INTO menus (code, name, category, price, serving_label, is_available, is_active) VALUES
  ('KOP-01', 'Es Kopi Susu Hiroo', 'Kopi', 18000, 'Gelas 250 ml · Gula Aren', TRUE, TRUE),
  ('KOP-02', 'Americano Dingin', 'Kopi', 15000, 'Gelas 12 oz · Double Shot', TRUE, TRUE),
  ('KOP-03', 'Cafe Latte Hangat', 'Kopi', 20000, 'Cangkir 8 oz · Susu Segar', TRUE, TRUE),
  ('KOP-04', 'Kopi Tubruk Gula Aren', 'Kopi', 12000, 'Cangkir Klasik · Robusta', TRUE, TRUE),
  ('NON-01', 'Matcha Latte Hijau', 'Non-Kopi', 22000, 'Gelas 12 oz · Matcha Susu', TRUE, TRUE),
  ('NON-02', 'Es Lemon Tea Segar', 'Non-Kopi', 12000, 'Gelas 12 oz · Irisan Lemon', TRUE, TRUE),
  ('NON-03', 'Es Teh Manis', 'Non-Kopi', 8000, 'Gelas 12 oz · Teh Melati', TRUE, TRUE),
  ('NON-04', 'Air Mineral 600ml', 'Non-Kopi', 5000, 'Botol Dingin / Biasa', TRUE, TRUE),
  ('CEM-01', 'Pisang Goreng Aren', 'Cemilan', 15000, 'Isi 4 Pcs · Wijen & Aren', TRUE, TRUE),
  ('CEM-02', 'Kentang Goreng', 'Cemilan', 16000, 'Porsi Sharing · Saus Sambal', TRUE, TRUE),
  ('CEM-03', 'Roti Bakar Cokelat Keju', 'Cemilan', 18000, '2 Tangkup · Cokelat & Keju', TRUE, TRUE),
  ('MAK-01', 'Mie Goreng Spesial Hiroo', 'Makanan', 22000, 'Porsi Pas · Telur Mata Sapi', TRUE, TRUE),
  ('MAK-02', 'Nasi Ayam Katsu Sambal', 'Makanan', 25000, 'Nasi Hangat · Sambal Matah', TRUE, TRUE);
