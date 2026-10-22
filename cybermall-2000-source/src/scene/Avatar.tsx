/** Original low-poly avatar: long golden hair, purple headband, amber shades, lime top, white skirt, brown belt. */
export function Avatar({ spot }: { spot: number }) {
  return (
    <group>
      <pointLight position={[0, 3, 0]} intensity={spot} distance={14} color="#ffd9a0" />
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
