'use client';

import dynamic from 'next/dynamic';

// WebGL only: never rendered on the server
const ThumbStudio = dynamic(() => import('./ThumbStudio'), { ssr: false });

export default function ThumbStudioLoader() {
  return <ThumbStudio />;
}
