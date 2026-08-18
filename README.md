# Ink Swatch Journal

Jurnal swatch tinta fountain pen. Single page, frontend only, data di `localStorage`.
Vanilla HTML + CSS + TypeScript via Vite. Tanpa framework, tanpa dependensi runtime.

```bash
npm install && npm run dev   # dev server
npm run build                # bundel statis ke dist/
npm test                     # unit test domain
```

## Struktur

| Berkas | Tanggung jawab |
| --- | --- |
| `index.html` | Shell statis: skip link, header, form, search, empty state, banner, template kartu |
| `src/domain.ts` | Logika murni, tanpa DOM dan tanpa `localStorage` |
| `src/storage.ts` | Satu-satunya pintu ke `localStorage`. Gagal baca dan gagal tulis memberi sinyal berbeda |
| `src/main.ts` | Lapisan DOM: state, event, render grid |
| `src/styles.css` | Token, layout, tema terang dan gelap |
| `tests/domain.test.ts` | Unit test `src/domain.ts` |

Fungsi domain menerima data sebagai argumen, jadi bisa diuji tanpa mocking global.
`updateInkEntry` dan `deleteInkEntry` immutable dan mengembalikan array asli apa adanya
kalau id tidak ditemukan.

## Aksesibilitas

Skip link muncul saat Tab pertama. Landmark `header` / `main` / `section` dengan
`aria-labelledby`. Setiap input punya label terlihat, dan kode hex ditampilkan sebagai
teks supaya warna bukan satu-satunya pembawa informasi. Rating memakai radio group
berlabel "1 nib" sampai "5 nib" yang bisa dioperasikan keyboard. Error validasi tampil
inline dan terhubung lewat `aria-describedby` + `aria-invalid`. `#live-region`
mengumumkan tambah, edit, hapus, dan hasil pencarian. Semua animasi mati di bawah
`prefers-reduced-motion: reduce`.

## Keamanan

Nama, merek, dan catatan dirender lewat `textContent`, tidak pernah `innerHTML`.
Data dari `localStorage` lewat validasi yang sama persis dengan input baru
(`normalizeInk` memanggil `validateInkInput`); record yang tidak lolos dibuang dan
jumlahnya dilaporkan lewat banner.

## Desain

Palet dikunci: kertas gading, teks blue-black, satu aksen peacock teal. Radius:
permukaan 14px, kontrol 10px, pill penuh. Tema mengikuti `prefers-color-scheme` dan
bisa ditimpa lewat tombol di header (pilihan tersimpan di `localStorage`).
