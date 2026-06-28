# Task 3 — UI conformance to the canonical design system

**Canon (read-only):** `../DESIGN_SYSTEM.md`. Goal: the TS stack's public site + admin
render the one prescribed "quiet-luxury editorial" system so all three stacks are visually
indistinguishable, and hit **Lighthouse ≥95 mobile** (Perf/SEO/A11y/Best-Practices) +
**WCAG 2.1 AA — measured**.

## Direction (resolved by canon, not optional)
- **Default look = canon LIGHT** ("warm paper" `#FBFAF7`, garnet `--primary #B23A2E`).
  The pre-existing dark `editorial` theme becomes the canon **dark** variant; the canon
  light system is the base/default.
- **Fonts:** Newsreader (serif display + prose), Inter (UI/sans), Geist Mono (metadata).
  Self-hosted via `next/font` (build-time, no runtime CDN — satisfies §7).
- **Tokens are the contract.** Canon §2/§4/§6 become CSS custom properties once in
  `app/globals.css`; Tailwind v4 `@theme inline` bridges them to utilities. Existing
  shadcn-style admin utility names are re-pointed to canon tokens (no mass component churn).

## Increments (one commit each — rollback unit = one increment)
1. **Foundation — tokens + typography** (THIS increment). Canon color tokens (light `:root` +
   `.dark`), spacing/radius/motion/container tokens, Inter+Newsreader+Geist-Mono wiring, the
   `@theme` bridge (canon-named utilities + re-pointed legacy admin aliases), serif headings/
   prose. Admin re-skins to canon colors/fonts with zero component rewrites; public themes
   inherit the new fonts. Verify: build + e2e green + visual curl.
2. **Public themes → canon.** Re-skin `editorial` (canon dark) + `magazine`/default (canon
   light) palettes to §2; public header/footer/cards/prose/pagination/breadcrumbs to §5;
   `prefers-reduced-motion` per §6. Flip the seeded default to the canon light theme.
3. **Admin UI kit → §5 specs.** Buttons (variants/sizes/states), inputs/forms (focus/error/
   aria), cards, tables (+bulk bar), tabs (translation editor), breadcrumbs, dropdowns,
   avatars, badges, modals, toasts, alerts, pagination, empty states, dropzone, sortable list,
   rich-text toolbar. Each: states + a11y (focus-visible, names/roles, live regions).
4. **Admin shell.** Sidebar (260px, mono group labels, active left-bar) + topbar (56px,
   dark/light toggle, view-site, user menu) per §5; skip-to-content; landmarks.
5. **Measure.** Lighthouse CI (mobile) on public routes → ≥95 all four; fix the gaps (font
   preload/subset, JS/CSS budget, image srcset, CLS). Axe/manual WCAG AA pass. Record numbers.

## Invariants
- No behaviour change to Server Actions / data flow / auth gating — visual + a11y only.
- Public pages stay server-rendered, near-zero JS (islands only). Keep e2e green each step.
- `<JsonLd>` escaping, sanitization, token-never-on-client all untouched.
