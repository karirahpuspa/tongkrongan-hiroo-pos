export function formatRupiah(amount: number): string {
  const isNeg = amount < 0;
  const absVal = Math.abs(Math.round(amount));
  const formatted = new Intl.NumberFormat('id-ID').format(absVal);
  return `${isNeg ? '-' : ''}Rp ${formatted}`;
}

export function formatTimeWIB(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateID(dateStrOrIso: string): string {
  const d = dateStrOrIso.length === 10
    ? new Date(`${dateStrOrIso}T00:00:00`)
    : new Date(dateStrOrIso);
  if (Number.isNaN(d.getTime())) return dateStrOrIso;
  return d.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatShortDateID(dateStrOrIso: string): string {
  const d = dateStrOrIso.length === 10
    ? new Date(`${dateStrOrIso}T00:00:00`)
    : new Date(dateStrOrIso);
  if (Number.isNaN(d.getTime())) return dateStrOrIso;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getYesterdayDateStr(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentTimeInput(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function generateOrderNumber(
  businessDate: string,
  existingOrdersOnDate: number
): string {
  const [yyyy, mm, dd] = businessDate.split('-');
  const yy = (yyyy || '26').slice(-2);
  const seq = String(existingOrdersOnDate + 1).padStart(3, '0');
  return `HRO-${yy}${mm}${dd}-${seq}`;
}

export function elapsedMinutesLabel(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} mnt lalu`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}j ${rem}m lalu`;
}
