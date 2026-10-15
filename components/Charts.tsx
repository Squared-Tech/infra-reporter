"use client";

// Charts are hand-drawn SVG and CSS bars rather than a chart library: the
// dashboard has to keep working on a council phone with two bars of signal, and
// a service worker that only caches what the app actually ships.

export type Slice = { label: string; value: number; color: string };

export function Donut({
  slices,
  centerLabel,
  size = 168,
  thickness = 24,
}: {
  slices: Slice[];
  centerLabel: string;
  size?: number;
  thickness?: number;
}) {
  const total = slices.reduce((n, s) => n + s.value, 0);
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const len = total ? (s.value / total) * circ : 0;
      const arc = { ...s, len, start: acc };
      acc += len;
      return arc;
    });

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`${total} ${centerLabel}`}
        className="shrink-0"
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8efe7" strokeWidth={thickness} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={thickness}
              strokeDasharray={`${a.len} ${circ - a.len}`}
              strokeDashoffset={-a.start}
            />
          ))}
        </g>
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          fontSize={size * 0.21}
          fontWeight={800}
          fill="#111111"
        >
          {total}
        </text>
        <text x="50%" y="61%" textAnchor="middle" fontSize={size * 0.075} fontWeight={600} fill="#6b7280">
          {centerLabel}
        </text>
      </svg>
      <ul className="min-w-[9rem] flex-1 space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 font-semibold text-gray-700">{s.label}</span>
            <span className="font-black text-zblack">{s.value}</span>
            <span className="w-9 text-right tabular-nums text-gray-500">
              {total ? `${Math.round((s.value / total) * 100)}%` : "0%"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Trend({
  points,
  labels,
  color = "#198a00",
}: {
  points: number[];
  labels: string[];
  color?: string;
}) {
  const W = 340;
  const H = 120;
  const P = { t: 12, r: 10, b: 22, l: 26 };
  const max = Math.max(1, ...points);
  const n = points.length;
  const x = (i: number) => (n <= 1 ? P.l : P.l + (i * (W - P.l - P.r)) / (n - 1));
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const line = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${H - P.b} L${x(0).toFixed(1)},${H - P.b} Z`;
  const every = Math.max(1, Math.ceil(n / 7));
  const marked = new Set<number>();
  for (let i = 0; i < n; i += every) marked.add(i);
  const lastMarked = Math.max(...marked);
  if (lastMarked !== n - 1) {
    // Never print two labels a day apart: drop the crowded one and keep today.
    if (n - 1 - lastMarked < every) marked.delete(lastMarked);
    marked.add(n - 1);
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Reports per day">
        <defs>
          <linearGradient id="fx-trend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={y(max * f)}
              y2={y(max * f)}
              stroke="#e8efe7"
              strokeWidth={1}
            />
            <text x={4} y={y(max * f) + 4} fontSize={9} fontWeight={700} fill="#9ca3af">
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#fx-trend)" />
        <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((v, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r={i === n - 1 ? 4 : 2.5}
            fill={i === n - 1 ? color : "#ffffff"}
            stroke={color}
            strokeWidth={1.8}
          />
        ))}
        {labels.map((l, i) =>
          marked.has(i) ? (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontSize={9}
              fontWeight={600}
              fill="#9ca3af"
            >
              {l}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

export function BarList({
  items,
  emptyText = "Nothing to measure yet.",
}: {
  items: { label: string; value: number; color?: string; emoji?: string; sub?: string }[];
  emptyText?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-6 text-center text-xs text-gray-500">{emptyText}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline gap-2 text-xs">
            <span className="flex-1 truncate font-semibold text-gray-700">
              {i.emoji && <span className="mr-1">{i.emoji}</span>}
              {i.label}
              {i.sub && <span className="ml-1 font-normal text-gray-400">{i.sub}</span>}
            </span>
            <span className="font-black tabular-nums text-zblack">{i.value}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${i.value > 0 ? Math.max(3, (i.value / max) * 100) : 0}%`,
                background: i.color ?? "#198a00",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
