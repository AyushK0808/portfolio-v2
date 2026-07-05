'use client';

import dynamic from 'next/dynamic';

// The 3D experience is client-only; the /resume route carries the
// crawlable text content (plan §12).
const App = dynamic(() => import('@/components/App'), {
	ssr: false,
	loading: () => (
		<div className="fixed inset-0 flex items-center justify-center">
			<span
				className="font-data animate-breathe"
				style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
			>
				INITIALIZING FLIGHT SYSTEMS…
			</span>
		</div>
	),
});

export default function Home() {
	return <App />;
}
