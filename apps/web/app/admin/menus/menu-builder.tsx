'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AdminMenu, AdminMenuItem, MenuItemType } from '@cmstack-ts/config';
import { ChevronLeft, ChevronRight, GripVertical, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  createItem,
  deleteItem,
  deleteItemTranslation,
  saveStructure,
  updateItem,
  upsertItemTranslation,
} from './actions';

export type TargetOption = { id: string; label: string };
type Targets = Record<'POST' | 'PAGE' | 'CATEGORY', TargetOption[]>;
const TYPES: MenuItemType[] = ['CUSTOM', 'POST', 'PAGE', 'CATEGORY'];
const LOCALES = ['de', 'ru'] as const;

/** A menu item flattened into visual order with its nesting depth. */
type FlatItem = AdminMenuItem & { depth: number };

/** Flatten the nested admin tree into visual order, tracking depth. */
function flatten(items: AdminMenuItem[], depth = 0, out: FlatItem[] = []): FlatItem[] {
  for (const it of items) {
    out.push({ ...it, depth });
    if (it.children.length > 0) flatten(it.children, depth + 1, out);
  }
  return out;
}

/** Recompute depth of each row from its parentId chain (after a reorder/reparent). */
function withDepths(rows: FlatItem[]): FlatItem[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const depthOf = (r: FlatItem): number => {
    let d = 0;
    let cur = r.parentId;
    while (cur) {
      d += 1;
      cur = byId.get(cur)?.parentId ?? null;
    }
    return d;
  };
  return rows.map((r) => ({ ...r, depth: depthOf(r) }));
}

export function MenuBuilder({ menu, targets }: { menu: AdminMenu; targets: Targets }) {
  const [rows, setRows] = useState<FlatItem[]>(() => flatten(menu.items));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    // Dropping before `to`: adopt that row's parent (become its sibling).
    moved.parentId = rows[to]?.parentId ?? null;
    next.splice(to, 0, moved);
    setRows(withDepths(next));
  }

  function indent(i: number) {
    const row = rows[i];
    const prev = rows[i - 1];
    if (!row || !prev) return;
    // 2-level cap: a child can only nest under a root item.
    if (row.depth >= 1) return;
    const newParent = prev.depth === 0 ? prev.id : prev.parentId;
    if (!newParent) return;
    const next = rows.map((r) => (r.id === row.id ? { ...r, parentId: newParent } : r));
    setRows(withDepths(next));
  }

  function outdent(i: number) {
    const row = rows[i];
    if (!row || row.depth === 0) return;
    const parent = rows.find((r) => r.id === row.parentId);
    const next = rows.map((r) =>
      r.id === row.id ? { ...r, parentId: parent?.parentId ?? null } : r,
    );
    setRows(withDepths(next));
  }

  function save() {
    // order = position among siblings in visual order.
    const counters = new Map<string, number>();
    const nodes = rows.map((r) => {
      const key = r.parentId ?? '__root__';
      const order = counters.get(key) ?? 0;
      counters.set(key, order + 1);
      return { id: r.id, parentId: r.parentId, order };
    });
    startTransition(async () => {
      const res = await saveStructure(menu.id, { nodes });
      res.ok ? toast.success('Order saved') : toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Items</h2>
          <Button size="sm" onClick={save} disabled={isPending || rows.length === 0}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save order
          </Button>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items yet. Add one below.</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((row, i) => (
              <li
                key={row.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, i);
                  setDragIndex(null);
                }}
                style={{ marginLeft: row.depth * 24 }}
              >
                <ItemRow
                  menuId={menu.id}
                  item={row}
                  targets={targets}
                  canIndent={i > 0 && row.depth < 1}
                  canOutdent={row.depth > 0}
                  onIndent={() => indent(i)}
                  onOutdent={() => outdent(i)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddItemForm menuId={menu.id} targets={targets} />
    </div>
  );
}

function targetOptionsFor(type: MenuItemType, targets: Targets): TargetOption[] {
  return type === 'CUSTOM' ? [] : targets[type];
}

function ItemRow({
  menuId,
  item,
  targets,
  canIndent,
  canOutdent,
  onIndent,
  onOutdent,
}: {
  menuId: string;
  item: FlatItem;
  targets: Targets;
  canIndent: boolean;
  canOutdent: boolean;
  onIndent: () => void;
  onOutdent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await deleteItem(menuId, item.id);
      res.ok ? toast.success('Item deleted') : toast.error(res.error);
    });
  }

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center gap-2 px-3 py-2">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
        <span className="text-sm font-medium truncate">{item.label}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {item.type}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            disabled={!canOutdent}
            onClick={onOutdent}
            title="Outdent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={!canIndent}
            onClick={onIndent}
            title="Indent"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? 'Close' : 'Edit'}
          </Button>
          <Button size="icon" variant="ghost" onClick={remove} disabled={isPending} title="Delete">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border p-3 space-y-4">
          <ItemEditor menuId={menuId} item={item} targets={targets} />
          <TranslationEditor menuId={menuId} item={item} />
        </div>
      )}
    </div>
  );
}

function ItemEditor({
  menuId,
  item,
  targets,
}: { menuId: string; item: FlatItem; targets: Targets }) {
  const [type, setType] = useState<MenuItemType>(item.type);
  const [label, setLabel] = useState(item.label);
  const [targetId, setTargetId] = useState(item.targetId ?? '');
  const [url, setUrl] = useState(item.url ?? '');
  const [openInNewTab, setOpenInNewTab] = useState(item.openInNewTab);
  const [isPending, startTransition] = useTransition();

  function save() {
    const body =
      type === 'CUSTOM'
        ? { type, label, url, openInNewTab }
        : { type, label, targetId, openInNewTab };
    startTransition(async () => {
      const res = await updateItem(menuId, item.id, body);
      res.ok ? toast.success('Saved') : toast.error(res.error);
    });
  }

  const options = targetOptionsFor(type, targets);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as MenuItemType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>

      {type === 'CUSTOM' ? (
        <div className="space-y-1.5">
          <Label>URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/contact or https://…"
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Target</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">Select…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={openInNewTab}
          onChange={(e) => setOpenInNewTab(e.target.checked)}
        />
        Open in a new tab
      </label>

      <Button size="sm" onClick={save} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save item
      </Button>
    </div>
  );
}

function TranslationEditor({ menuId, item }: { menuId: string; item: FlatItem }) {
  const initial: Record<string, string> = {};
  for (const t of item.translations) initial[t.locale] = t.label ?? '';

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        Translations (label)
      </Label>
      <div className="grid gap-3 sm:grid-cols-2">
        {LOCALES.map((locale) => (
          <TranslationField
            key={locale}
            menuId={menuId}
            itemId={item.id}
            locale={locale}
            initial={initial[locale] ?? ''}
          />
        ))}
      </div>
    </div>
  );
}

function TranslationField({
  menuId,
  itemId,
  locale,
  initial,
}: {
  menuId: string;
  itemId: string;
  locale: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const trimmed = value.trim();
      const res = trimmed
        ? await upsertItemTranslation(menuId, itemId, locale, trimmed)
        : await deleteItemTranslation(menuId, itemId, locale);
      res.ok ? toast.success(`${locale.toUpperCase()} saved`) : toast.error(res.error);
    });
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{locale.toUpperCase()}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="(falls back)"
        />
        <Button size="sm" variant="outline" onClick={save} disabled={isPending}>
          Save
        </Button>
      </div>
    </div>
  );
}

function AddItemForm({ menuId, targets }: { menuId: string; targets: Targets }) {
  const [type, setType] = useState<MenuItemType>('CUSTOM');
  const [label, setLabel] = useState('');
  const [targetId, setTargetId] = useState('');
  const [url, setUrl] = useState('');
  const [isPending, startTransition] = useTransition();

  function add() {
    const body = type === 'CUSTOM' ? { type, label, url } : { type, label, targetId };
    startTransition(async () => {
      const res = await createItem(menuId, body);
      if (res.ok) {
        toast.success('Item added');
        setLabel('');
        setTargetId('');
        setUrl('');
      } else {
        toast.error(res.error);
      }
    });
  }

  const options = targetOptionsFor(type, targets);

  return (
    <section className="rounded-md border border-border p-4 space-y-3">
      <h2 className="text-sm font-semibold">Add item</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as MenuItemType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>
      {type === 'CUSTOM' ? (
        <div className="space-y-1.5">
          <Label>URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/contact or https://…"
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Target</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">Select…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <Button
        size="sm"
        onClick={add}
        disabled={isPending || !label || (type === 'CUSTOM' ? !url : !targetId)}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add item
      </Button>
    </section>
  );
}
