'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { localeLabel } from '@/lib/admin/translation-input';
import { DEFAULT_LOCALE, LOCALES } from '@cmstack-ts/config';

export const OVERRIDE_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

/**
 * Compact per-locale name inputs for a taxonomy term (Category/Tag). Admin UI is
 * English; each input falls back to the base name (shown as the placeholder) when
 * left blank. Value orchestration + saving is owned by the parent dialog.
 */
export function TermTranslationFields({
  values,
  onChange,
  basePlaceholder,
}: {
  values: Record<string, string>;
  onChange: (locale: string, value: string) => void;
  basePlaceholder: string;
}) {
  if (OVERRIDE_LOCALES.length === 0) return null;
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
        Name translations
      </p>
      {OVERRIDE_LOCALES.map((locale) => (
        <div key={locale} className="space-y-1.5">
          <Label htmlFor={`tr-name-${locale}`}>{localeLabel(locale)}</Label>
          <Input
            id={`tr-name-${locale}`}
            value={values[locale] ?? ''}
            onChange={(e) => onChange(locale, e.target.value)}
            placeholder={basePlaceholder || 'Falls back to the default language'}
          />
        </div>
      ))}
    </div>
  );
}
