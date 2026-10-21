import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Brand } from '../types';

const SPACING = 6;
const SPEED = 5;
const NEAR = 4.5;

export function storefrontPosition(i: number): [number, number, number] {
  return [i % 2 === 0 ? -7 : 7, 0, -Math.floor(i / 2) * SPACING];
}

/** Original low-poly avatar: long golden hair, purple headband, amber shades, lime top, white skirt, brown belt. */
function Avatar() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]}><coneGeometry args={[0.45, 0.8, 16]} /><meshStandardMaterial color="#f4efe2" /></mesh>
      <mesh position={[0, 0.82, 0]}><cylinderGeometry args={[0.28, 0.3, 0.1, 16]} /><meshStandardMaterial color="#6b3f22" /></mesh>
      <mesh position={[0, 1.15, 0]}><cylinderGeometry args={[0.26, 0.3, 0.55, 16]} /><meshStandardMaterial color="#c8e04a" /></mesh>
      <mesh position={[0, 1.7, 0]}><sphereGeometry args={[0.3, 24, 24]} /><meshStandardMaterial color="#e0a96d" /></mesh>
      <mesh position={[0, 1.65, -0.12]}><boxGeometry args={[0.7, 1.3, 0.3]} /><meshStandardMaterial color="#f2c230" /></mesh>
      <mesh position={[0, 1.88, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.3, 0.03, 8, 24]} /><meshStandardMaterial color="#8a5cc7" /></mesh>
      <mesh position={[0, 1.72, 0.28]}><boxGeometry args={[0.4, 0.1, 0.04]} /><meshStandardMaterial color="#ffb43c" transparent opacity={0.8} /></mesh>
    </group>
  );
}

interface WalkerProps { maxDepth: number; brands: Brand[]; onNearby: (b: Brand | null) => void }

function Walker({ maxDepth, brands, onNearby }: WalkerProps) {
  const ref = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const last = useRef<string | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useFrame((state, dt) => {
    const g = ref.current; if (!g) return;
    const k = keys.current;
    const dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const dz = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    if (dx || dz) {
      g.position.addScaledVector(new THREE.Vector3(dx, 0, dz).normalize(), SPEED * dt);
      g.position.x = THREE.MathUtils.clamp(g.position.x, -9, 9);
      g.position.z = THREE.MathUtils.clamp(g.position.z, -maxDepth, 8);
      g.rotation.y = Math.atan2(dx, dz);
    }
    let nearest: Brand | null = null; let best = NEAR;
    brands.forEach((b, i) => {
      const [x, , z] = storefrontPosition(i);
      const d = Math.hypot(g.position.x - x, g.position.z - z);
      if (d < best) { best = d; nearest = b; }
    });
    const found = nearest as Brand | null;
    const id = found ? found.id : null;
    if (id !== last.current) { last.current = id; onNearby(found); }
    state.camera.position.lerp(new THREE.Vector3(g.position.x * 0.4, 7, g.position.z + 10), 0.08);
    state.camera.lookAt(g.position.x * 0.4, 1, g.position.z - 2);
  });
  return <group ref={ref} position={[0, 0, 4]}><Avatar /></group>;
}

function Storefront({ brand, index, active }: { brand: Brand; index: number; active: boolean }) {
  const pos = storefrontPosition(index);
  const rotY = pos[0] < 0 ? Math.PI / 2 : -Math.PI / 2; // local +z faces the corridor
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh position={[0, 2, 0]}><boxGeometry args={[5, 4, 1.4]} /><meshStandardMaterial color="#2B1E1A" /></mesh>
      <mesh position={[0, 1.4, 0.72]}><planeGeometry args={[4.2, 2.4]} />
        <meshStandardMaterial color="#fff3cf" emissive="#ffd9a0" emissiveIntensity={active ? 1.2 : 0.45} /></mesh>
      <mesh position={[0, 3.5, 0.72]}><planeGeometry args={[4.4, 0.8]} /><meshStandardMaterial color="#58111A" /></mesh>
      <Text position={[0, 3.5, 0.75]} fontSize={0.5} color="#C5A059" anchorX="center" anchorY="middle">{brand.name}</Text>
    </group>
  );
}

interface FloorProps { brands: Brand[]; nearbyId: string | null; onNearby: (b: Brand | null) => void }

export function Floor({ brands, nearbyId, onNearby }: FloorProps) {
  const maxDepth = useMemo(() => Math.max(0, Math.ceil(brands.length / 2) - 1) * SPACING + 2, [brands.length]);
  return (
    <Canvas camera={{ position: [0, 7, 14], fov: 50 }} style={{ background: '#FDFBF7' }}>
      <ambientLight intensity={0.8} /><pointLight position={[0, 8, 0]} intensity={60} color="#ffe2b0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -maxDepth / 2 + 4]}>
        <planeGeometry args={[24, maxDepth + 30]} /><meshStandardMaterial color="#efe8dc" roughness={0.15} metalness={0.2} /></mesh>
      {brands.map((b, i) => <Storefront key={b.id} brand={b} index={i} active={b.id === nearbyId} />)}
      <Walker maxDepth={maxDepth} brands={brands} onNearby={onNearby} />
    </Canvas>
  );
}
