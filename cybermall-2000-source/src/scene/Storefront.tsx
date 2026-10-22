import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Placed } from '../data/layout';

const ALU = new THREE.MeshStandardMaterial({ color: '#b9bcc2', metalness: 0.85, roughness: 0.35 });
const WALL = new THREE.MeshStandardMaterial({ color: '#2B1E1A', roughness: 0.7 });

interface Props extends Placed { neon: number; active: boolean }

/** Tall glass shopfront: open interior behind brushed-aluminium framing, lit sign band, neon at night. */
export function Storefront({ brand, slot, neon, active }: Props) {
  const signColor = neon > 0.8 ? '#ff4fa3' : '#ffcf7a';
  return (
    <group position={[slot.x, 0, slot.z]} rotation={[0, slot.rotY, 0]}>
      <mesh position={[0, 2.5, -1.4]} material={WALL}><boxGeometry args={[5, 5, 0.2]} /></mesh>
      <mesh position={[-2.4, 2.5, -0.7]} material={WALL}><boxGeometry args={[0.2, 5, 1.6]} /></mesh>
      <mesh position={[2.4, 2.5, -0.7]} material={WALL}><boxGeometry args={[0.2, 5, 1.6]} /></mesh>
      <mesh position={[0, 2, -1.28]}><planeGeometry args={[4.4, 3.6]} />
        <meshStandardMaterial color="#fff3cf" emissive="#ffd9a0" emissiveIntensity={(active ? 1 : 0.55) + neon * 0.15} /></mesh>
      <mesh position={[0, 0.7, -0.8]} material={ALU}><boxGeometry args={[4, 0.12, 0.8]} /></mesh>
      <mesh position={[0, 2, 0.1]}><planeGeometry args={[4.6, 4]} />
        <meshPhysicalMaterial color="#cfe3ee" transparent opacity={0.16} roughness={0.05} /></mesh>
      <mesh position={[-2.4, 2, 0.1]} material={ALU}><boxGeometry args={[0.12, 4, 0.14]} /></mesh>
      <mesh position={[2.4, 2, 0.1]} material={ALU}><boxGeometry args={[0.12, 4, 0.14]} /></mesh>
      <mesh position={[0, 0.06, 0.1]} material={ALU}><boxGeometry args={[4.9, 0.12, 0.2]} /></mesh>
      <mesh position={[0, 4.6, 0.1]}><boxGeometry args={[5, 0.8, 0.25]} /><meshStandardMaterial color="#121212" metalness={0.5} roughness={0.4} /></mesh>
      <Text position={[0, 4.6, 0.25]} fontSize={0.45} color={signColor} anchorX="center" anchorY="middle" material-toneMapped={false}>{brand.name}</Text>
    </group>
  );
}
