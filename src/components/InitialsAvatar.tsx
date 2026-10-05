const COLORS = [
  'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-600', 'bg-emerald-500',
  'bg-teal-500', 'bg-sky-500', 'bg-indigo-500', 'bg-violet-500', 'bg-fuchsia-500'
];

const SIZES = {
  xs: 'w-8 h-8 text-sm',
  sm: 'w-10 h-10 text-base',
  md: 'w-12 h-12 text-xl',
  lg: 'w-14 h-14 text-2xl'
} as const;

function initialsOf(name: string): string {
  const parts = name.replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Round initials badge with a colour picked from the name, so people always get
 * the same colour. No network request (unlike an avatar service) and works offline.
 */
export default function InitialsAvatar({ name, size = 'md', className = '' }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={`flex-none inline-flex items-center justify-center rounded-full font-game text-white select-none ${COLORS[hash % COLORS.length]} ${SIZES[size]} ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}
