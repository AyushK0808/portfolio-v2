import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SITE } from '@/content/site';

/**
 * Comms terminal transmit endpoint. Every submission is BOTH emailed to the
 * pilot (Gmail SMTP, authenticated with a Google App Password via worker-mailer
 * — nodemailer can't run on Workers) AND persisted to MongoDB. Per the chosen
 * policy both must succeed; if either the mail or the DB write fails the caller
 * gets an error and the terminal shows the failure so nothing is silently lost.
 *
 * Required env (see ENV.md): GMAIL_USER, GMAIL_APP_PASSWORD, CONTACT_TO
 * (optional), MONGODB_URI, MONGODB_DB (optional), MONGODB_COLLECTION (optional).
 */

interface ContactEnv {
  GMAIL_USER?: string;
  GMAIL_APP_PASSWORD?: string;
  CONTACT_TO?: string;
  MONGODB_URI?: string;
  MONGODB_DB?: string;
  MONGODB_COLLECTION?: string;
}

function readEnv(): ContactEnv {
  try {
    return getCloudflareContext().env as unknown as ContactEnv;
  } catch {
    // outside the Workers runtime (e.g. plain `next dev`) fall back to process.env
    return process.env as unknown as ContactEnv;
  }
}

async function sendMail(env: ContactEnv, sub: { name: string; email: string; message: string }) {
  const user = env.GMAIL_USER;
  const pass = env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('email not configured (GMAIL_USER / GMAIL_APP_PASSWORD)');

  const { WorkerMailer } = await import('worker-mailer');
  await WorkerMailer.send(
    {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // upgrade to TLS via STARTTLS
      startTls: true,
      authType: 'login',
      credentials: { username: user, password: pass },
    },
    {
      from: { name: 'Comms Terminal', email: user },
      to: { email: env.CONTACT_TO || SITE.email },
      reply: { name: sub.name, email: sub.email },
      subject: `[ayushk08.com] transmission from ${sub.name}`,
      text: `From: ${sub.name} <${sub.email}>\n\n${sub.message}`,
      html:
        `<p><strong>From:</strong> ${escapeHtml(sub.name)} &lt;${escapeHtml(sub.email)}&gt;</p>` +
        `<p style="white-space:pre-wrap">${escapeHtml(sub.message)}</p>`,
    },
  );
}

async function storeSubmission(
  env: ContactEnv,
  sub: { name: string; email: string; message: string },
) {
  const uri = env.MONGODB_URI;
  if (!uri) throw new Error('database not configured (MONGODB_URI)');

  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  });
  try {
    await client.connect();
    await client
      .db(env.MONGODB_DB || 'portfolio')
      .collection(env.MONGODB_COLLECTION || 'contact_submissions')
      .insertOne({ ...sub, createdAt: new Date(), source: 'comms-terminal' });
  } finally {
    await client.close().catch(() => {});
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

  const env = readEnv();
  const sub = { name, email, message };

  // both the email and the DB write must succeed (policy: nothing lost). Run
  // them together so a slow DB doesn't serialize behind the mail round-trip.
  const [mailRes, dbRes] = await Promise.allSettled([
    sendMail(env, sub),
    storeSubmission(env, sub),
  ]);

  if (mailRes.status === 'rejected' || dbRes.status === 'rejected') {
    if (mailRes.status === 'rejected') console.error('contact: email failed', mailRes.reason);
    if (dbRes.status === 'rejected') console.error('contact: db write failed', dbRes.reason);
    return NextResponse.json({ ok: false, error: 'transmit failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
