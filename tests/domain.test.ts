import { describe, expect, it } from 'vitest';
import {
  createInkEntry, deleteInkEntry, filterInks, isHexColor, normalizeInk,
  uniqueBrands, updateInkEntry, validateInkInput, type Ink, type InkInput,
} from '../src/domain';

const input: InkInput = {
  name: 'Kon-peki', brand: 'Pilot Iroshizuku', color: '#1F4E9C',
  notes: '  Sheen merah kuat   di Tomoe River. ', rating: 5,
};
const ink = (over: Partial<Ink> = {}): Ink => ({
  id: 'a', name: 'Kon-peki', brand: 'Pilot Iroshizuku',
  color: '#1f4e9c', notes: '', rating: 5, createdAt: 1, ...over,
});

describe('isHexColor', () => {
  it('accepts 6 digit hex, rejects the rest', () => {
    expect(isHexColor('#0e5c68')).toBe(true);
    expect(isHexColor('#0E5C68')).toBe(true);
    for (const bad of ['#fff', '0e5c68', 'rgb(1,2,3)', null]) expect(isHexColor(bad)).toBe(false);
  });
});

describe('validateInkInput', () => {
  it('trims and normalizes a valid entry', () => {
    const result = validateInkInput(input);
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Kon-peki', brand: 'Pilot Iroshizuku', color: '#1f4e9c',
        notes: 'Sheen merah kuat di Tomoe River.', rating: 5,
      },
    });
  });

  it('rejects an empty or over-long name', () => {
    for (const name of ['   ', 'x'.repeat(81)]) {
      const result = validateInkInput({ ...input, name });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.name).toBeDefined();
    }
  });

  it('rejects an empty brand', () => {
    const result = validateInkInput({ ...input, brand: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.brand).toBeDefined();
  });

  it('rejects a rating outside 1 to 5, fractional, or missing', () => {
    for (const rating of [0, 6, -2, 3.5, null]) {
      const result = validateInkInput({ ...input, rating });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.rating).toBeDefined();
    }
  });

  it('rejects an invalid color', () => {
    const result = validateInkInput({ ...input, color: 'biru' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.color).toBeDefined();
  });

  it('reports every broken field at once', () => {
    const result = validateInkInput({ name: '', brand: '', color: '#ggg', notes: '', rating: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['brand', 'color', 'name', 'rating']);
  });
});

describe('createInkEntry', () => {
  it('builds an entry with the given id and timestamp', () => {
    expect(createInkEntry(input, 'ink-1', 1710000000000))
      .toMatchObject({ id: 'ink-1', createdAt: 1710000000000, color: '#1f4e9c' });
  });

  it('returns null for invalid input or a blank id', () => {
    expect(createInkEntry({ ...input, rating: null }, 'ink-1', 0)).toBeNull();
    expect(createInkEntry(input, '  ', 0)).toBeNull();
  });
});

describe('filterInks', () => {
  const inks = [
    ink({ id: 'a', name: 'Kon-peki', brand: 'Pilot Iroshizuku' }),
    ink({ id: 'b', name: 'Emerald of Chivor', brand: 'Diamine' }),
    ink({ id: 'c', name: 'Yama-budo', brand: 'Pilot Iroshizuku' }),
  ];

  it('matches on brand', () => expect(filterInks(inks, 'iroshizuku').map((i) => i.id)).toEqual(['a', 'c']));
  it('matches on ink name', () => expect(filterInks(inks, 'emerald').map((i) => i.id)).toEqual(['b']));
  it('returns nothing when no entry matches', () => expect(filterInks(inks, 'sailor')).toEqual([]));
  it('returns everything for a blank query', () => expect(filterInks(inks, '   ')).toHaveLength(3));
});

describe('updateInkEntry', () => {
  const inks = [ink({ id: 'a' }), ink({ id: 'b', name: 'Yama-budo', rating: 3 })];

  it('updates only the matching entry, without mutating', () => {
    const next = updateInkEntry(inks, 'b', { name: 'Yama-budo 2024', rating: 4 });
    expect(next[1]).toMatchObject({ id: 'b', name: 'Yama-budo 2024', rating: 4 });
    expect(next[0]).toBe(inks[0]);
    expect(inks[1].name).toBe('Yama-budo');
  });

  it('changes nothing when the id is unknown', () => {
    expect(updateInkEntry(inks, 'nope', { name: 'changed' })).toBe(inks);
  });
});

describe('deleteInkEntry', () => {
  const inks = [ink({ id: 'a' }), ink({ id: 'b' })];
  it('removes the matching entry', () => expect(deleteInkEntry(inks, 'a').map((i) => i.id)).toEqual(['b']));
  it('changes nothing when the id is unknown', () => expect(deleteInkEntry(inks, 'nope')).toBe(inks));
});

describe('normalizeInk', () => {
  it('recovers a well formed stored record', () => {
    expect(normalizeInk({
      id: 'a', name: ' Kon-peki ', brand: 'Pilot', color: '#1F4E9C',
      notes: 'ok', rating: 4, createdAt: 12,
    })).toEqual({
      id: 'a', name: 'Kon-peki', brand: 'Pilot', color: '#1f4e9c',
      notes: 'ok', rating: 4, createdAt: 12,
    });
  });

  it('rejects records missing an id or failing validation', () => {
    expect(normalizeInk({ name: 'x', brand: 'y', color: '#000000', rating: 3 })).toBeNull();
    expect(normalizeInk({ id: 'a', name: '', brand: 'y', color: '#000000', rating: 3 })).toBeNull();
    expect(normalizeInk('not an object')).toBeNull();
    expect(normalizeInk(null)).toBeNull();
  });

  it('falls back when createdAt is missing', () => {
    expect(normalizeInk({ id: 'a', name: 'n', brand: 'b', color: '#000000', rating: 1 }, 99))
      .toMatchObject({ createdAt: 99 });
  });
});

describe('uniqueBrands', () => {
  it('dedupes case-insensitively and sorts', () => {
    expect(uniqueBrands([
      ink({ id: 'a', brand: 'Sailor' }), ink({ id: 'b', brand: 'sailor' }), ink({ id: 'c', brand: 'Diamine' }),
    ])).toEqual(['Diamine', 'Sailor']);
  });
});
