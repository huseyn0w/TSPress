export interface RevisionView {
  id: string;
  authorId: string | null;
  snapshot: unknown;
  createdAt: string;
}

export interface RevisionField {
  key: string;
  label: string;
}

export interface FieldCompare {
  key: string;
  label: string;
  current: string;
  revision: string;
  changed: boolean;
}

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/** Compare current values against a revision snapshot, field by field. */
export function compareRevisionFields(
  current: Record<string, unknown>,
  snapshot: unknown,
  fields: RevisionField[],
): FieldCompare[] {
  const snap =
    snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>) : {};
  return fields.map(({ key, label }) => {
    const c = str(current[key]);
    const r = str(snap[key]);
    return { key, label, current: c, revision: r, changed: c !== r };
  });
}
