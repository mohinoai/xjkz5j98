import { describe, expect, it } from 'vitest';
import {
  deleteInkEntry, filterInks, isHexColor, normalizeInk, updateInkEntry,
  validateInkInput, type Ink, type InkInput,
} from '../src/domain';

const input: InkInput = {
  name: 'Kon-peki', brand: 'Pilot Iroshizuku', color: '#1F4E9C',
  notes: '  Sheen merah kuat   di Tomoe River. ', rating: 5,
};
const ink = (over: Partial<Ink> = {}): Ink => ({
  id: 'a', name: 'Kon-peki', brand: 'Pilot Iroshizuku',
  color: '#1f4e9c', notes: '', rating: 5, createdAt: 1, ...over,
});
const fails = (over: Partial<InkInput>, field: 'name' | 'brand' | 'color' | 'rating') => {
  const result = validateInkInput({ ...input, ...over });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors[field]).toBeDefined();
};

describe('validateInkInput', () => {
  it('trims and normalizes a valid entry', () => {
    expect(validateInkInput(input)).toEqual({
      ok: true,
      value: {
        name: 'Kon-peki', brand: 'Pilot Iroshizuku', color: '#1f4e9c',
        notes: 'Sheen merah kuat di Tomoe River.', rating: 5,
      },
    });
  });
  it('rejects an empty or over-long name', () => {
    for (const name of ['   ', 'x'.repeat(81)]) fails({ name }, 'name');
  });
  it('rejects an empty brand', () => fails({ brand: '' }, 'brand'));
  it('rejects an invalid color', () => {
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor('#0E5C68')).toBe(true);
    fails({ color: 'biru' }, 'color');
  });
  it('rejects a rating outside 1 to 5, fractional, or missing', () => {
    for (const rating of [0, 6, -2, 3.5, null]) fails({ rating }, 'rating');
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

describe('updateInkEntry and deleteInkEntry', () => {
  const inks = [ink({ id: 'a' }), ink({ id: 'b', name: 'Yama-budo', rating: 3 })];
  it('updates only the matching entry, without mutating', () => {
    const next = updateInkEntry(inks, 'b', { name: 'Yama-budo 2024', rating: 4 });
    expect(next[1]).toMatchObject({ id: 'b', name: 'Yama-budo 2024', rating: 4 });
    expect(next[0]).toBe(inks[0]);
    expect(inks[1].name).toBe('Yama-budo');
  });
  it('changes nothing when the id is unknown', () => {
    expect(updateInkEntry(inks, 'nope', { name: 'changed' })).toBe(inks);
    expect(deleteInkEntry(inks, 'nope')).toBe(inks);
  });
  it('removes the matching entry', () => expect(deleteInkEntry(inks, 'a').map((i) => i.id)).toEqual(['b']));
});

describe('normalizeInk', () => {
  it('accepts a valid stored record and rejects a broken one', () => {
    expect(normalizeInk({ id: 'a', name: ' N ', brand: 'B', color: '#1F4E9C', notes: '', rating: 4, createdAt: 12 }))
      .toEqual({ id: 'a', name: 'N', brand: 'B', color: '#1f4e9c', notes: '', rating: 4, createdAt: 12 });
    expect(normalizeInk({ name: 'x', brand: 'y', color: '#000000', rating: 3 })).toBeNull();
    expect(normalizeInk({ id: 'a', name: '', brand: 'y', color: '#000000', rating: 3 })).toBeNull();
    expect(normalizeInk('not an object')).toBeNull();
  });
});
