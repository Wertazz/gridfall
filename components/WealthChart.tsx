'use client';

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

type Props = {
  data: Array<{ wealth: number; recorded_at: string }>;
  color: string;
};

export default function WealthChart({ data, color }: Props) {
  const chartData = data.map((d) => ({
    label: new Date(d.recorded_at).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short',
    }),
    wealth: Math.round(Number(d.wealth)),
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tick={{ fill: '#374151', fontSize: 9, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#374151', fontSize: 9, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v: number) => `${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0d0d14',
            border: '1px solid #1e1e2e',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#e8e6f0',
          }}
          formatter={(v) => [`${Number(v).toLocaleString()} ¤`, 'Fortune']}
          labelStyle={{ color: '#9ca3af' }}
          cursor={{ stroke: '#1e1e2e', strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="wealth"
          stroke={color}
          strokeWidth={1.5}
          fill="url(#wealthGrad)"
          dot={false}
          activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
