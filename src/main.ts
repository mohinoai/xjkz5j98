import {
  createInkEntry, deleteInkEntry, filterInks, sortByNewest, updateInkEntry,
  validateInkInput, type Ink, type InkField, type InkInput,
} from './domain';
import { loadInks, saveInks } from './storage';
const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
};
const form = el<HTMLFormElement>('ink-form');
const composer = el('composer');
const nameInput = el<HTMLInputElement>('ink-name');
const brandInput = el<HTMLInputElement>('ink-brand');
const colorInput = el<HTMLInputElement>('ink-color');
const notesInput = el<HTMLTextAreaElement>('ink-notes');
const colorHex = el('color-hex');
const ratingInput = el('rating-input');
const cancelEdit = el<HTMLButtonElement>('cancel-edit');
const searchInput = el<HTMLInputElement>('search');
const grid = el('grid');
const emptyAll = el('empty-all');
const emptySearch = el('empty-search');
const resultCount = el('result-count');
const bannerWrite = el('banner-write');
const liveRegion = el('live-region');
const cardTemplate = el<HTMLTemplateElement>('card-template');
const FIELDS: InkField[] = ['name', 'brand', 'color', 'rating', 'notes'];
const errorOf = (field: InkField) => el(`error-${field}`);
const inputOf = (field: InkField) => (field === 'rating' ? ratingInput : el(`ink-${field}`));
const state: { inks: Ink[]; query: string; editingId: string | null } =
  { inks: [], query: '', editingId: null };
let armedButton: HTMLButtonElement | null = null;
let armedTimer: number | undefined;
let announceTimer: number | undefined;
let flushTimer: number | undefined;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const scrollToComposer = () => {
  composer.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  nameInput.focus();
};
function announce(message: string, delay = 0): void {
  window.clearTimeout(announceTimer);
  window.clearTimeout(flushTimer);
  announceTimer = window.setTimeout(() => {
    liveRegion.textContent = '';
    flushTimer = window.setTimeout(() => { liveRegion.textContent = message; }, 60);
  }, delay);
}
function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `ink-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
function persist(): void {
  const result = saveInks(state.inks);
  bannerWrite.hidden = result.ok;
  if (!result.ok) el('banner-write-message').textContent = result.message;
}
function readForm(): InkInput {
  const checked = form.querySelector<HTMLInputElement>('input[name="rating"]:checked');
  return {
    name: nameInput.value, brand: brandInput.value, color: colorInput.value,
    notes: notesInput.value, rating: checked ? Number(checked.value) : null,
  };
}
function paintNibs(container: HTMLElement, rating: number): void {
  container.querySelectorAll('.nib').forEach((nib, index) => nib.classList.toggle('on', index < rating));
}
function clearErrors(): void {
  for (const field of FIELDS) {
    errorOf(field).hidden = true;
    errorOf(field).textContent = '';
    inputOf(field).removeAttribute('aria-invalid');
  }
}
function showErrors(errors: Partial<Record<InkField, string>>): void {
  clearErrors();
  let firstInvalid: HTMLElement | null = null;
  let count = 0;
  for (const field of FIELDS) {
    const message = errors[field];
    if (!message) continue;
    count += 1;
    errorOf(field).textContent = message;
    errorOf(field).hidden = false;
    inputOf(field).setAttribute('aria-invalid', 'true');
    firstInvalid ??= field === 'rating'
      ? ratingInput.querySelector<HTMLInputElement>('input')
      : inputOf(field);
  }
  announce(`Form belum bisa disimpan. ${count} isian perlu diperbaiki.`);
  firstInvalid?.focus();
}
function setRating(value: number | null): void {
  for (const radio of form.querySelectorAll<HTMLInputElement>('input[name="rating"]')) {
    radio.checked = value !== null && Number(radio.value) === value;
  }
  paintNibs(ratingInput, value ?? 0);
}
const syncHex = () => { colorHex.textContent = colorInput.value.toLowerCase(); };
function enterEditMode(ink: Ink): void {
  state.editingId = ink.id;
  composer.dataset.editing = 'true';
  el('composer-title').textContent = `Edit: ${ink.name}`;
  el('composer-hint').textContent = 'Kamu sedang mengubah entri lama, bukan menambah entri baru.';
  el('submit-button').textContent = 'Simpan perubahan';
  cancelEdit.hidden = false;
  nameInput.value = ink.name;
  brandInput.value = ink.brand;
  colorInput.value = ink.color;
  notesInput.value = ink.notes;
  setRating(ink.rating);
  syncHex();
  clearErrors();
  render();
  scrollToComposer();
  announce(`Mode edit aktif untuk ${ink.name} dari ${ink.brand}.`, 250);
}
function exitEditMode(silent = false): void {
  const wasEditing = state.editingId !== null;
  state.editingId = null;
  composer.dataset.editing = 'false';
  el('composer-title').textContent = 'Catat tinta baru';
  el('composer-hint').textContent = 'Semua entri langsung tersimpan di browser ini.';
  el('submit-button').textContent = 'Simpan tinta';
  cancelEdit.hidden = true;
  form.reset();
  colorInput.value = '#0e5c68';
  setRating(null);
  syncHex();
  clearErrors();
  if (!wasEditing) return;
  render();
  if (!silent) announce('Mode edit dibatalkan. Form kembali ke mode tambah baru.');
}
function disarmDelete(): void {
  window.clearTimeout(armedTimer);
  if (armedButton) {
    armedButton.dataset.armed = 'false';
    armedButton.textContent = 'Hapus';
    armedButton.setAttribute('aria-label', `Hapus ${armedButton.dataset.inkName ?? 'entri'}`);
  }
  armedButton = null;
}
function armDelete(button: HTMLButtonElement, ink: Ink): void {
  disarmDelete();
  armedButton = button;
  button.dataset.armed = 'true';
  button.textContent = 'Yakin hapus?';
  button.setAttribute('aria-label', `Konfirmasi hapus ${ink.name}. Klik sekali lagi untuk menghapus.`);
  announce(`Klik sekali lagi untuk menghapus ${ink.name}.`);
  armedTimer = window.setTimeout(disarmDelete, 4500);
}
function removeInk(ink: Ink): void {
  disarmDelete();
  state.inks = deleteInkEntry(state.inks, ink.id);
  if (state.editingId === ink.id) exitEditMode(true);
  persist();
  render();
  announce(`${ink.name} dari ${ink.brand} dihapus dari jurnal.`);
}
function buildCard(ink: Ink): HTMLElement {
  const card = (cardTemplate.content.cloneNode(true) as DocumentFragment)
    .querySelector<HTMLElement>('.card');
  if (!card) throw new Error('Card template is malformed');
  const pick = (selector: string) => card.querySelector<HTMLElement>(selector)!;
  card.dataset.editing = String(state.editingId === ink.id);
  pick('.swatch').style.setProperty('--swatch', ink.color);
  // textContent everywhere: user strings are never parsed as HTML.
  pick('.card-name').textContent = ink.name;
  pick('.card-brand').textContent = ink.brand;
  pick('.card-hex').textContent = ink.color;
  const notes = pick('.card-notes');
  notes.textContent = ink.notes || 'Belum ada catatan.';
  notes.dataset.empty = String(ink.notes === '');
  const nibs = pick('.nibs');
  nibs.setAttribute('aria-label', `Rating ${ink.rating} dari 5 nib`);
  for (let i = 0; i < 5; i += 1) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    svg.setAttribute('class', i < ink.rating ? 'nib on' : 'nib');
    svg.setAttribute('aria-hidden', 'true');
    use.setAttribute('href', '#nib');
    svg.append(use);
    nibs.append(svg);
  }
  const editButton = pick('.action-edit');
  editButton.setAttribute('aria-label', `Edit ${ink.name}`);
  editButton.addEventListener('click', () => { disarmDelete(); enterEditMode(ink); });
  const deleteButton = pick('.action-delete') as HTMLButtonElement;
  deleteButton.dataset.inkName = ink.name;
  deleteButton.dataset.armed = 'false';
  deleteButton.setAttribute('aria-label', `Hapus ${ink.name}`);
  deleteButton.addEventListener('click', () => {
    if (deleteButton.dataset.armed === 'true') removeInk(ink);
    else armDelete(deleteButton, ink);
  });
  return card;
}
function render(): void {
  const visible = sortByNewest(filterInks(state.inks, state.query));
  const query = state.query.trim();
  grid.replaceChildren(...visible.map(buildCard));
  emptyAll.hidden = state.inks.length > 0;
  emptySearch.hidden = !(state.inks.length > 0 && visible.length === 0);
  if (!emptySearch.hidden) {
    el('empty-search-message').textContent = `Tidak ada tinta atau merek yang cocok dengan "${query}" di jurnalmu.`;
  }
  el('reset-search').hidden = query === '';
  resultCount.textContent = query
    ? `${visible.length} dari ${state.inks.length} tinta`
    : `${state.inks.length} tinta`;
}
function setQuery(value: string): void {
  disarmDelete();
  state.query = value;
  if (searchInput.value !== value) searchInput.value = value;
  render();
  const query = value.trim();
  if (!query) {
    announce(`Pencarian direset. Menampilkan ${state.inks.length} tinta.`, 350);
    return;
  }
  const count = filterInks(state.inks, query).length;
  announce(count === 0
    ? `Tidak ada hasil untuk "${query}".`
    : `${count} tinta cocok dengan "${query}".`, 350);
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = readForm();
  const result = validateInkInput(input);
  if (!result.ok) { showErrors(result.errors); return; }
  clearErrors();
  if (state.editingId) {
    state.inks = updateInkEntry(state.inks, state.editingId, result.value);
    exitEditMode(true);
    persist();
    render();
    announce(`${result.value.name} berhasil diperbarui.`);
    return;
  }
  const entry = createInkEntry(input, newId(), Date.now());
  if (!entry) return;
  state.inks = [...state.inks, entry];
  exitEditMode(true);
  persist();
  render();
  announce(`${entry.name} dari ${entry.brand} ditambahkan ke jurnal.`);
  nameInput.focus();
});
form.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !state.editingId) return;
  event.preventDefault();
  exitEditMode();
  nameInput.focus();
});
cancelEdit.addEventListener('click', () => { exitEditMode(); nameInput.focus(); });
colorInput.addEventListener('input', syncHex);
ratingInput.addEventListener('change', () => {
  const checked = form.querySelector<HTMLInputElement>('input[name="rating"]:checked');
  paintNibs(ratingInput, checked ? Number(checked.value) : 0);
  if (!checked) return;
  errorOf('rating').hidden = true;
  ratingInput.removeAttribute('aria-invalid');
});
searchInput.addEventListener('input', () => setQuery(searchInput.value));
for (const id of ['reset-search', 'reset-search-empty']) {
  el(id).addEventListener('click', () => { setQuery(''); searchInput.focus(); });
}
el('empty-cta').addEventListener('click', scrollToComposer);
document.addEventListener('click', (event) => {
  if (!armedButton) return;
  if (!(event.target instanceof Node) || !armedButton.contains(event.target)) disarmDelete();
});
const loaded = loadInks();
state.inks = loaded.inks;
if (loaded.status === 'corrupt') {
  el('banner-read-message').textContent = loaded.message;
  el('banner-read').hidden = false;
}
setRating(null);
syncHex();
render();
