'use client';

import dynamic from 'next/dynamic';

const World = dynamic(() => import('./World'), { ssr: false });

export default function WorldClient(props: { fixedT?: number | null; focus?: string | null }) {
  return <World {...props} />;
}
