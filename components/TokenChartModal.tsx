'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatPrice } from '@/lib/utils';

type PricePoint = { price: number; recorded_at: string };

type Props = {
  token: string;
  agentName: string;
  agentColor: string;
  currentPrice: number;
  change24h: number;
  onClose: () => void;
};

export default function TokenChartModal({
  token, agentName, agentColor, currentPrice, change24h, onClose,
}: Props) {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/price-history/${token}`)
      .then((r) => r.json())
      .then((d: PricePoint[]) => {
        const lastHistoryPrice = d.at(-1)?.price;
        console.log(`[TokenChart/${token}] currentPrice (economy):`, currentPrice, '| last history point:', lastHistoryPrice);
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token, currentPrice]);

  const chartData = data.map((p) => ({
    time: new Date(p.recorded_at).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    }),
    price: parseFloat(Number(p.price).toFixed(4)),
  }));

  const isPositive = change24h >= 0;
  const lineColor = isPositive ? '#34d399' : '#f87171';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[500px] max-w-[95vw] bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2e] bg-[#0d0d14]">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: agentColor }} />
            <span className="text-[#e8e6f0] font-mono font-bold text-sm">{token}</span>
            <span className="text-[#9ca3af] text-xs font-mono">{agentName}</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#e8e6f0] font-mono text-xl leading-none transition-colors w-6 text-center"
          >
            ×
          </button>
        </div>

        {/* Price summary */}
        <div className="flex items-baseline gap-3 px-4 py-3 border-b border-[#1e1e2e]">
          <span className="text-[#e8e6f0] font-mono text-2xl font-bold">
            ${formatPrice(currentPrice)}
          </span>
          <span
            className="font-mono text-sm font-bold"
            style={{ color: isPositive ? '#34d399' : '#f87171' }}
          >
            {isPositive ? '+' : ''}{change24h.toFixed(2)}%
          </span>
          <span className="text-[#9ca3af] text-[11px] font-mono ml-auto">24h</span>
        </div>

        {/* Chart */}
        <div className="px-2 py-4 h-56">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <span className="text-[#9ca3af] text-xs font-mono animate-pulse">Chargement…</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <span className="text-[#9ca3af] text-xs font-mono">Aucune donnée</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#374151', fontSize: 9, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fill: '#374151', fontSize: 9, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
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
                  formatter={(v) => [`$${Number(v).toFixed(4)}`, 'Prix']}
                  labelStyle={{ color: '#9ca3af', marginBottom: 2 }}
                  cursor={{ stroke: '#1e1e2e', strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={lineColor}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#1e1e2e] bg-[#0d0d14]">
          <p className="text-[#9ca3af] text-[10px] font-mono text-center">
            Historique 24h · mise à jour toutes les 30 min
          </p>
        </div>
      </div>
    </div>
  );
}
