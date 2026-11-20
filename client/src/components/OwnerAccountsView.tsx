import React, { useState } from 'react';
import { Edit3, KeyRound, Plus, UserCheck, UserX, X } from 'lucide-react';
import { usePos } from '../store/posStore';
import { User, UserRole } from '../types/pos';
import { formatDateID } from '../utils/format';

export const OwnerAccountsView: React.FC = () => {
  const {
    currentUser,
    users,
    addUser,
    updateUser,
    toggleUserActive,
    resetUserPassword,
  } = usePos();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPass, setNewPass] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (currentUser?.role !== 'owner') {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="hiroo-card p-6 text-center">
          <h2 className="text-lg font-extrabold text-[#991B1B]">Akses Ditolak</h2>
          <p className="text-xs text-[#5A554E] mt-1">
            Hanya Owner yang dapat mengelola akun pengguna.
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

  const openAdd = () => {
    setEditingUser(null);
    setName('');
    setUsername('');
    setRole('cashier');
    setPassword('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setName(u.name);
    setUsername(u.username);
    setRole(u.role);
    setPassword('');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const res = editingUser
      ? updateUser(editingUser.id, { name, username, role })
      : addUser({ name, username, role, password });

    if (!res.success) {
      setFormError(res.message);
      return;
    }
    setModalOpen(false);
    showToast(res.message);
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError(null);
    const res = resetUserPassword(resetTarget.id, newPass);
    if (!res.success) {
      setResetError(res.message);
      return;
    }
    setResetTarget(null);
    setNewPass('');
    showToast(res.message);
  };

  return (
    <div className="mx-auto max-w-[1200px] px-3 sm:px-6 pb-10 space-y-5">
      <div className="hiroo-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#5A554E]">
            Manajemen Akses Pengguna
          </p>
          <h1 className="text-xl sm:text-2xl font-extrabold">
            Kelola Akun ({users.length})
          </h1>
          <p className="text-xs text-[#5A554E] mt-0.5">
            Tambah kasir/owner baru, nonaktifkan akun staf yang tidak bertugas, atau reset kata sandi.
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="hiroo-btn-dark rounded-full py-2.5 px-5 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Akun</span>
        </button>
      </div>

      {toastMsg && (
        <div className="rounded-2xl border-[1.5px] border-[#141414] bg-[#F5E74B] px-4 py-2.5 text-xs font-bold">
          {toastMsg}
        </div>
      )}

      <div className="hiroo-card p-5 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-[#141414]/20 font-mono-tabular text-[#5A554E]">
              <th className="py-2.5 pr-4">Nama Lengkap</th>
              <th className="py-2.5 pr-4">Username</th>
              <th className="py-2.5 pr-4">Peran (Role)</th>
              <th className="py-2.5 pr-4">Status</th>
              <th className="py-2.5 pr-4">Dibuat</th>
              <th className="py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[#141414]/10">
                <td className="py-3 pr-4 font-bold">{u.name}</td>
                <td className="py-3 pr-4 font-mono-tabular">{u.username}</td>
                <td className="py-3 pr-4">
                  <span
                    className={`rounded-full border border-[#141414] px-2.5 py-0.5 font-mono-tabular text-[10px] font-bold uppercase ${
                      u.role === 'owner'
                        ? 'bg-[#CBBCE6] text-[#141414]'
                        : 'bg-[#F5E74B] text-[#141414]'
                    }`}
                  >
                    {u.role === 'owner' ? 'Owner' : 'Kasir'}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`font-mono-tabular font-bold ${
                      u.is_active ? 'text-[#365911]' : 'text-[#C93B2B]'
                    }`}
                  >
                    {u.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="py-3 pr-4 font-mono-tabular text-[#5A554E]">
                  {formatDateID(u.created_at)}
                </td>
                <td className="py-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="rounded-full border border-[#141414] bg-white px-2.5 py-1 text-[11px] font-bold inline-flex items-center gap-1 hover:bg-zinc-100 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Ubah</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetTarget(u);
                        setNewPass('');
                        setResetError(null);
                      }}
                      className="rounded-full border border-[#141414] bg-white px-2.5 py-1 text-[11px] font-bold inline-flex items-center gap-1 hover:bg-zinc-100 cursor-pointer"
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>Reset Sandi</span>
                    </button>
                    {u.id !== currentUser.id && (
                      <button
                        type="button"
                        onClick={() => {
                          const res = toggleUserActive(u.id);
                          showToast(res.message);
                        }}
                        className={`rounded-full border border-[#141414] px-2.5 py-1 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                          u.is_active
                            ? 'bg-[#FDECEC] text-[#991B1B]'
                            : 'bg-[#EEF6E4] text-[#365911]'
                        }`}
                      >
                        {u.is_active ? (
                          <>
                            <UserX className="w-3 h-3" />
                            <span>Nonaktifkan</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3 h-3" />
                            <span>Aktifkan</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit User Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md hiroo-card p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                {editingUser ? `Ubah Akun: ${editingUser.name}` : 'Tambah Akun Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-full hover:bg-black/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Nama Lengkap *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Username *</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Peran (Role) *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs"
              >
                <option value="cashier">Kasir</option>
                <option value="owner">Owner</option>
              </select>
            </div>

            {!editingUser && (
              <div>
                <label className="block text-xs font-bold mb-1">Password Awal *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs"
                />
              </div>
            )}

            {formError && (
              <p className="text-xs font-semibold text-[#C93B2B]">{formError}</p>
            )}

            <button
              type="submit"
              className="w-full hiroo-btn-dark rounded-full py-2.5 text-xs font-bold cursor-pointer"
            >
              Simpan Akun
            </button>
          </form>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleResetSubmit}
            className="w-full max-w-sm hiroo-card p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                Reset Kata Sandi: {resetTarget.username}
              </h3>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="p-1 rounded-full hover:bg-black/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">
                Kata Sandi Baru (min. 4 karakter)
              </label>
              <input
                type="password"
                required
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs"
              />
            </div>
            {resetError && (
              <p className="text-xs font-semibold text-[#C93B2B]">{resetError}</p>
            )}
            <button
              type="submit"
              className="w-full hiroo-btn-dark rounded-full py-2.5 text-xs font-bold cursor-pointer"
            >
              Simpan Kata Sandi Baru
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
