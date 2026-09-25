import { useMemo } from 'react';

// Heatmap estilo GitHub con la grilla fluida de Soft Pop: 53 columnas
// (semanas) × 7 filas, etiquetas de mes por columnas y leyenda de niveles.

interface HeatmapProps {
  data: Record<string, number>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Escala --heat-0..4 del design system: un solo hue en cinco intensidades.
function levelClass(count: number): string {
  if (count === 0) return 'hm';
  if (count < 5) return 'hm hm1';
  if (count < 10) return 'hm hm2';
  if (count < 20) return 'hm hm3';
  return 'hm hm4';
}

interface Day {
  date: string;
  count: number;
  month: number;
}

interface MonthSpan {
  label: string;
  start: number; // columna 1-indexed
  span: number;
}

export default function Heatmap({ data }: HeatmapProps) {
  const { weeks, monthSpans, activeDays, totalReviews } = useMemo(() => {
    const flat: Day[] = [];
    const today = new Date();
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      flat.push({ date: iso, count: data[iso] || 0, month: d.getMonth() });
    }

    // Semanas de 7 días; la última puede quedar incompleta.
    const w: Day[][] = [];
    for (let i = 0; i < flat.length; i += 7) {
      w.push(flat.slice(i, i + 7));
    }

    // Agrupar semanas consecutivas del mismo mes → spans de etiquetas.
    const spans: MonthSpan[] = [];
    w.forEach((week, wi) => {
      const first = week[0];
      if (!first) return;
      const last = spans[spans.length - 1];
      if (last && last.label === MONTHS[first.month]) {
        last.span += 1;
      } else {
        spans.push({ label: MONTHS[first.month], start: wi + 1, span: 1 });
      }
    });

    let total = 0;
    let active = 0;
    for (const day of flat) {
      total += day.count;
      if (day.count > 0) active += 1;
    }

    return { weeks: w, monthSpans: spans, activeDays: active, totalReviews: total };
  }, [data]);

  return (
    <div
      className="heatmap"
      role="img"
      aria-label="Review activity over the last 12 months"
    >
      <div className="heatmap__grid">
        {weeks.flatMap((week) =>
          week.map((day) => (
            <i
              key={day.date}
              className={levelClass(day.count)}
              title={`${day.date}: ${day.count} reviews`}
            />
          ))
        )}
      </div>
      <div className="heatmap__months">
        {/* Los meses con menos de 2 semanas de span no entran sin chocar
            con el vecino: se omiten (la leyenda no cambia de sentido). */}
        {monthSpans
          .filter((m) => m.span >= 2)
          .map((m) => (
            <span
              key={m.label}
              style={{ gridColumn: `${m.start} / span ${m.span}` }}
            >
              {m.label}
            </span>
          ))}
      </div>
      <div className="heatmap__legend">
        <span>Less</span>
        <i className="hm" />
        <i className="hm hm1" />
        <i className="hm hm2" />
        <i className="hm hm3" />
        <i className="hm hm4" />
        <span>More</span>
        <span className="heatmap__total">
          {activeDays} active days · {totalReviews.toLocaleString('en-US')} reviews
        </span>
      </div>
    </div>
  );
}
