import React, { useMemo, useState } from 'react';
import { Edit3, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { usePos } from '../store/posStore';
import { MenuCategory, MenuItem } from '../types/pos';
import { formatRupiah } from '../utils/format';
import { MenuArtwork } from './MenuArtwork';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

export const OwnerMenuView: React.FC = () => {
  const {
    currentUser,
    menus,
    addMenu,
    updateMenu,
    toggleMenuAvailability,
    toggleMenuActive,
  } = usePos();

  const [filterCategory, setFilterCategory] = useState<'Semua' | MenuCategory>('Semua');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MenuCategory>('Kopi');
  const [priceInput, setPriceInput] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [badgeText, setBadgeText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const filteredMenus = useMemo(
    () =>
      menus.filter(
        (m) => filterCategory === 'Semua' || m.category === filterCategory
      ),
    [menus, filterCategory]
  );

  if (currentUser?.role !== 'owner') {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="hiroo-card p-6 text-center">
          <h2 className="text-lg font-extrabold text-[#991B1B]">Akses Ditolak</h2>
          <p className="text-xs text-[#5A554E] mt-1">
            Hanya Owner yang dapat mengelola daftar menu dan harga.
          </p>
        </div>
      </div>
    );
  }

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const openAddModal = () => {
    setEditingMenu(null);
    setCode('');
    setName('');
    setCategory('Kopi');
    setPriceInput('');
    setServingLabel('');
    setBadgeText('');
    setImageUrl(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (menu: MenuItem) => {
    setEditingMenu(menu);
    setCode(menu.code);
    setName(menu.name);
    setCategory(menu.category);
    setPriceInput(String(menu.price));
    setServingLabel(menu.serving_label);
    setBadgeText(menu.badge_text ?? '');
    setImageUrl(menu.image_url);
    setFormError(null);
    setModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setFormError('Format foto harus JPG, PNG, atau WEBP.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFormError('Ukuran foto maksimal 2 MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsedPrice = Number(priceInput);
    if (!name.trim()) {
      setFormError('Nama menu wajib diisi.');
      return;
    }
    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      setFormError('Harga menu harus lebih besar dari Rp 0.');
      return;
    }

    const payload = {
      code,
      name,
      category,
      price: parsedPrice,
      serving_label: servingLabel,
      badge_text: badgeText,
      image_url: imageUrl,
    };

    const res = editingMenu
      ? updateMenu(editingMenu.id, payload)
      : addMenu(payload);

    if (!res.success) {
      setFormError(res.message);
      return;
    }
    setModalOpen(false);
    showToast(res.message);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-3 sm:px-6 pb-10 space-y-5">
      <div className="hiroo-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#5A554E]">
            Panel Pengelolaan Owner
          </p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#141414]">
            Kelola Menu & Harga ({menus.length})
          </h1>
          <p className="text-xs text-[#5A554E] mt-0.5">
            Tambah/ubah menu, unggah foto (JPG/PNG/WEBP, maks 2 MB), atur ketersediaan & status aktif.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="hiroo-btn-dark rounded-full py-2.5 px-5 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Menu Baru</span>
        </button>
      </div>

      {toastMsg && (
        <div className="rounded-2xl border-[1.5px] border-[#141414] bg-[#F5E74B] px-4 py-2.5 text-xs font-bold text-[#141414]">
          {toastMsg}
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['Semua', 'Kopi', 'Non-Kopi', 'Makanan', 'Cemilan'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCategory(cat)}
            className={`whitespace-nowrap shrink-0 rounded-full border-[1.5px] border-[#141414] px-4 py-1.5 text-xs font-bold cursor-pointer ${
              filterCategory === cat
                ? 'bg-[#141414] text-white'
                : 'bg-[#FAF8F4] text-[#141414] hover:bg-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredMenus.map((menu) => (
          <article
            key={menu.id}
            className={`hiroo-card p-4 flex flex-col justify-between ${
              !menu.is_active ? 'opacity-65' : ''
            }`}
          >
            <div className="flex gap-3.5">
              <div className="w-24 h-24 rounded-xl border border-[#141414]/25 overflow-hidden shrink-0">
                <MenuArtwork menu={menu} className="w-full h-full" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-tabular text-[10px] font-bold text-[#5A554E]">
                    {menu.code} · {menu.category}
                  </span>
                  <span
                    className={`rounded-full border border-[#141414] px-2 py-0.5 font-mono-tabular text-[10px] font-bold ${
                      menu.is_active
                        ? 'bg-[#EEF6E4] text-[#365911]'
                        : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {menu.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-[#141414] mt-1 truncate">
                  {menu.name}
                </h3>
                <p className="font-mono-tabular text-base font-extrabold text-[#A3431B]">
                  {formatRupiah(menu.price)}
                </p>
                <p className="text-[11px] text-[#5A554E] truncate mt-0.5">
                  {menu.serving_label}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#141414]/15 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => openEditModal(menu)}
                className="rounded-full border border-[#141414] bg-white py-1.5 px-2.5 text-[11px] font-bold inline-flex items-center justify-center gap-1 hover:bg-zinc-100 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>Ubah</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = toggleMenuAvailability(menu.id);
                  showToast(res.message);
                }}
                className={`rounded-full border border-[#141414] py-1.5 px-2.5 text-[11px] font-bold cursor-pointer ${
                  menu.is_available
                    ? 'bg-[#F5E74B] text-[#141414]'
                    : 'bg-[#FDECEC] text-[#991B1B]'
                }`}
              >
                {menu.is_available ? 'Tersedia' : 'Habis'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = toggleMenuActive(menu.id);
                  showToast(res.message);
                }}
                className="rounded-full border border-[#141414] bg-white py-1.5 px-2.5 text-[11px] font-bold hover:bg-zinc-100 cursor-pointer"
              >
                {menu.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Add / Edit Menu Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg hiroo-card p-6 space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-[#141414]/15 pb-3">
              <h2 className="text-lg font-extrabold">
                {editingMenu ? `Ubah Menu: ${editingMenu.name}` : 'Tambah Menu Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-black/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">Nama Menu *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Misal: Es Kopi Susu Hiroo"
                  className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Kode Produk</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Otomatis jika kosong (KOP-05)"
                  className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs font-mono-tabular uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Kategori *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MenuCategory)}
                  className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs"
                >
                  <option value="Kopi">Kopi</option>
                  <option value="Non-Kopi">Non-Kopi</option>
                  <option value="Makanan">Makanan</option>
                  <option value="Cemilan">Cemilan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Harga (Rp) *</label>
                <input
                  type="number"
                  min={500}
                  step={500}
                  required
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="15000"
                  className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs font-mono-tabular font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Keterangan Sajian</label>
                <input
                  type="text"
                  value={servingLabel}
                  onChange={(e) => setServingLabel(e.target.value)}
                  placeholder="Misal: Gelas 250 ml · Dingin"
                  className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Label Sorotan (Opsional)</label>
                <input
                  type="text"
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  placeholder="Misal: Favorit / Baru"
                  className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs"
                />
              </div>
            </div>

            {/* Photo Upload with JPG/PNG/WEBP <= 2MB Validation */}
            <div className="rounded-2xl border border-dashed border-[#141414]/40 bg-white p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">
                  Foto Menu (JPG / PNG / WEBP · Maks 2 MB)
                </span>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C93B2B] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus Foto
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Pratinjau menu"
                    className="w-20 h-16 rounded-xl object-cover border border-[#141414]"
                  />
                ) : (
                  <div className="w-20 h-16 rounded-xl bg-[#EFE7DA] border border-[#141414]/25 flex items-center justify-center text-[10px] text-[#5A554E] text-center px-1">
                    Ilustrasi Default
                  </div>
                )}
                <label className="inline-flex items-center gap-2 rounded-full border border-[#141414] bg-[#FAF8F4] px-4 py-2 text-xs font-bold cursor-pointer hover:bg-zinc-100">
                  <ImagePlus className="w-4 h-4" />
                  <span>Pilih File Foto</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {formError && (
              <div className="rounded-xl border border-[#C93B2B] bg-[#FDECEC] px-3 py-2 text-xs font-semibold text-[#991B1B]">
                {formError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-full border border-[#141414] bg-white py-2.5 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 hiroo-btn-dark rounded-full py-2.5 text-xs font-bold cursor-pointer"
              >
                Simpan Menu
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
