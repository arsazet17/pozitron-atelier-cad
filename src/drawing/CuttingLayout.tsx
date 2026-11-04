import type { FabricUse } from '../model/calc';

/**
 * Карта раскроя: рулон показан лентой, длинный рулон переносится на несколько строк.
 * Цветные прямоугольники — детали, штриховка — остаток.
 */

const PIECE_COLORS = ['#c9a25d', '#8fa9bf', '#b9a3c9', '#9cc3a5', '#d6a28c', '#c4bf7e'];

export function CuttingLayout({ use, className }: { use: FabricUse; className?: string }) {
  const Rw = use.rollWidth;
  const total = Math.max(use.lengthRaw, 1);
  const chunk = Math.max(Rw * 3.2, 3000);
  const chunks = Math.max(1, Math.ceil(total / chunk - 1e-9));
  const fs = Math.max(Rw * 0.085, chunk * 0.022);
  const gap = fs * 3.2;
  const left = fs * 4.2;
  const W = left + chunk + fs;
  const H = chunks * (Rw + gap) + fs;
  const labels = new Map<string, number>();
  let colorIdx = 0;
  const colorOf = (label: string) => {
    const base = label.split('.')[0];
    if (!labels.has(base)) labels.set(base, colorIdx++);
    return PIECE_COLORS[labels.get(base)! % PIECE_COLORS.length];
  };
  const m = (mm: number) => (mm / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

  return (
    <svg className={className ?? 'cutting-svg'} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Раскрой: ${use.name}`} fontFamily="var(--font-ui, sans-serif)">
      <defs>
        <pattern id={`rest-${use.role}`} width={fs * 0.8} height={fs * 0.8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={fs * 0.8} stroke="#9aa1a8" strokeWidth={fs * 0.08} />
        </pattern>
      </defs>
      {Array.from({ length: chunks }, (_, k) => {
        const x0 = k * chunk;
        const x1 = Math.min(total, x0 + chunk);
        const top = fs * 0.6 + k * (Rw + gap);
        const len = x1 - x0;
        return (
          <g key={k} transform={`translate(${left} ${top + fs * 1.2})`}>
            <rect x={0} y={0} width={len} height={Rw} fill="var(--paper, #fff)" stroke="var(--ink, #1d2b3a)" strokeWidth={fs * 0.08} />
            {use.layout
              .filter((p) => p.x < x1 && p.x + p.w > x0)
              .map((p, i) => {
                const a = Math.max(p.x, x0) - x0;
                const b = Math.min(p.x + p.w, x1) - x0;
                const rest = p.kind === 'rest';
                return (
                  <g key={i}>
                    <rect
                      x={a}
                      y={p.y}
                      width={b - a}
                      height={p.h}
                      fill={rest ? `url(#rest-${use.role})` : colorOf(p.label)}
                      fillOpacity={rest ? 1 : 0.55}
                      stroke="var(--ink, #1d2b3a)"
                      strokeWidth={fs * 0.06}
                    />
                    {!rest &&
                      p.h > fs * 1.4 &&
                      (() => {
                        // подпись — только если помещается в видимую часть детали
                        const full = `${p.label} · ${p.w.toLocaleString('ru-RU')}×${p.h.toLocaleString('ru-RU')}`;
                        const text = full.length * fs * 0.56 < b - a - fs ? full : p.label.length * fs * 0.58 < b - a - fs ? p.label : '';
                        return text ? (
                          <text x={(a + b) / 2} y={p.y + p.h / 2 + fs * 0.35} fontSize={fs} textAnchor="middle" fill="var(--ink, #1d2b3a)">
                            {text}
                          </text>
                        ) : null;
                      })()}
                  </g>
                );
              })}
            <text x={0} y={-fs * 0.4} fontSize={fs * 0.9} fill="var(--ink-soft, #5b6775)">
              {m(x0)} м
            </text>
            <text x={len} y={-fs * 0.4} fontSize={fs * 0.9} textAnchor="end" fill="var(--ink-soft, #5b6775)">
              {m(x1)} м
            </text>
            {k === 0 && (
              <text x={-fs * 0.6} y={Rw / 2} fontSize={fs * 0.9} textAnchor="middle" transform={`rotate(-90 ${-fs * 0.6} ${Rw / 2})`} fill="var(--ink-soft, #5b6775)">
                рулон {Rw.toLocaleString('ru-RU')} мм
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
