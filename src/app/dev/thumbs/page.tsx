import { notFound } from 'next/navigation';
import ThumbStudioLoader from '@/components/dev/ThumbStudioLoader';

/**
 * Development tool: renders one world on its own so `scripts/capture-worlds.mjs`
 * can save it as an image (public/worlds). Not available in production.
 */
export default function ThumbsPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ThumbStudioLoader />;
}
