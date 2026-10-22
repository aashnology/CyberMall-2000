import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { HALF_D, HALF_W, type Placed } from '../data/layout';
import type { LightPreset } from '../lighting/dayCycle';
import type { Collectible } from '../rewards/collectibles';
import { usePlayer } from '../store/usePlayer';
import { Atrium, CollectibleMesh } from './Atrium';
import { Storefront } from './Storefront';
import { marbleTexture } from './textures';
import { Walker } from './Walker';

interface Props {
  floor: number; slots: Placed[]; items: Collectible[]; preset: LightPreset;
  onCollect: (id: string) => void; onOpenMap: () => void;
}

export function Floor({ floor, slots, items, preset, onCollect, onOpenMap }: Props) {
  const tex = useMemo(() => marbleTexture(), []);
  const nearId = usePlayer((s) => s.brandId);
  return (
    <Canvas camera={{ position: [0, 11, HALF_D + 4], fov: 50 }}>
      <color attach="background" args={[preset.sky]} />
      <ambientLight intensity={preset.ambient * 0.5} />
      <hemisphereLight args={[preset.skylight, '#2B1E1A', preset.ambient * 0.6]} />
      <directionalLight position={[5, 20, 5]} intensity={preset.sun} color={preset.skylight} />
      <pointLight position={[-12, 4, -8]} intensity={25 * preset.neon} distance={18} color="#ff4fa3" />
      <pointLight position={[12, 4, 8]} intensity={25 * preset.neon} distance={18} color="#4fc3ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALF_W * 2 + 4, HALF_D * 2 + 4]} /><meshStandardMaterial map={tex} roughness={0.18} metalness={0.15} />
      </mesh>
      <Atrium floor={floor} onOpenMap={onOpenMap} />
      {slots.map((p) => <Storefront key={p.brand.id} {...p} neon={preset.neon} active={p.brand.id === nearId} />)}
      {items.map((it) => <CollectibleMesh key={it.id} item={it} />)}
      <Walker slots={slots} items={items} spot={preset.spot} onCollect={onCollect} />
    </Canvas>
  );
}
