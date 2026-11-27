import {useMemo} from 'react';
import {
  AnimationMixer, Box3, CanvasTexture, CapsuleGeometry, CylinderGeometry, ExtrudeGeometry, IcosahedronGeometry,
  MeshPhysicalMaterial, MeshStandardMaterial, SRGBColorSpace, Shape, ShapeGeometry, SphereGeometry, TorusGeometry,
  TorusKnotGeometry, Vector3, type BufferGeometry, type Material, type Mesh, type Texture,
} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {TextGeometry} from 'three/examples/jsm/geometries/TextGeometry.js';
import {FontLoader, type Font, type FontData} from 'three/examples/jsm/loaders/FontLoader.js';
import {clone as cloneSkinned} from 'three/examples/jsm/utils/SkeletonUtils.js';
import type {CinematicSpec} from '../project';
import {useGltf, useImageTexture} from './assets';
import fontJson from './fonts/droid_sans_bold.typeface.json';
import {makeMaterial} from './materials';

export type SubjectSpec = CinematicSpec['subject'];

let font: Font | null = null;
const getFont = () => font ??= new FontLoader().parse(fontJson as unknown as FontData);

/** Rough radius of the subject in world units, used to frame the camera. */
export function subjectRadius(subject: SubjectSpec): number {
  switch (subject.kind) {
    case 'text': return Math.min(2.35, 0.2 * subject.text.length + 0.35);
    case 'device': return subject.device === 'laptop' ? 1.2 : subject.device === 'tablet' ? 1 : 0.88;
    case 'model': return 1.15 * subject.scale;
    default: return 1.05;
  }
}

function roundedRect(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Flat rounded rectangle with 0–1 UVs across its whole area (ShapeGeometry's own UVs are in world units). */
function roundedPlane(w: number, h: number, r: number): BufferGeometry {
  const g = new ShapeGeometry(roundedRect(w, h, r), 16);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return g;
}

function slab(w: number, h: number, d: number, r: number): BufferGeometry {
  const bevel = Math.min(0.014, d * 0.3);
  const g = new ExtrudeGeometry(roundedRect(w - bevel * 2, h - bevel * 2, Math.max(0.001, r - bevel)), {
    depth: Math.max(0.001, d - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 20,
  });
  g.center();
  return g;
}

/** A tasteful lit wallpaper for devices without a supplied screenshot. Deliberately has no text or fake UI. */
function wallpaper(accent: string, aspect: number): Texture {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = Math.round(640 / aspect);
  const g = c.getContext('2d')!;
  const base = g.createLinearGradient(0, 0, c.width, c.height);
  base.addColorStop(0, '#0a1124');
  base.addColorStop(1, '#170c2b');
  g.fillStyle = base;
  g.fillRect(0, 0, c.width, c.height);
  for (const [x, y, r, col] of [[0.2, 0.25, 0.75, accent], [0.85, 0.7, 0.8, '#7a5cff'], [0.4, 0.95, 0.6, '#ff7ab6']] as const) {
    const glow = g.createRadialGradient(x * c.width, y * c.height, 0, x * c.width, y * c.height, r * c.width);
    glow.addColorStop(0, `${col}cc`);
    glow.addColorStop(1, `${col}00`);
    g.fillStyle = glow;
    g.fillRect(0, 0, c.width, c.height);
  }
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The supplied screenshot, cropped to fill the screen (like CSS object-fit: cover), or a wallpaper. */
function useScreen(src: string | undefined, accent: string, aspect: number): Texture {
  const loaded = useImageTexture(src);
  return useMemo(() => {
    if (!loaded) return wallpaper(accent, aspect);
    const t = loaded.clone();
    const img = t.image as {width: number; height: number};
    const imageAspect = img.width / img.height;
    if (imageAspect > aspect) {
      t.repeat.set(aspect / imageAspect, 1);
      t.offset.set((1 - t.repeat.x) / 2, 0);
    } else {
      t.repeat.set(1, imageAspect / aspect);
      t.offset.set(0, (1 - t.repeat.y) / 2);
    }
    t.needsUpdate = true;
    return t;
  }, [loaded, accent, aspect]);
}

function screenMaterial(map: Texture): Material {
  return new MeshStandardMaterial({map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.06, metalness: 0});
}

const blackGlass = () => new MeshPhysicalMaterial({color: '#030304', roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02});

function bodyMaterial(color: string): Material {
  return new MeshPhysicalMaterial({color, metalness: 0.88, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.2, envMapIntensity: 1.1});
}

function Handset({tablet, screen, body, accent}: {tablet: boolean; screen?: string; body: string; accent: string}) {
  const w = tablet ? 1.2 : 0.76, h = tablet ? 1.62 : 1.56, d = tablet ? 0.055 : 0.072, r = tablet ? 0.085 : 0.115;
  const bezel = tablet ? 0.045 : 0.026;
  const sw = w - bezel * 2, sh = h - bezel * 2;
  const texture = useScreen(screen, accent, sw / sh);
  const parts = useMemo(() => ({
    body: slab(w, h, d, r), front: roundedPlane(w - 0.012, h - 0.012, r - 0.006), display: roundedPlane(sw, sh, r - bezel),
    island: roundedPlane(tablet ? 0.03 : 0.19, tablet ? 0.03 : 0.052, tablet ? 0.015 : 0.026),
    bump: slab(tablet ? 0.16 : 0.31, tablet ? 0.16 : 0.31, 0.02, 0.06),
    lens: new CylinderGeometry(0.052, 0.056, 0.03, 40), button: new RoundedBoxGeometry(0.012, 0.16, 0.02, 2, 0.005),
    bodyMat: bodyMaterial(body), glass: blackGlass(),
    lensMat: new MeshPhysicalMaterial({color: '#07080c', roughness: 0.02, metalness: 0.5, clearcoat: 1}),
  }), [w, h, d, r, sw, sh, bezel, tablet, body]);
  const display = useMemo(() => screenMaterial(texture), [texture]);
  const lenses = tablet ? [[0, 0]] : [[-0.07, 0.07], [-0.07, -0.07], [0.07, 0]];
  return <group>
    <mesh geometry={parts.body} material={parts.bodyMat} castShadow />
    <mesh geometry={parts.front} material={parts.glass} position={[0, 0, d / 2 + 0.0006]} />
    <mesh geometry={parts.display} material={display} position={[0, 0, d / 2 + 0.0012]} />
    <mesh geometry={parts.island} material={parts.glass} position={[0, h / 2 - bezel - 0.05, d / 2 + 0.0018]} />
    <group position={[tablet ? -w / 2 + 0.14 : -w / 2 + 0.21, h / 2 - (tablet ? 0.14 : 0.21), -d / 2 - 0.008]}>
      <mesh geometry={parts.bump} material={parts.bodyMat} />
      {lenses.map(([x, y], i) => <mesh key={i} geometry={parts.lens} material={parts.lensMat} position={[x, y, -0.018]} rotation={[Math.PI / 2, 0, 0]} />)}
    </group>
    <mesh geometry={parts.button} material={parts.bodyMat} position={[w / 2 + 0.004, 0.22, 0]} />
    <mesh geometry={parts.button} material={parts.bodyMat} position={[-w / 2 - 0.004, 0.32, 0]} />
  </group>;
}

function Laptop({screen, body, accent}: {screen?: string; body: string; accent: string}) {
  const texture = useScreen(screen, accent, 16 / 10);
  const parts = useMemo(() => ({
    base: slab(2, 1.36, 0.05, 0.06), lid: slab(2, 1.3, 0.026, 0.06), display: roundedPlane(1.86, 1.162, 0.02),
    deck: roundedPlane(1.78, 0.6, 0.02), pad: roundedPlane(0.7, 0.42, 0.03),
    bodyMat: bodyMaterial(body), glass: blackGlass(), keys: new MeshStandardMaterial({color: '#0b0c10', roughness: 0.7}),
  }), [body]);
  const display = useMemo(() => screenMaterial(texture), [texture]);
  const open = (112 * Math.PI) / 180;
  return <group position={[0, -0.45, 0.3]}>
    <mesh geometry={parts.base} material={parts.bodyMat} rotation={[-Math.PI / 2, 0, 0]} castShadow />
    <mesh geometry={parts.deck} material={parts.keys} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0262, -0.25]} />
    <mesh geometry={parts.pad} material={parts.glass} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0262, 0.38]} />
    <group position={[0, 0.02, -0.68]} rotation={[-(open - Math.PI / 2), 0, 0]}>
      <group position={[0, 0.65, 0]}>
        <mesh geometry={parts.lid} material={parts.bodyMat} castShadow />
        <mesh geometry={parts.display} material={display} position={[0, 0.02, 0.0135]} />
      </group>
    </group>
  </group>;
}

function Title3D({text, material}: {text: string; material: Material}) {
  const {geometry, scale} = useMemo(() => {
    const g = new TextGeometry(text, {
      font: getFont(), size: 0.62, depth: 0.2, curveSegments: 10,
      bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.022, bevelSegments: 4,
    });
    g.computeBoundingBox();
    g.center();
    const width = g.boundingBox!.max.x - g.boundingBox!.min.x;
    return {geometry: g, scale: Math.min(1, 4.4 / width)};
  }, [text]);
  return <mesh geometry={geometry} material={material} scale={scale} castShadow />;
}

function Model({src, scale, spin, animation, seconds}: {src: string; scale: number; spin: boolean; animation: boolean; seconds: number}) {
  const gltf = useGltf(src);
  const model = useMemo(() => {
    if (!gltf) return null;
    const root = cloneSkinned(gltf.scene);
    root.traverse((o) => {
      if ((o as Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const mixer = animation && gltf.animations.length ? new AnimationMixer(root) : null;
    mixer?.clipAction(gltf.animations[0]).play();
    return {root, center, fit: 2.3 / Math.max(size.x, size.y, size.z, 1e-6), mixer};
  }, [gltf, animation]);
  if (!model) return null;
  // Frame-locked animation: the clip time is set from the video time, never advanced by a clock.
  model.mixer?.setTime(seconds);
  return <group scale={model.fit * scale} rotation={[0, spin ? seconds * 0.35 : 0, 0]}>
    <primitive object={model.root} position={[-model.center.x, -model.center.y, -model.center.z]} />
  </group>;
}

const shapeGeometry: Record<string, () => BufferGeometry> = {
  orb: () => new SphereGeometry(0.95, 128, 64),
  ring: () => new TorusGeometry(0.82, 0.3, 64, 220),
  knot: () => new TorusKnotGeometry(0.7, 0.24, 320, 48),
  crystal: () => new IcosahedronGeometry(1.02, 1),
  capsule: () => new CapsuleGeometry(0.46, 0.95, 16, 48),
  cube: () => new RoundedBoxGeometry(1.3, 1.3, 1.3, 6, 0.14),
};

/** The hero object of a shot, animated from the video time only. */
export function Subject({spec, accent, seconds}: {spec: SubjectSpec; accent: string; seconds: number}) {
  const material = useMemo(() => {
    if (spec.kind !== 'shape' && spec.kind !== 'text') return null;
    const m = makeMaterial(spec.material, spec.color ?? accent);
    if (spec.kind === 'shape' && spec.shape === 'crystal' && 'flatShading' in m) (m as MeshStandardMaterial).flatShading = true;
    return m;
  }, [spec, accent]);
  const geometry = useMemo(() => spec.kind === 'shape' ? shapeGeometry[spec.shape]() : null, [spec]);
  const float = Math.sin(seconds * 0.9) * 0.06;

  switch (spec.kind) {
    case 'shape':
      return <group position={[0, float, 0]} rotation={[Math.sin(seconds * 0.4) * 0.3, seconds * 0.5, 0.12]}>
        <mesh geometry={geometry!} material={material!} castShadow />
      </group>;
    case 'text':
      return <group position={[0, float * 0.6, 0]} rotation={[0, Math.sin(seconds * 0.5) * 0.2, 0]}>
        <Title3D text={spec.text} material={material!} />
      </group>;
    case 'device':
      return <group position={[0, float, 0]} rotation={[-0.06 + Math.sin(seconds * 0.3) * 0.04, -0.32 + Math.sin(seconds * 0.45) * 0.26, 0.03]}>
        {spec.device === 'laptop'
          ? <Laptop screen={spec.screen} body={spec.color ?? '#b9bcc4'} accent={accent} />
          : <Handset tablet={spec.device === 'tablet'} screen={spec.screen} body={spec.color ?? '#3a3c42'} accent={accent} />}
      </group>;
    case 'model':
      return <Model src={spec.src} scale={spec.scale} spin={spec.spin} animation={spec.animation} seconds={seconds} />;
    default:
      return null;
  }
}
