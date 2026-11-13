'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, useGLTF } from '@react-three/drei';
import { useApp } from '@/state/store';
import { COLORS, LOCATIONS, OFF_ROUTE, ROUTE } from '@/lib/theme';
import { FLIGHT } from '@/systems/flightplan';
import { scroll } from '@/systems/scroll';
import { DOSSIER } from '@/content/bio';
import { FREQUENCIES } from '@/content/site';
import { HoloPanel, HoloText } from './HoloPanel';
import { Interactable } from './Interactable';
import { FONT_HUD } from './materials';
import { baseFov, camTelemetry } from './CameraDirector';

/**
 * First-person cockpit, parented to the camera so the "you're in a ship" frame
 * never breaks. The shell is the Wasp Interdictor cockpit model; its three
 * monitors are overlaid with live screens drawn in code (route, hyperdrive,
 * scanner), and at the hub a holographic briefing is projected above the dash.
 */

const COCKPIT_URL = '/3d/cockpit.glb';
useGLTF.preload(COCKPIT_URL);

type V3 = [number, number, number];

/** the cockpit rides slightly nose-up in the frame, so the dash and its screens stay in view */
const BASE_PITCH = 0.075;

/**
 * The pilot's eye in the model's own coordinates (its nose points along +Z).
 * Any further back than z ≈ -1.3 and a canopy bulkhead blocks the windshield.
 */
const EYE: V3 = [0, 2.7, -1.16];

/** the three monitor faces, measured from the model (model coordinates, metres) */
const MONITORS = {
  left: { center: [0.2057, 2.3374, -0.6103] as V3, normal: [-0.1774, 0.4699, -0.8647] as V3, w: 0.1066, h: 0.1461 },
  center: { center: [0, 2.4027, -0.5996] as V3, normal: [0, 0.4129, -0.9108] as V3, w: 0.1422, h: 0.0589 },
  right: { center: [-0.2057, 2.3374, -0.6103] as V3, normal: [0.1774, 0.4699, -0.8647] as V3, w: 0.1066, h: 0.1461 },
};

/* ───────────────────────── live screens ───────────────────────── */

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

let monoFont = 'monospace';
let hudFont = 'sans-serif';
function resolveFonts() {
  if (typeof document === 'undefined') return;
  const cs = getComputedStyle(document.body);
  monoFont = cs.getPropertyValue('--font-jetbrains').trim() || 'monospace';
  hudFont = cs.getPropertyValue('--font-chakra').trim() || 'sans-serif';
}

const SCREEN_BG = '#02090c';

function frame(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  ctx.fillStyle = SCREEN_BG;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.globalAlpha = 1;
}

/** left monitor: the route, where you are on it, what you have visited */
const drawRoute: Draw = (ctx, w, h) => {
  const s = useApp.getState();
  const here = s.phase === 'JUMP' && s.jump ? s.jump.to : s.location;
  frame(ctx, w, h, COLORS.hudCyan);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.hudCyan;
  ctx.font = `600 30px ${hudFont}`;
  ctx.fillText('NAV · ROUTE', 26, 44);
  ctx.fillStyle = COLORS.hudCyanDim;
  ctx.fillRect(26, 68, w - 52, 2);

  let y = 108;
  const row = (id: (typeof ROUTE)[number], gap: number) => {
    const theme = LOCATIONS[id];
    const current = id === here;
    const seen = id === 'HUB' || s.visited.includes(id);
    if (current) {
      ctx.fillStyle = theme.base;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(18, y - 24, w - 36, 48);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = current ? theme.bright : seen ? theme.base : COLORS.textMuted;
    ctx.font = `${current ? 700 : 500} 31px ${monoFont}`;
    ctx.fillText(`${current ? '▸' : ' '} ${theme.label}`, 26, y);
    if (seen && !current) {
      ctx.font = `500 26px ${monoFont}`;
      ctx.fillText('✓', w - 52, y);
    }
    y += gap;
  };
  ROUTE.forEach((id) => row(id, 54));
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = `500 22px ${monoFont}`;
  ctx.fillText('MAP ONLY', 26, y + 2);
  y += 42;
  OFF_ROUTE.forEach((id) => row(id, 50));
};

/** centre monitor: hyperdrive state and the charge bar */
const drawDrive: Draw = (ctx, w, h, t) => {
  const s = useApp.getState();
  const charging = scroll.charge > 0.02;
  const jumping = s.phase === 'JUMP';
  const color = jumping ? COLORS.warning : charging ? COLORS.hudCyanBright : COLORS.success;
  frame(ctx, w, h, color);
  ctx.textBaseline = 'middle';
  ctx.font = `600 34px ${hudFont}`;
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText('HYPERDRIVE', 28, 52);
  ctx.fillStyle = color;
  ctx.textAlign = 'right';
  const blink = Math.sin(t * 9) > 0 ? 1 : 0.45;
  ctx.globalAlpha = jumping || charging ? blink : 1;
  ctx.fillText(jumping ? 'ENGAGED' : charging ? 'CHARGING' : 'READY', w - 28, 52);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  // segmented charge bar
  const segs = 18;
  const bw = (w - 56) / segs;
  const fill = jumping ? segs : Math.round(Math.min(scroll.charge, 1) * segs);
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = i < fill ? color : '#0c2a30';
    ctx.fillRect(28 + i * bw, 92, bw - 6, 40);
  }
  ctx.font = `500 26px ${monoFont}`;
  ctx.fillStyle = COLORS.textSecondary;
  const stops = FLIGHT[s.location].stops.length;
  const line =
    s.location === 'HUB'
      ? 'SCROLL DOWN TO FLY'
      : stops > 1
        ? `${LOCATIONS[s.location].label} · STOP ${s.stop + 1}/${stops}`
        : LOCATIONS[s.location].name;
  ctx.fillText(line, 28, 172);
};

/** right monitor: a scanner sweep over this location's stops */
const drawScanner: Draw = (ctx, w, h, t) => {
  const s = useApp.getState();
  const theme = LOCATIONS[s.location];
  frame(ctx, w, h, theme.base);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.base;
  ctx.font = `600 30px ${hudFont}`;
  ctx.fillText('SCANNER', 26, 44);
  ctx.fillStyle = COLORS.hudCyanDim;
  ctx.fillRect(26, 68, w - 52, 2);

  const cx = w / 2;
  const cy = 250;
  const R = 150;
  ctx.strokeStyle = COLORS.hudCyanDim;
  ctx.lineWidth = 2;
  [1, 0.62, 0.28].forEach((k) => {
    ctx.beginPath();
    ctx.arc(cx, cy, R * k, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.moveTo(cx - R, cy);
  ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R);
  ctx.lineTo(cx, cy + R);
  ctx.stroke();

  // sweep
  const a = t * 1.6;
  const grad = ctx.createConicGradient(a - 0.9, cx, cy);
  grad.addColorStop(0, 'rgba(0,217,245,0)');
  grad.addColorStop(0.14, 'rgba(0,217,245,0.32)');
  grad.addColorStop(0.145, 'rgba(0,217,245,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // this location's stops, as contacts
  const stops = FLIGHT[s.location].stops;
  const maxR = Math.max(12, ...stops.map((st) => Math.hypot(st.anchor[0], st.anchor[2]))) * 1.15;
  stops.forEach((st, i) => {
    const px = cx + (st.anchor[0] / maxR) * R;
    const py = cy + (st.anchor[2] / maxR) * R;
    const active = i === s.stop;
    ctx.fillStyle = active ? theme.bright : theme.base;
    ctx.globalAlpha = active ? 1 : 0.75;
    ctx.beginPath();
    ctx.arc(px, py, active ? 9 + Math.sin(t * 5) * 2 : 5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.hudCyanBright;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `500 22px ${monoFont}`;
  ctx.fillStyle = COLORS.textSecondary;
  const p = camTelemetry.pos;
  ctx.fillText(`X ${p.x.toFixed(1)}`, 26, 440);
  ctx.fillText(`Y ${p.y.toFixed(1)}`, 26, 468);
  ctx.fillText(`Z ${p.z.toFixed(1)}`, 26, 496);
  ctx.textAlign = 'right';
  ctx.fillStyle = theme.base;
  ctx.fillText(theme.name, w - 26, 440);
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText(`${stops.length} CONTACTS`, w - 26, 468);
  ctx.textAlign = 'left';
};

/** one monitor: a plane laid over the model's screen face, drawn from a canvas */
function Screen({
  monitor,
  pxW,
  pxH,
  draw,
  fps,
  powerAt,
}: {
  monitor: { center: V3; normal: V3; w: number; h: number };
  pxW: number;
  pxH: number;
  draw: Draw;
  fps: number;
  /** how far into the seat-settle (0..1) this screen switches on */
  powerAt: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const last = useRef(-1);
  const { canvas, texture, position, quaternion } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = pxW;
    c.height = pxH;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    // orient the plane to the screen face: +Z out of the glass toward the pilot
    const n = new THREE.Vector3(...monitor.normal).normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    const up = new THREE.Vector3().crossVectors(n, right);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, n));
    const p = new THREE.Vector3(...monitor.center).addScaledVector(n, 0.0025);
    return { canvas: c, texture: tex, position: p, quaternion: q };
  }, [monitor, pxW, pxH]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((state) => {
    const on = camTelemetry.settle >= powerAt;
    if (mesh.current) mesh.current.visible = on;
    if (!on || !camTelemetry.inCockpit) return;
    const t = state.clock.elapsedTime;
    const tick = Math.floor(t * fps);
    if (tick === last.current) return;
    last.current = tick;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx, pxW, pxH, t);
    texture.needsUpdate = true;
  });

  return (
    <mesh ref={mesh} position={position} quaternion={quaternion} frustumCulled={false}>
      <planeGeometry args={[monitor.w * 0.95, monitor.h * 0.93]} />
      <meshBasicMaterial map={texture} toneMapped={false} fog={false} />
    </mesh>
  );
}

/* ─────────────── the hub briefing, projected above the dash ─────────────── */

/** how far ahead of the pilot's eye the briefing hangs (metres) */
const BRIEFING_DISTANCE = 1.3;

const ROUTE_LINE = ROUTE.filter((id) => id !== 'HUB')
  .map((id) => LOCATIONS[id].label)
  .join('  ▸  ');

const QUICK_LINKS = [
  ...FREQUENCIES.filter((f) => f.id === 'github' || f.id === 'linkedin').map((f) => ({
    id: f.id,
    label: f.label,
    href: f.href,
  })),
  { id: 'resume', label: 'RÉSUMÉ', href: '/resume' },
];

function LinkChip({
  id,
  label,
  href,
  x,
  y,
  w = 0.8,
  h = 0.2,
  size = 0.075,
}: {
  id: string;
  label: string;
  href: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  size?: number;
}) {
  const hovered = useApp((s) => s.hovered === id);
  const color = LOCATIONS.HUB.bright;
  return (
    <group position={[x, y, 0.02]}>
      <Interactable
        id={id}
        onSelect={() => {
          if (href.startsWith('/')) window.location.assign(href);
          else window.open(href, '_blank', 'noopener');
        }}
      >
        <mesh>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color={color} transparent opacity={hovered ? 0.5 : 0.16} toneMapped={false} />
        </mesh>
        <Text
          font={FONT_HUD}
          fontSize={size}
          letterSpacing={0.1}
          color={hovered ? COLORS.textPrimary : color}
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0.01]}
        >
          {`${label} ▸`}
        </Text>
      </Interactable>
    </group>
  );
}

/** rotating galaxy news flashes — keeps the hub feeling inhabited */
const NEWS_FLASHES = [
  'HYPERLANE 7 REOPENS AFTER METEOR SWEEP — TRAFFIC NOMINAL',
  'RECRUITERS SPOTTED SCOUTING THE OUTER RIM FOR FULL-STACK PILOTS',
  'EMBERFALL RANGE: ROOKIE CLEARS 15 ROCKS OVER THE LAVA FIELDS',
  'ECHO RELAY UPGRADE COMPLETE — TRANSMISSIONS NOW 12% SHINIER',
  'THE DRIFT YIELDS FIVE INTACT BUILDS — SALVAGE CREWS OVERJOYED',
  'FUEL PRICES DIP ALONG THE MERIDIAN APPROACH',
  'ANVIL YARDS REPORTS ALL FIVE DOCKS OPERATIONAL',
  'NAV BEACON DRIFT CORRECTED — AUTOPILOT ACCURACY AT ALL-TIME HIGH',
];

/** one headline at a time along the bottom of the briefing */
function NewsLine() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const iv = window.setInterval(() => setI((n) => (n + 1) % NEWS_FLASHES.length), 5200);
    return () => window.clearInterval(iv);
  }, []);
  return (
    <HoloText x={-1.36} y={-0.74} size={0.042} color={COLORS.warning} maxWidth={2.72}>
      {'GNN LIVE ▸ ' + NEWS_FLASHES[i]}
    </HoloText>
  );
}

/**
 * The flight briefing: who the pilot is, how to fly, the route ahead and quick
 * links. A hologram the dash projects up into the pilot's line of sight; shown
 * only while parked at the hub.
 */
function HubBriefing() {
  const show = useApp(
    (s) => s.phase === 'FLIGHT' && s.location === 'HUB' && !s.mapOpen && s.navMode === 'AUTO',
  );
  const aspect = useThree((s) => s.size.width / Math.max(s.size.height, 1));
  const theme = LOCATIONS.HUB;
  const links = show
    ? QUICK_LINKS.map((l) => ({ ...l, id: `hub-link-${l.id}` }))
    : [];

  // upright screens: a tall panel in large type, sized to the visible width
  if (aspect < 1) {
    const W = 1.9;
    const H = 2.0;
    const visibleWidth =
      2 * BRIEFING_DISTANCE * Math.tan(THREE.MathUtils.degToRad(baseFov(aspect)) / 2) * aspect;
    const scale = (visibleWidth * 0.84) / W;
    const x = -W / 2 + 0.1;
    return (
      <group position={[0, 0.36, -BRIEFING_DISTANCE]} scale={scale}>
        <HoloPanel width={W} height={H} color={theme.base} visible={show} title="FLIGHT BRIEFING" float={false}>
          <HoloText x={x} y={0.74} size={0.2} color={COLORS.textPrimary} font={FONT_HUD}>
            {DOSSIER.callsign}
          </HoloText>
          <HoloText x={x} y={0.47} size={0.09} color={theme.bright}>
            {DOSSIER.rank}
          </HoloText>
          <HoloText x={x} y={0.34} size={0.09} color={theme.bright}>
            {DOSSIER.posting}
          </HoloText>
          <HoloText x={x} y={0.1} size={0.1} color={COLORS.textSecondary}>
            {'SWIPE UP ....... FLY'}
          </HoloText>
          <HoloText x={x} y={-0.08} size={0.1} color={COLORS.textSecondary}>
            {'KEEP SWIPING ... JUMP'}
          </HoloText>
          <HoloText x={x} y={-0.26} size={0.1} color={COLORS.textSecondary}>
            {'SWIPE DOWN ..... GO BACK'}
          </HoloText>
          <HoloText x={x} y={-0.44} size={0.1} color={COLORS.textSecondary}>
            {'MAP BUTTON ..... MAP'}
          </HoloText>
          {links.map((l, i) => (
            <LinkChip key={l.id} id={l.id} label={l.label} href={l.href} x={-0.6 + i * 0.6} y={-0.78} w={0.56} h={0.22} size={0.066} />
          ))}
        </HoloPanel>
      </group>
    );
  }

  return (
    <group position={[0, 0.31, -BRIEFING_DISTANCE]} scale={0.25}>
      <HoloPanel width={2.9} height={1.78} color={theme.base} visible={show} title="FLIGHT BRIEFING — WAYPOINT ZERO" float={false}>
        <HoloText x={-1.36} y={0.63} size={0.17} color={COLORS.textPrimary} font={FONT_HUD}>
          {DOSSIER.callsign}
        </HoloText>
        <HoloText x={-1.36} y={0.39} size={0.062} color={theme.bright}>
          {`${DOSSIER.rank} · ${DOSSIER.posting}`}
        </HoloText>
        <HoloText x={-1.36} y={0.2} size={0.062} color={COLORS.textSecondary}>
          {'SCROLL DOWN ........ FLY THE ROUTE'}
        </HoloText>
        <HoloText x={-1.36} y={0.07} size={0.062} color={COLORS.textSecondary}>
          {'KEEP SCROLLING ..... CHARGE THE HYPERDRIVE'}
        </HoloText>
        <HoloText x={-1.36} y={-0.06} size={0.062} color={COLORS.textSecondary}>
          {'SCROLL UP .......... FLY BACK'}
        </HoloText>
        <HoloText x={-1.36} y={-0.19} size={0.062} color={COLORS.textSecondary}>
          {'M / MAP BUTTON ..... OPEN THE MAP'}
        </HoloText>
        <HoloText x={-1.36} y={-0.36} size={0.048} color={theme.base}>
          {`ROUTE  ${ROUTE_LINE}`}
        </HoloText>
        {links.map((l, i) => (
          <LinkChip key={l.id} id={l.id} label={l.label} href={l.href} x={-0.94 + i * 0.88} y={-0.56} />
        ))}
        <NewsLine />
      </HoloPanel>
    </group>
  );
}

/* ───────────────────────────── root ───────────────────────────── */

export function Cockpit() {
  const { scene } = useGLTF(COCKPIT_URL);
  const rig = useRef<THREE.Group>(null);
  const warpLight = useRef<THREE.PointLight>(null);
  const lean = useRef(0);
  const upright = useThree((s) => s.size.width < s.size.height);

  useEffect(resolveFonts, []);

  // our own copy of the model, tuned for a camera that sits inside it
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // the shell surrounds the camera, so its bounds test is never useful
      mesh.frustumCulled = false;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mat.fog = false;
      if (mat.name === 'displ') {
        // the model's baked monitor art sits under our live screens
        mat.emissiveIntensity = 0.1;
        mat.color.set('#05090c');
      } else if (mat.name === 'glass') {
        mat.depthWrite = false;
        mat.envMapIntensity = 0.6;
      } else {
        mat.envMapIntensity = 0.9;
      }
      mesh.material = mat;
    });
    return c;
  }, [scene]);

  useFrame((state, dt) => {
    const s = useApp.getState();
    const t = state.clock.elapsedTime;
    const g = rig.current;
    if (g) {
      // lean toward the dash while parked at the hub, so the screens read
      const wantLean = s.phase === 'FLIGHT' && s.location === 'HUB' && s.navMode === 'AUTO' ? 1 : 0;
      lean.current += (wantLean - lean.current) * Math.min(dt * 2.2, 1);
      // dropping into the seat after the canopy pass
      const drop = 1 - camTelemetry.settle;
      const sway = s.reducedMotion ? 0 : 1;
      g.position.set(
        0,
        -drop * 0.3 + lean.current * 0.02,
        -drop * 0.6 + lean.current * 0.13,
      );
      g.rotation.set(
        BASE_PITCH + lean.current * (upright ? 0.03 : 0.13) + drop * 0.12 + Math.sin((t * Math.PI * 2) / 7.3) * 0.004 * sway,
        0,
        Math.sin((t * Math.PI * 2) / 6) * 0.006 * sway,
      );
    }
    // the tunnel lights the cabin
    if (warpLight.current) {
      const k = camTelemetry.tunnel;
      warpLight.current.intensity = k * (3.2 + Math.sin(t * 23) * 0.9 + Math.sin(t * 7.3) * 0.6);
    }
  });

  return (
    <>
      {/* the briefing hangs in the pilot's line of sight, independent of the lean */}
      <HubBriefing />
      <group ref={rig}>
      {/* model space → camera space: turn the nose to -Z, put the eye on the origin */}
      <group position={[EYE[0], -EYE[1], EYE[2]]} rotation={[0, Math.PI, 0]}>
        <primitive object={model} />
        <Screen monitor={MONITORS.left} pxW={384} pxH={526} draw={drawRoute} fps={4} powerAt={0.3} />
        <Screen monitor={MONITORS.center} pxW={512} pxH={212} draw={drawDrive} fps={20} powerAt={0.55} />
        <Screen monitor={MONITORS.right} pxW={384} pxH={526} draw={drawScanner} fps={15} powerAt={0.8} />
      </group>

      {/* cabin lighting: cool key from above the canopy, cyan glow off the dash */}
      <pointLight position={[0, 0.5, -0.5]} color="#CFE4FF" intensity={0.9} distance={3} decay={1.6} />
      <pointLight position={[0, -0.35, -0.75]} color={COLORS.hudCyan} intensity={0.5} distance={1.6} decay={1.8} />
      <pointLight ref={warpLight} position={[0, 0.25, -1.6]} color="#9CC9FF" intensity={0} distance={5} decay={1.4} />
      </group>
    </>
  );
}
