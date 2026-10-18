import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { RollingPoint } from '../stats/engine'

const pctLabel = (v: number) => `${Math.round(v * 100)} %`

/** Courbe de winrate : glissant sur 10 matchs + cumulé. */
export default function TrendChart({ points }: { points: RollingPoint[] }) {
  if (points.length < 3) return <p className="muted small">La courbe apparaît à partir de 3 matchs.</p>
  return (
    <figure className="chart">
      <div className="legend" aria-hidden="true">
        <span>
          <i className="key s1" /> 10 derniers matchs
        </span>
        <span>
          <i className="key s2" /> Cumulé
        </span>
      </div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="i"
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }}
              minTickGap={24}
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tickFormatter={pctLabel}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <ReferenceLine y={0.5} stroke="var(--axis)" />
            <Tooltip
              cursor={{ stroke: 'var(--axis)' }}
              contentStyle={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text)',
                fontSize: 13,
              }}
              labelFormatter={(i, payload) => {
                const p = payload?.[0]?.payload as RollingPoint | undefined
                return p ? `Match ${i} · ${p.date}` : `Match ${i}`
              }}
              formatter={(v, name) => [pctLabel(Number(v)), name === 'winrate' ? '10 derniers' : 'Cumulé']}
            />
            <Line type="monotone" isAnimationActive={false} dataKey="winrate" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />
            <Line type="monotone" isAnimationActive={false} dataKey="cumulative" stroke="var(--series-2)" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="muted small">Axe horizontal : n° du match (ordre chronologique). Ligne à 50 % = équilibre.</figcaption>
    </figure>
  )
}
