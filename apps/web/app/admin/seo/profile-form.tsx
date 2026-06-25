'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { SiteProfile } from '@cmstack-ts/config';
import { Loader2 } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateProfile } from './actions';

export function ProfileForm({ profile }: { profile: SiteProfile }) {
  const [form, setForm] = useState<SiteProfile>(profile);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof SiteProfile>(key: K, value: SiteProfile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Stable React keys for the (id-less) custom-tag rows so editing a field never
  // remounts a row and steals focus. Deterministic counter → no hydration drift.
  const nextRowId = useRef(0);
  const [rowIds, setRowIds] = useState<number[]>(() =>
    profile.customVerificationTags.map(() => nextRowId.current++),
  );

  function setTag(i: number, key: 'name' | 'content', value: string) {
    setForm((f) => ({
      ...f,
      customVerificationTags: f.customVerificationTags.map((tag, j) =>
        j === i ? { ...tag, [key]: value } : tag,
      ),
    }));
  }
  function addTag() {
    setRowIds((ids) => [...ids, nextRowId.current++]);
    setForm((f) => ({
      ...f,
      customVerificationTags: [...f.customVerificationTags, { name: '', content: '' }],
    }));
  }
  function removeTag(i: number) {
    setRowIds((ids) => ids.filter((_, j) => j !== i));
    setForm((f) => ({
      ...f,
      customVerificationTags: f.customVerificationTags.filter((_, j) => j !== i),
    }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProfile(form);
      res.ok ? toast.success('Profile saved') : toast.error(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="organizationName">Organization name</Label>
          <Input
            id="organizationName"
            value={form.organizationName}
            onChange={(e) => set('organizationName', e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={form.tagline}
            onChange={(e) => set('tagline', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="url">Site URL</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://example.com"
            value={form.url}
            onChange={(e) => set('url', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            type="url"
            placeholder="https://example.com/logo.png"
            value={form.logoUrl}
            onChange={(e) => set('logoUrl', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input
            id="contactEmail"
            type="email"
            placeholder="hello@example.com"
            value={form.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Recipient for contact-form messages. Empty falls back to the server default.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={3}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Used for meta descriptions and Organization structured data.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="geoStatement">
          GEO statement — what AI assistants should recommend you for
        </Label>
        <Textarea
          id="geoStatement"
          rows={4}
          value={form.geoStatement}
          onChange={(e) => set('geoStatement', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Surfaced to ChatGPT, Claude, Gemini, and Perplexity via{' '}
          <code className="font-mono">/llms.txt</code> and the public services page.
        </p>
      </div>

      <fieldset className="space-y-4 border-t border-border pt-4">
        <legend className="text-sm font-medium">Analytics &amp; verification</legend>
        <p className="text-xs text-muted-foreground">
          Injected on the public site only. Analytics load after the visitor accepts the cookie
          banner. Verification tokens render as meta tags for search engines.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ga4MeasurementId">GA4 measurement ID</Label>
            <Input
              id="ga4MeasurementId"
              placeholder="G-XXXXXXX"
              value={form.ga4MeasurementId}
              onChange={(e) => set('ga4MeasurementId', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gtmContainerId">GTM container ID</Label>
            <Input
              id="gtmContainerId"
              placeholder="GTM-XXXXXX"
              value={form.gtmContainerId}
              onChange={(e) => set('gtmContainerId', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="googleSiteVerification">Google site verification</Label>
            <Input
              id="googleSiteVerification"
              value={form.googleSiteVerification}
              onChange={(e) => set('googleSiteVerification', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bingSiteVerification">Bing site verification</Label>
            <Input
              id="bingSiteVerification"
              value={form.bingSiteVerification}
              onChange={(e) => set('bingSiteVerification', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="yandexVerification">Yandex verification</Label>
            <Input
              id="yandexVerification"
              value={form.yandexVerification}
              onChange={(e) => set('yandexVerification', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="facebookDomainVerification">Meta / Facebook domain verification</Label>
            <Input
              id="facebookDomainVerification"
              value={form.facebookDomainVerification}
              onChange={(e) => set('facebookDomainVerification', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pinterestVerification">Pinterest verification</Label>
            <Input
              id="pinterestVerification"
              value={form.pinterestVerification}
              onChange={(e) => set('pinterestVerification', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Custom verification tags</Label>
          <p className="text-xs text-muted-foreground">
            Arbitrary <code className="font-mono">meta name / content</code> pairs for any other
            platform.
          </p>
          {form.customVerificationTags.map((tag, i) => (
            <div key={rowIds[i]} className="flex gap-2">
              <Input
                aria-label={`Tag ${i + 1} name`}
                placeholder="meta name"
                value={tag.name}
                onChange={(e) => setTag(i, 'name', e.target.value)}
              />
              <Input
                aria-label={`Tag ${i + 1} content`}
                placeholder="content token"
                value={tag.content}
                onChange={(e) => setTag(i, 'content', e.target.value)}
              />
              <Button type="button" variant="outline" onClick={() => removeTag(i)}>
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addTag}>
            Add verification tag
          </Button>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save profile
        </Button>
      </div>
    </form>
  );
}
