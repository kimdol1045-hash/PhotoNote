import { describe, expect, it } from 'vitest';
import {
  joinVersionedName,
  parseVersionedName,
  rootBaseName,
  sanitizeName,
} from '@/utils/filename';

describe('parseVersionedName', () => {
  it('returns null suffix for un-versioned name', () => {
    expect(parseVersionedName('photo')).toEqual({ base: 'photo', suffix: null });
  });

  it('parses simple -N suffix', () => {
    expect(parseVersionedName('photo-3')).toEqual({ base: 'photo', suffix: 3 });
  });

  it('keeps inner dashes in base', () => {
    expect(parseVersionedName('vacation-bali-2')).toEqual({
      base: 'vacation-bali',
      suffix: 2,
    });
  });

  it('does not match suffix-shaped names with letters', () => {
    expect(parseVersionedName('photo-abc')).toEqual({ base: 'photo-abc', suffix: null });
  });
});

describe('joinVersionedName', () => {
  it('returns base for version 0', () => {
    expect(joinVersionedName('photo', 0)).toBe('photo');
  });

  it('appends -N for non-zero', () => {
    expect(joinVersionedName('photo', 5)).toBe('photo-5');
  });
});

describe('rootBaseName', () => {
  it('strips trailing -N', () => {
    expect(rootBaseName('photo-2')).toBe('photo');
    expect(rootBaseName('a-b-c-9')).toBe('a-b-c');
  });

  it('returns name unchanged when not versioned', () => {
    expect(rootBaseName('plain')).toBe('plain');
  });
});

describe('sanitizeName', () => {
  it('strips filesystem-unsafe characters', () => {
    expect(sanitizeName('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
  });

  it('collapses whitespace', () => {
    expect(sanitizeName('  hello   world  ')).toBe('hello world');
  });

  it('limits to 60 chars', () => {
    const long = 'x'.repeat(80);
    expect(sanitizeName(long).length).toBe(60);
  });
});
