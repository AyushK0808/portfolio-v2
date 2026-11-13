'use client';

import { FormEvent, useState } from 'react';
import { audio } from '@/systems/audio';
import { LOCATIONS } from '@/lib/theme';
import { FREQUENCIES, SITE } from '@/content/site';

type TxState = 'IDLE' | 'SENDING' | 'SENT' | 'ERROR';

/**
 * Contact, at Echo Relay: links, a message form and the résumé download, as
 * one overlay card so it is sharp and usable on any screen. The form posts to
 * /api/contact, which emails the message on.
 */
export function CommsPanel() {
  const theme = LOCATIONS.COMMS;
  const [tx, setTx] = useState<TxState>('IDLE');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (tx === 'SENDING') return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setTx('SENDING');
    audio.click();
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      setTx('SENT');
      audio.transmit();
      form.reset();
    } catch {
      setTx('ERROR');
      audio.error();
    }
  };

  return (
    <div className="card-dock">
      <section
        className="holo-card comms-card animate-hud-in pointer-events-auto"
        style={{ ['--accent' as string]: theme.base, ['--accent-bright' as string]: theme.bright }}
        aria-label="Contact"
      >
        <div className="holo-card-eyebrow font-data">CHANNEL OPEN · ECHO RELAY</div>
        <h2 className="holo-card-title font-hud">GET IN TOUCH</h2>

        <div className="comms-links">
          {FREQUENCIES.filter((f) => f.id !== 'site').map((f) => (
            <a
              key={f.id}
              href={f.href}
              target={f.href.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="comms-link font-data"
              onMouseEnter={() => audio.blip()}
            >
              <span className="comms-link-label">{f.label}</span>
              <span className="comms-link-value">{f.value}</span>
            </a>
          ))}
          <a
            href={SITE.resumePdf}
            download
            className="comms-link font-data"
            onMouseEnter={() => audio.blip()}
          >
            <span className="comms-link-label">RÉSUMÉ</span>
            <span className="comms-link-value">Download PDF ↓</span>
          </a>
        </div>

        <form onSubmit={submit} className="comms-form">
          <div className="comms-row">
            <input name="name" required placeholder="Your name" aria-label="Your name" className="comms-input" autoComplete="name" />
            <input
              name="email"
              type="email"
              required
              placeholder="Your email"
              aria-label="Your email"
              className="comms-input"
              autoComplete="email"
            />
          </div>
          <textarea name="message" required rows={3} placeholder="Message" aria-label="Message" className="comms-input" />
          <div className="comms-send">
            <span className="font-data comms-status" role="status" aria-live="polite">
              {tx === 'IDLE' && 'Goes straight to my inbox.'}
              {tx === 'SENDING' && 'Transmitting…'}
              {tx === 'SENT' && 'Message received. Thank you.'}
              {tx === 'ERROR' && 'Could not send. Please use the email link above.'}
            </span>
            <button type="submit" disabled={tx === 'SENDING'} className="hud-btn holo-card-link" onMouseEnter={() => audio.blip()}>
              TRANSMIT ▸
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
