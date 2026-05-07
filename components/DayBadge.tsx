'use client';

import { useEffect, useState } from 'react';

export default function DayBadge() {
  const [dayCount, setDayCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d) => { if (d.dayCount) setDayCount(d.dayCount); })
      .catch(() => {});
  }, []);

  if (!dayCount) return null;

  return (
    <span className="text-[#4a4a6a] text-[10px] font-mono hidden sm:block px-1.5 py-0.5 border border-[#1e1e2e] rounded">
      Jour {dayCount}
    </span>
  );
}
