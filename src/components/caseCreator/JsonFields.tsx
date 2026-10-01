import { Plus, Trash2, Lock } from 'lucide-react';

/**
 * Small generic editor so every generated field can be read, edited or deleted
 * without a hand-built form per section. Strings -> inputs, string[] -> one per line,
 * object[] -> collapsible cards with add/delete, nested objects -> grouped fields.
 * Keys named "secret" are styled as admin-only.
 */

const ENUMS: Record<string, string[]> = {
  state: ['knows', 'partial', 'hidden', 'believes_falsely', 'lying', 'unknown'],
  side: ['prosecution', 'defence'],
  classification: ['direct', 'circumstantial', 'corroborating', 'contradictory', 'ambiguous', 'misleading', 'background'],
  evidence_type: [
    'documents', 'photographs', 'images', 'video_recordings', 'audio_recordings', 'witness_testimony',
    'physical_evidence', 'digital_evidence', 'expert_reports', 'confessions_statements', 'timeline_logs', 'story',
  ],
  status: ['confirmed', 'disputed', 'uncertain'],
  visibility: ['public', 'discoverable', 'hidden'],
  truthfulness: ['truthful', 'mistaken', 'deceptive', 'withholding', 'mixed'],
  difficulty: ['easy', 'medium', 'hard'],
  discovery_difficulty: ['easy', 'medium', 'hard', 'expert'],
  level: ['easy', 'medium', 'hard', 'expert'],
  kind: ['image', 'photo', 'document', 'screenshot', 'none'],
  case_type: ['criminal', 'civil', 'burglary', 'fraud', 'assault', 'murder', 'theft', 'other'],
  benefits: ['prosecution', 'defence', 'neither', 'both'],
};
// "role" in evidence.secret.witnesses
const ROLE_ENUM = ['created', 'knows', 'authenticates', 'explains', 'challenges', 'contradicted_by', 'benefits'];
const NUMBER_KEYS = new Set(['age', 'estimated_minutes', 'min_players', 'max_players', 'importance']);
const LONG_KEYS = /text|description|content|testimony|background|summary|argument|statement|prompt|implications|interpretation|explanation|position|impact|proves|trigger|example/i;

const pretty = (k: string) => k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const inputCls =
  'w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500';

const blankLike = (v: any): any => {
  if (Array.isArray(v)) return [];
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blankLike(x)]));
  if (typeof v === 'number') return null;
  if (typeof v === 'boolean') return false;
  return '';
};

export const autoTitle = (item: any, i: number): string => {
  if (typeof item === 'string') return item || `Item ${i + 1}`;
  const head = [item.code ?? item.id, item.name ?? item.title ?? item.issue ?? item.type ?? item.fact_id ?? item.witness_code ?? item.when ?? item.level]
    .filter(Boolean)
    .join(' · ');
  const tail = item.role ?? item.side ?? item.state ?? '';
  const body =
    head ||
    String(item.text ?? item.description ?? item.discovery ?? item.event ?? item.statement_a ?? item.core_claim ?? '').slice(0, 70);
  return [body, tail].filter(Boolean).join(' — ') || `Item ${i + 1}`;
};

interface FieldProps {
  name: string;
  value: any;
  onChange: (v: any) => void;
  blank?: (path: string) => any;
  path?: string;
}

export function Field({ name, value, onChange, blank, path = name }: FieldProps) {
  const label = pretty(name);

  if (name === 'secret' && value && typeof value === 'object') {
    return (
      <div className="border border-amber-700/50 bg-amber-900/10 rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wide">
          <Lock className="w-3.5 h-3.5" /> Admin-only (hidden from players)
        </div>
        <Fields value={value} onChange={onChange} blank={blank} path={path} />
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    );
  }

  const enumVals = name === 'role' && path.includes('witnesses') && path.includes('secret') ? ROLE_ENUM : ENUMS[name];
  if (enumVals && (typeof value === 'string' || value == null)) {
    const opts = value && !enumVals.includes(value) ? [value, ...enumVals] : enumVals;
    return (
      <Labeled label={label}>
        <select className={inputCls} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Labeled>
    );
  }

  if (NUMBER_KEYS.has(name) || typeof value === 'number') {
    return (
      <Labeled label={label}>
        <input
          type="number" className={inputCls} value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      </Labeled>
    );
  }

  if (Array.isArray(value)) {
    if (value.every((x) => typeof x === 'string')) {
      return (
        <Labeled label={`${label} (one per line)`}>
          <textarea
            className={inputCls} rows={Math.min(8, Math.max(2, value.length + 1))}
            value={value.join('\n')}
            onChange={(e) => onChange(e.target.value.split('\n'))}
            onBlur={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
          />
        </Labeled>
      );
    }
    return <ListEditor label={label} items={value} onChange={onChange} blank={() => blank?.(path) ?? blankLike(value[0] ?? {})} path={path} rootBlank={blank} />;
  }

  if (value && typeof value === 'object') {
    return (
      <fieldset className="border border-slate-700 rounded-lg p-3 space-y-3">
        <legend className="px-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</legend>
        <Fields value={value} onChange={onChange} blank={blank} path={path} />
      </fieldset>
    );
  }

  const str = value ?? '';
  const long = typeof str === 'string' && (str.length > 70 || str.includes('\n') || LONG_KEYS.test(name));
  return (
    <Labeled label={label}>
      {long ? (
        <textarea className={inputCls} rows={Math.min(10, Math.max(3, Math.ceil(String(str).length / 70)))} value={str} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={inputCls} value={str} onChange={(e) => onChange(e.target.value)} />
      )}
    </Labeled>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function Fields({ value, onChange, blank, path = '' }: { value: Record<string, any>; onChange: (v: any) => void; blank?: (path: string) => any; path?: string }) {
  return (
    <div className="space-y-3">
      {Object.entries(value ?? {}).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
        <Field
          key={k} name={k} value={v} blank={blank} path={path ? `${path}.${k}` : k}
          onChange={(nv) => onChange({ ...value, [k]: nv })}
        />
      ))}
    </div>
  );
}

interface ListProps {
  label: string;
  items: any[];
  onChange: (items: any[]) => void;
  blank: () => any;
  title?: (item: any, i: number) => string;
  path?: string;
  rootBlank?: (path: string) => any;
  defaultOpen?: boolean;
}

export function ListEditor({ label, items, onChange, blank, title = autoTitle, path = '', rootBlank, defaultOpen }: ListProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200">{label} <span className="text-slate-500">({items.length})</span></span>
        <button
          type="button" onClick={() => onChange([...items, blank()])}
          className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      {items.length === 0 && <p className="text-xs text-slate-500 italic">Nothing here yet.</p>}
      {items.map((item, i) => (
        <details key={i} open={defaultOpen} className="bg-slate-800/60 border border-slate-700 rounded-lg group">
          <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer text-sm text-white list-none">
            <span className="truncate">{title(item, i)}</span>
            <button
              type="button" title="Delete"
              onClick={(e) => { e.preventDefault(); if (confirm('Delete this item?')) onChange(items.filter((_, j) => j !== i)); }}
              className="text-red-400 hover:text-red-300 p-1 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </summary>
          <div className="px-3 pb-3 pt-1">
            {typeof item === 'object' ? (
              <Fields
                value={item} blank={rootBlank} path={path}
                onChange={(nv) => onChange(items.map((x, j) => (j === i ? nv : x)))}
              />
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}
