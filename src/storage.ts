/* Only module touching localStorage. Read and write failures return distinct
   signals so the UI shows the right banner. */
import { normalizeInk, type Ink } from './domain';
const KEY = 'ink-swatch-journal.v1';
export type LoadResult =
  | { status: 'ok' | 'empty'; inks: Ink[] }
  | { status: 'corrupt'; inks: Ink[]; message: string };
export type SaveResult = { ok: true } | { ok: false; message: string };
const corrupt = (inks: Ink[], message: string): LoadResult => ({ status: 'corrupt', inks, message });
export function loadInks(): LoadResult {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return corrupt([], 'Penyimpanan browser tidak bisa dibaca, jadi jurnal lama tidak ikut dimuat.');
  }
  if (raw === null) return { status: 'empty', inks: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return corrupt([], 'Data jurnal ditemukan tapi formatnya rusak, jadi tidak ada entri lama yang dimuat.');
  }
  if (!Array.isArray(parsed)) {
    return corrupt([], 'Data jurnal ditemukan tapi bentuknya bukan daftar entri, jadi tidak bisa dimuat.');
  }
  const inks: Ink[] = [];
  let dropped = 0;
  for (const item of parsed) {
    const ink = normalizeInk(item, 0);
    if (ink) inks.push(ink);
    else dropped += 1;
  }
  if (dropped > 0) {
    return corrupt(inks, `${dropped} entri lama gagal dimuat karena datanya rusak. ${inks.length} entri lain berhasil dipulihkan.`);
  }
  return { status: 'ok', inks };
}
export function saveInks(inks: Ink[]): SaveResult {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(inks));
    return { ok: true };
  } catch (error) {
    const quotaFull = error instanceof DOMException
      && (error.name === 'QuotaExceededError'
        || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        || error.code === 22);
    return {
      ok: false,
      message: quotaFull
        ? 'Penyimpanan browser penuh. Perubahan tetap terlihat sekarang, tapi hilang saat halaman ditutup.'
        : 'Browser memblokir penyimpanan lokal, misalnya mode Incognito. Perubahan tetap terlihat sekarang, tapi hilang saat halaman ditutup.',
    };
  }
}
