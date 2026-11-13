import type { Metadata } from 'next';
import { SITE } from '@/content/site';
import ResumeView from '@/components/resume/ResumeView';

export const metadata: Metadata = {
	title: 'Ayush Kumar — Résumé',
	description: SITE.description,
};

/**
 * The flat version of the site: the same route as the 3D flight, drawn as one
 * scrolling page with GSAP scroll animations and no 3D scene. For recruiters in
 * a hurry, screen readers, crawlers, and browsers without WebGL.
 */
export default function ResumePage() {
	return <ResumeView />;
}
