import { describe, expect, it } from 'vitest';
import { diffTermTranslations, seedTermTranslations } from './term-translations';

const LOCALES = ['de', 'ru'] as const;

describe('seedTermTranslations', () => {
  it('maps existing rows and defaults missing/null to empty', () => {
    expect(
      seedTermTranslations(
        [
          { locale: 'de', name: 'Anleitungen' },
          { locale: 'ru', name: null },
        ],
        LOCALES,
      ),
    ).toEqual({ de: 'Anleitungen', ru: '' });
  });

  it('defaults every locale to empty when there are no rows', () => {
    expect(seedTermTranslations([], LOCALES)).toEqual({ de: '', ru: '' });
  });
});

describe('diffTermTranslations', () => {
  it('upserts a newly filled locale and skips unchanged ones', () => {
    const ops = diffTermTranslations(
      { de: '', ru: 'Новости' },
      { de: 'Anleitungen', ru: 'Новости' },
      LOCALES,
    );
    expect(ops).toEqual([{ locale: 'de', action: 'upsert', name: 'Anleitungen' }]);
  });

  it('deletes a cleared locale that previously had a value', () => {
    const ops = diffTermTranslations({ de: 'Anleitungen' }, { de: '' }, ['de']);
    expect(ops).toEqual([{ locale: 'de', action: 'delete' }]);
  });

  it('empty→empty and whitespace-only→empty are no-ops', () => {
    expect(diffTermTranslations({ de: '' }, { de: '   ' }, ['de'])).toEqual([]);
  });

  it('trims before upserting', () => {
    expect(diffTermTranslations({ de: '' }, { de: '  X ' }, ['de'])).toEqual([
      { locale: 'de', action: 'upsert', name: 'X' },
    ]);
  });
});
