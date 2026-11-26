import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Project, Scene} from './project';

type Three = Extract<Scene, {type: 'three'}>;

function Sculpture({scene, accent}: {scene: Three; accent: string}) {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const angle = 2 * Math.PI * frame / (fps * scene.rotationSeconds);
  const metal = scene.material === 'metal';

  return <group scale={Math.min(1, width / height)} position={[0, -0.12 + Math.sin(angle) * 0.13, 0]}>
    <mesh rotation={[angle * 0.5, angle, 0.2]}>
      {scene.geometry === 'orb' && <sphereGeometry args={[0.91, 64, 40]} />}
      {scene.geometry === 'ring' && <torusGeometry args={[1, 0.28, 36, 112]} />}
      {scene.geometry === 'knot' && <torusKnotGeometry args={[0.86, 0.3, 160, 24]} />}
      <meshPhysicalMaterial color={scene.color ?? accent} metalness={metal ? 0.58 : 0.04} roughness={metal ? 0.3 : 0.23} clearcoat={metal ? 0.2 : 0.85} />
    </mesh>
    {scene.geometry === 'orb' && <group rotation={[1.12, 0.33, -0.42]}>
      <mesh>
        <torusGeometry args={[1.55, 0.016, 12, 96]} />
        <meshBasicMaterial color={accent} transparent opacity={0.48} />
      </mesh>
      <mesh position={[1.55 * Math.cos(angle), 1.55 * Math.sin(angle), 0]}>
        <sphereGeometry args={[0.12, 24, 16]} />
        <meshStandardMaterial color={accent} roughness={0.35} />
      </mesh>
    </group>}
  </group>;
}

export function ThreeScene({scene, project}: {scene: Three; project: Project}) {
  const {width, height} = useVideoConfig();
  const unit = Math.min(width, height);

  return <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 48%, ${project.accent}30 0%, transparent 62%), ${project.background}`}}>
    <ThreeCanvas width={width} height={height} dpr={1} gl={{alpha: true, antialias: true}} camera={{position: [0, 0, 6.4], fov: 38}}>
      <hemisphereLight args={['#e1ecff', '#322349', 1.15]} />
      <directionalLight color="#fff3e4" position={[-4, 5, 4]} intensity={3.5} />
      <directionalLight color={project.accent} position={[3, 2, -4]} intensity={3} />
      <pointLight color="#9cb8ff" position={[3, -2, 3]} intensity={24} />
      <Sculpture scene={scene} accent={project.accent} />
    </ThreeCanvas>
    {scene.headline && <div style={{position: 'absolute', top: unit * 0.075, left: '7%', right: '7%', textAlign: 'center', fontSize: unit * 0.067, fontWeight: 750, textShadow: '0 2px 12px #0009', overflowWrap: 'anywhere'}}>{scene.headline}</div>}
  </AbsoluteFill>;
}