import { cn } from "../lib/cn.js";

// Small SVG bar chart — sprint-14-domain-model.md question 3: the three
// chart needs of Analytics are covered without a charting dependency.
// Grouped or stacked bars over a category axis. The same data is exposed
// as a visually hidden table, so the figures are readable without the
// drawing (design-system.md accessibility baseline).

export type ChartTone =
  "primary" | "success" | "warning" | "destructive" | "muted";

const fill: Record<ChartTone, string> = {
  primary: "fill-primary",
  success: "fill-success",
  warning: "fill-warning",
  destructive: "fill-destructive",
  muted: "fill-muted-foreground/50",
};
const swatch: Record<ChartTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/50",
};

export interface BarChartSeries {
  key: string;
  label: string;
  tone: ChartTone;
}

export interface BarChartProps {
  /** Describes the chart for assistive technology and the hidden table. */
  title: string;
  categories: string[];
  series: BarChartSeries[];
  /** values[seriesKey][categoryIndex] */
  values: Record<string, number[]>;
  stacked?: boolean;
  height?: number;
  formatValue?: (value: number) => string;
  className?: string;
}

function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

export function BarChart({
  title,
  categories,
  series,
  values,
  stacked = false,
  height = 200,
  formatValue = (v) => String(v),
  className,
}: BarChartProps) {
  const width = 640;
  const pad = { top: 10, right: 8, bottom: 24, left: 36 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const valueAt = (key: string, i: number) => values[key]?.[i] ?? 0;
  const peak = Math.max(
    0,
    ...categories.map((_, i) =>
      stacked
        ? series.reduce((sum, s) => sum + valueAt(s.key, i), 0)
        : Math.max(...series.map((s) => valueAt(s.key, i))),
    ),
  );
  const max = niceMax(peak);
  const ticks = [0, max / 2, max];
  const slot = plotW / Math.max(categories.length, 1);
  const group = Math.min(slot * 0.7, 56);
  const barW = stacked ? group : group / series.length;
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  // Thin the category labels when there are many months.
  const labelEvery = Math.ceil(categories.length / 12);

  return (
    <figure className={cn("space-y-2", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title}
        className="h-auto w-full"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(t)}
              y2={y(t)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={pad.left - 6}
              y={y(t) + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {formatValue(t)}
            </text>
          </g>
        ))}
        {categories.map((category, i) => {
          const x0 = pad.left + slot * i + (slot - group) / 2;
          let stackTop = 0;
          return (
            <g key={category}>
              {series.map((s, si) => {
                const v = valueAt(s.key, i);
                if (v <= 0) return null;
                const h = (v / max) * plotH;
                const top = stacked ? y(stackTop + v) : y(v);
                if (stacked) stackTop += v;
                return (
                  <rect
                    key={s.key}
                    x={stacked ? x0 : x0 + barW * si}
                    y={top}
                    width={Math.max(barW - (stacked ? 0 : 2), 1)}
                    height={h}
                    rx={2}
                    className={fill[s.tone]}
                  >
                    <title>{`${category} · ${s.label}: ${formatValue(v)}`}</title>
                  </rect>
                );
              })}
              {i % labelEvery === 0 && (
                <text
                  x={pad.left + slot * i + slot / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {category}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn("size-2.5 rounded-sm", swatch[s.tone])}
            />
            {s.label}
          </span>
        ))}
      </figcaption>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Periodo</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category, i) => (
            <tr key={category}>
              <th scope="row">{category}</th>
              {series.map((s) => (
                <td key={s.key}>{formatValue(valueAt(s.key, i))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
