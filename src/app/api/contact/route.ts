import { NextRequest, NextResponse } from 'next/server';
import { SITE } from '@/content/site';

/**
 * Comms terminal transmit endpoint. If RESEND_API_KEY is configured
 * (wrangler secret / .dev.vars) the message is emailed via Resend;
 * otherwise it is logged so the terminal still completes gracefully.
 */
export async function POST(req: NextRequest) {
	let body: { name?: string; email?: string; message?: string };
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ ok: false, error: 'bad payload' }, { status: 400 });
	}

	const name = (body.name ?? '').toString().trim().slice(0, 200);
	const email = (body.email ?? '').toString().trim().slice(0, 200);
	const message = (body.message ?? '').toString().trim().slice(0, 5000);
	if (!name || !email || !message) {
		return NextResponse.json({ ok: false, error: 'missing fields' }, { status: 400 });
	}

	const key = process.env.RESEND_API_KEY;
	if (key) {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${key}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: 'Comms Terminal <onboarding@resend.dev>',
				to: [SITE.email],
				reply_to: email,
				subject: `[ayushk08.com] transmission from ${name}`,
				text: `From: ${name} <${email}>\n\n${message}`,
			}),
		});
		if (!res.ok) {
			console.error('resend failed', res.status, await res.text());
			return NextResponse.json({ ok: false, error: 'transmit failed' }, { status: 502 });
		}
	} else {
		// no key configured — log so dev/preview still works end to end
		console.log('[contact transmission]', { name, email, message });
	}

	return NextResponse.json({ ok: true });
}
