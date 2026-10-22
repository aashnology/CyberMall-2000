import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ELEVATOR, FOUNTAIN_RADIUS, HALF_D } from '../data/layout';
import type { Collectible } from '../rewards/collectibles';

const PARTICLES = 36;

/** Animated fountain: instanced water droplets on arcs plus three expanding ripple rings. */
function Fountain() {
  const drops = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.Mesh[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; const m = drops.current; if (!m) return;
    for (let i = 0; i < PARTICLES; i++) {
      const a = (i / PARTICLES) * Math.PI * 2; const ph = (t * 0.9 + i * 0.37) % 1; const r = 0.3 + ph * 1.8;
      dummy.position.set(Math.cos(a) * r, 0.6 + Math.sin(ph * Math.PI) * 1.6, Math.sin(a) * r);
      dummy.scale.setScalar(0.07); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    rings.current.forEach((r, i) => {
      const ph = (t * 0.4 + i / 3) % 1; r.scale.setScalar(0.6 + ph * 2.2);
      (r.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - ph);
    });
  });
  return (
    <group>
      <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[FOUNTAIN_RADIUS, FOUNTAIN_RADIUS + 0.2, 0.5, 40]} /><meshStandardMaterial color="#efe6d6" roughness={0.2} metalness={0.1} /></mesh>
      <mesh position={[0, 0.51, 0]}><cylinderGeometry args={[FOUNTAIN_RADIUS - 0.2, FOUNTAIN_RADIUS - 0.2, 0.02, 40]} /><meshStandardMaterial color="#7fc6d9" transparent opacity={0.75} roughness={0.05} /></mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => { if (el) rings.current[i] = el; }} position={[0, 0.54, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1, 48]} /><meshBasicMaterial color="#d9f4ff" transparent opacity={0.5} />
        </mesh>
      ))}
      <instancedMesh ref={drops} args={[undefined, undefined, PARTICLES]}><sphereGeometry args={[1, 8, 8]} /><meshBasicMaterial color="#e6f9ff" /></instancedMesh>
    </group>
  );
}

function Palm({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.6, 0.45, 0.8, 16]} /><meshStandardMaterial color="#2B1E1A" roughness={0.6} /></mesh>
      <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.08, 0.12, 2.4, 8]} /><meshStandardMaterial color="#6b4f35" /></mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[Math.cos(i * 1.05) * 0.7, 2.9, Math.sin(i * 1.05) * 0.7]} rotation={[0.5 * Math.sin(i * 1.05), -i * 1.05, -0.5 * Math.cos(i * 1.05)]}>
          <boxGeometry args={[1.8, 0.03, 0.35]} /><meshStandardMaterial color="#4f6b2f" />
        </mesh>
      ))}
    </group>
  );
}

function Sofa({ x, z, rotY }: { x: number; z: number; rotY: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[3, 0.5, 1.2]} /><meshStandardMaterial color="#58111A" roughness={0.95} /></mesh>
      <mesh position={[0, 0.8, -0.5]}><boxGeometry args={[3, 0.9, 0.3]} /><meshStandardMaterial color="#58111A" roughness={0.95} /></mesh>
      <mesh position={[0, 0.05, 0]}><boxGeometry args={[3.1, 0.1, 1.3]} /><meshStandardMaterial color="#c5a059" metalness={0.8} roughness={0.3} /></mesh>
    </group>
  );
}

export function CollectibleMesh({ item }: { item: Collectible }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ref.current) { ref.current.rotation.y = clock.elapsedTime * 1.5; ref.current.position.y = 0.9 + Math.sin(clock.elapsedTime * 2) * 0.1; } });
  return (
    <mesh ref={ref} position={[item.x, 0.9, item.z]}>
      <octahedronGeometry args={[0.28]} /><meshStandardMaterial color={item.color} emissive={item.color} emissiveIntensity={0.9} />
    </mesh>
  );
}

interface Props { floor: number; onOpenMap: () => void }

/** Central town square, directory kiosk and the elevator bank. Floor 2 swaps the fountain for a glass void. */
export function Atrium({ floor, onOpenMap }: Props) {
  return (
    <group>
      {floor === 1 ? <Fountain /> : (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[FOUNTAIN_RADIUS, 40]} /><meshStandardMaterial color="#0b1220" transparent opacity={0.8} roughness={0.05} /></mesh>
      )}
      {[[-7, -6], [7, -6], [-7, 6], [7, 6]].map(([x, z]) => <Palm key={`${x}${z}`} x={x ?? 0} z={z ?? 0} />)}
      <Sofa x={-8} z={0} rotY={Math.PI / 2} /><Sofa x={0} z={-8} rotY={0} />
      <group position={[6, 0, 0]} rotation={[0, -Math.PI / 2, 0]} onClick={onOpenMap}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
        <mesh position={[0, 1.2, 0]}><boxGeometry args={[1.4, 2.4, 0.5]} /><meshStandardMaterial color="#2B1E1A" metalness={0.4} roughness={0.4} /></mesh>
        <mesh position={[0, 1.6, 0.27]}><planeGeometry args={[1.1, 1.3]} /><meshStandardMaterial color="#0b2a4a" emissive="#3d8fd9" emissiveIntensity={0.9} /></mesh>
        <Text position={[0, 2, 0.29]} fontSize={0.14} color="#bfe3ff">MALL DIRECTORY</Text>
        <Text position={[0, 1.4, 0.29]} fontSize={0.12} color="#bfe3ff">click or press M</Text>
      </group>
      <group position={[ELEVATOR.x, 0, HALF_D + 0.4]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 2.2, 0]}><boxGeometry args={[4, 4.4, 0.5]} /><meshStandardMaterial color="#6a4a32" metalness={0.7} roughness={0.35} /></mesh>
        <mesh position={[0, 2, 0.27]}><planeGeometry args={[3.2, 3.8]} /><meshStandardMaterial color="#c9a46a" metalness={0.9} roughness={0.3} /></mesh>
        <Text position={[0, 4.6, 0.1]} fontSize={0.4} color="#ffd77a" anchorX="center">ELEVATOR</Text>
      </group>
    </group>
  );
}
