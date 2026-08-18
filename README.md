# Ink Swatch Journal

Jurnal swatch tinta fountain pen. Single page, frontend only, data di `localStorage`.
Vanilla HTML + CSS + TypeScript via Vite. Tanpa framework, tanpa dependensi runtime.

```bash
npm install && npm run dev   # dev server
npm run build                # bundel statis ke dist/
npm test                     # unit test domain
```

`src/domain.ts` logika murni tanpa DOM dan tanpa storage, jadi bisa diuji tanpa mocking
global. `src/storage.ts` satu-satunya pintu ke `localStorage`, dengan sinyal berbeda
untuk gagal baca dan gagal tulis. Shell statis di `index.html`; JavaScript hanya
merender grid kartu dan toggle state.
