/* Pure domain logic: no DOM, no localStorage, no globals.
   Every function is deterministic given its arguments, so this module is
   unit-testable without mocking anything. */

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Ink {
  id: string; name: string; brand: string;
  color: string; notes: string; rating: Rating; createdAt: number;
}
export interface InkInput {
  name: string; brand: string; color: string; notes: string; rating: number | null;
}

export type InkFields = Omit<Ink, 'id' | 'createdAt'>;
export type InkField = keyof InkFields;
export type ValidationErrors = Partial<Record<InkField, string>>;
export type ValidationResult =
  | { ok: true; value: InkFields }
  | { ok: false; errors: ValidationErrors };

export const NAME_MAX = 80;
export const BRAND_MAX = 60;
export const NOTES_MAX = 600;

const HEX = /^#[0-9a-f]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value.trim().toLowerCase());
}

const tidy = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

const tidyNotes = (value: unknown): string =>
  typeof value === 'string'
    ? value.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    : '';

export function validateInkInput(input: InkInput): ValidationResult {
  const errors: ValidationErrors = {};
  const name = tidy(input?.name);
  const brand = tidy(input?.brand);
  const notes = tidyNotes(input?.notes);
  const color = typeof input?.color === 'string' ? input.color.trim().toLowerCase() : '';
  const rating = input?.rating;

  if (!name) errors.name = 'Nama tinta wajib diisi.';
  else if (name.length > NAME_MAX) errors.name = `Nama tinta maksimal ${NAME_MAX} karakter.`;
  if (!brand) errors.brand = 'Merek wajib diisi.';
  else if (brand.length > BRAND_MAX) errors.brand = `Merek maksimal ${BRAND_MAX} karakter.`;
  if (!isHexColor(color)) errors.color = 'Warna harus kode hex 6 digit, contoh #0e5c68.';
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.rating = 'Pilih rating 1 sampai 5 nib.';
  }
  if (notes.length > NOTES_MAX) errors.notes = `Catatan maksimal ${NOTES_MAX} karakter.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, brand, color, notes, rating: rating as Rating } };
}

/** Null when the input does not validate or the id is blank. Never throws. */
export function createInkEntry(input: InkInput, id: string, createdAt: number): Ink | null {
  if (typeof id !== 'string' || !id.trim()) return null;
  const result = validateInkInput(input);
  return result.ok ? { id: id.trim(), createdAt, ...result.value } : null;
}

/** Immutable. Returns the original array untouched when `id` is not found. */
export function updateInkEntry(inks: Ink[], id: string, fields: Partial<InkFields>): Ink[] {
  let found = false;
  const next = inks.map((ink) => {
    if (ink.id !== id) return ink;
    found = true;
    return { ...ink, ...fields };
  });
  return found ? next : inks;
}

/** Immutable. Returns the original array untouched when `id` is not found. */
export function deleteInkEntry(inks: Ink[], id: string): Ink[] {
  const next = inks.filter((ink) => ink.id !== id);
  return next.length === inks.length ? inks : next;
}

/** Matches brand (the primary filter) and ink name. */
export function filterInks(inks: Ink[], query: string): Ink[] {
  const needle = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (!needle) return inks;
  return inks.filter((ink) =>
    ink.brand.toLowerCase().includes(needle) || ink.name.toLowerCase().includes(needle));
}

export const sortByNewest = (inks: Ink[]): Ink[] =>
  [...inks].sort((a, b) => b.createdAt - a.createdAt);

export function uniqueBrands(inks: Ink[]): string[] {
  const seen = new Map<string, string>();
  for (const ink of inks) {
    const key = ink.brand.toLowerCase();
    if (!seen.has(key)) seen.set(key, ink.brand);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'id'));
}

/** Runs untrusted stored data through the exact same validation as fresh input. */
export function normalizeInk(raw: unknown, fallbackCreatedAt = 0): Ink | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  if (!id) return null;

  const str = (value: unknown) => (typeof value === 'string' ? value : '');
  const result = validateInkInput({
    name: str(record.name), brand: str(record.brand), color: str(record.color),
    notes: str(record.notes), rating: typeof record.rating === 'number' ? record.rating : null,
  });
  if (!result.ok) return null;

  const createdAt = typeof record.createdAt === 'number' && Number.isFinite(record.createdAt)
    ? record.createdAt : fallbackCreatedAt;
  return { id, createdAt, ...result.value };
}
