import type { Metadata } from 'next';
import { SITE } from '@/content/site';
import ResumeView from '@/components/resume/ResumeView';

export const metadata: Metadata = {
	title: 'Ayush Kumar — Résumé',
	description: SITE.description,
};

/**
 * Full text version (plan §12): same content as the 3D missions in plain
 * scrollable HTML — for recruiters in a hurry, phones, screen readers,
 * crawlers, and devices without WebGL. Layout mirrors the classic
 * ayushk08.com portfolio: app bar + About / Skills / Projects /
 * Experience / Key Roles / Education / Contact.
 */
export default function ResumePage() {
	return <ResumeView />;
}
