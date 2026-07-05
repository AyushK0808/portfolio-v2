'use client';

import { FormEvent, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { audio } from '@/systems/audio';
import { useApp } from '@/state/store';
import { SECTORS } from '@/lib/theme';
import { CONSOLE_POS } from '@/systems/flightplan';
import { FREQUENCIES } from '@/content/site';
import { CrtMaterial } from '../materials';

const theme = SECTORS.CONTACT;

type TxState = 'IDLE' | 'SENDING' | 'SENT' | 'ERROR';

/**
 * CONTACT — CRT comms terminal. Green phosphor screen with tunable
 * frequency rows (socials) and a transmit form (bible §7.6).
 */
export default function SectorContact() {
  const mat = useRef<InstanceType<typeof CrtMaterial>>(null);
  const [tx, setTx] = useState<TxState>('IDLE');

  useFrame((state) => {
    if (mat.current) mat.current.uTime = state.clock.elapsedTime;
  });

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
      useApp.getState().completeMission('CONTACT', true);
    } catch {
      setTx('ERROR');
      audio.error();
    }
  };

  const mono = 'var(--font-jetbrains), monospace';

  return (
    <group position={CONSOLE_POS}>
      {/* pedestal */}
      <mesh position={[0, -1.05, 0.3]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[1.6, 0.9, 0.5]} />
        <meshStandardMaterial color="#0C111B" roughness={0.7} metalness={0.4} />
      </mesh>
      {/* CRT screen glow backdrop */}
      <mesh rotation={[-0.06, 0, 0]}>
        <planeGeometry args={[2.75, 1.95]} />
        <crtMaterial ref={mat} transparent />
      </mesh>
      {/* bezel */}
      <mesh position={[0, 0, -0.03]} rotation={[-0.06, 0, 0]}>
        <planeGeometry args={[2.95, 2.15]} />
        <meshStandardMaterial color="#10161f" roughness={0.6} metalness={0.5} />
      </mesh>

      <Html
        transform
        position={[0, 0.02, 0.03]}
        rotation={[-0.06, 0, 0]}
        scale={0.16}
        style={{ width: '760px', pointerEvents: 'auto', userSelect: 'none' }}
      >
        <div
          style={{
            fontFamily: mono,
            color: theme.base,
            background: 'transparent',
            padding: '18px 26px',
            textShadow: `0 0 6px ${theme.base}66`,
            fontSize: '15px',
            lineHeight: 1.55,
          }}
        >
          <div style={{ letterSpacing: '0.2em', marginBottom: 6, color: theme.bright }}>
            ▚ COMMS TERMINAL v4.2 — CHANNEL OPEN
          </div>
          <div style={{ opacity: 0.75, marginBottom: 12 }}>
            {'> tuned frequencies:'}
          </div>
          {FREQUENCIES.map((f) => (
            <a
              key={f.id}
              href={f.href}
              target={f.href.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              onMouseEnter={() => audio.blip()}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: theme.base,
                textDecoration: 'none',
                padding: '3px 8px',
                border: `1px solid ${theme.base}22`,
                marginBottom: 4,
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.background = `${theme.base}1d`;
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span>{`[${f.freq}] ${f.label}`}</span>
              <span style={{ color: theme.bright }}>{f.value} ▸</span>
            </a>
          ))}

          <div style={{ opacity: 0.75, margin: '14px 0 8px' }}>
            {'> compose transmission:'}
          </div>
          <form onSubmit={submit}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input name="name" required placeholder="CALLSIGN (NAME)" style={inputStyle} />
              <input
                name="email"
                type="email"
                required
                placeholder="RETURN FREQUENCY (EMAIL)"
                style={inputStyle}
              />
            </div>
            <textarea
              name="message"
              required
              rows={4}
              placeholder="MESSAGE BODY…"
              style={{ ...inputStyle, width: '100%', resize: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ opacity: 0.8 }}>
                {tx === 'IDLE' && '> awaiting input _'}
                {tx === 'SENDING' && '> transmitting ▒▒▒▒░░░░'}
                {tx === 'SENT' && '> transmission received. channel logged. ✓'}
                {tx === 'ERROR' && '> transmit failed — hail directly via EMAIL freq above.'}
              </span>
              <button
                type="submit"
                disabled={tx === 'SENDING'}
                onMouseEnter={() => audio.blip()}
                style={{
                  fontFamily: mono,
                  background: `${theme.base}22`,
                  color: theme.bright,
                  border: `1px solid ${theme.base}`,
                  padding: '6px 18px',
                  letterSpacing: '0.15em',
                  cursor: 'pointer',
                }}
              >
                TRANSMIT ▸
              </button>
            </div>
          </form>
        </div>
      </Html>

      <pointLight position={[0, 0.4, 1.6]} color={theme.base} intensity={1.8} distance={8} decay={1.8} />
    </group>
  );
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains), monospace',
  flex: 1,
  background: 'rgba(11, 122, 62, 0.08)',
  border: '1px solid rgba(77, 255, 136, 0.35)',
  color: '#B6FFC9',
  padding: '7px 10px',
  fontSize: '14px',
  outline: 'none',
};
