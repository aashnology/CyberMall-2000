import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ELEVATOR, FOUNTAIN_RADIUS, HALF_D, HALF_W, type Placed } from '../data/layout';
import type { Collectible } from '../rewards/collectibles';
import { usePlayer } from '../store/usePlayer';
import { Avatar } from './Avatar';

const SPEED = 5; const NEAR_STORE = 4.5; const NEAR_ITEM = 2.2; const NEAR_LIFT = 2.6;

interface Props { slots: Placed[]; items: Collectible[]; spot: number; onCollect: (id: string) => void }

export function Walker({ slots, items, spot, onCollect }: Props) {
  const ref = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const frame = useRef(0);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); keys.current.add(k);
      if (k === 'e') { const id = usePlayer.getState().itemId; if (id) onCollect(id); }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [onCollect]);

  useFrame((state, dt) => {
    const g = ref.current; if (!g) return;
    const k = keys.current; const p = g.position;
    const dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const dz = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    if (dx || dz) {
      p.addScaledVector(new THREE.Vector3(dx, 0, dz).normalize(), SPEED * dt);
      p.x = THREE.MathUtils.clamp(p.x, -(HALF_W - 3), HALF_W - 3);
      p.z = THREE.MathUtils.clamp(p.z, -(HALF_D - 3), HALF_D - 3);
      const d = Math.hypot(p.x, p.z); const r = FOUNTAIN_RADIUS + 0.6;
      if (d > 0 && d < r) { p.x *= r / d; p.z *= r / d; }          // walk around the fountain
      g.rotation.y = Math.atan2(dx, dz);
    }
    let brandId: string | null = null; let best = NEAR_STORE;
    for (const { brand, slot } of slots) { const d = Math.hypot(p.x - slot.x, p.z - slot.z); if (d < best) { best = d; brandId = brand.id; } }
    let itemId: string | null = null;
    for (const it of items) if (Math.hypot(p.x - it.x, p.z - it.z) < NEAR_ITEM) itemId = it.id;
    const atElevator = Math.hypot(p.x - ELEVATOR.x, p.z - ELEVATOR.z) < NEAR_LIFT;
    const s = usePlayer.getState();
    if (s.brandId !== brandId || s.itemId !== itemId || s.atElevator !== atElevator) s.patch({ brandId, itemId, atElevator });
    if (++frame.current % 6 === 0) s.patch({ x: p.x, z: p.z });
    state.camera.position.lerp(new THREE.Vector3(p.x * 0.5, 11, p.z + 13), 0.08);
    state.camera.lookAt(p.x * 0.5, 1, p.z - 2);
  });
  return <group ref={ref} position={[0, 0, HALF_D - 5]}><Avatar spot={spot} /></group>;
}
