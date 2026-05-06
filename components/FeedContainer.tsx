'use client';

import { useState } from 'react';
import TrendingBar from './TrendingBar';
import Feed from './Feed';

export default function FeedContainer() {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  function handleSelect(topic: string) {
    setActiveFilter((prev) => (prev === topic ? null : topic));
  }

  return (
    <>
      <TrendingBar activeFilter={activeFilter} onSelect={handleSelect} />
      <Feed filter={activeFilter} />
    </>
  );
}
