import {Color, MeshPhysicalMaterial, MeshStandardMaterial, type Material} from 'three';
import type {materials} from './vocab';

export type MaterialName = typeof materials[number];

/** Physically based finishes. Most of their realism comes from reflecting the world's environment lighting. */
export function makeMaterial(name: MaterialName, tint: string): Material {
  switch (name) {
    case 'chrome':
      return new MeshStandardMaterial({color: '#eef1f6', metalness: 1, roughness: 0.07, envMapIntensity: 1.25});
    case 'gold':
      return new MeshStandardMaterial({color: '#f4c46a', metalness: 1, roughness: 0.16, envMapIntensity: 1.2});
    case 'glass':
      return new MeshPhysicalMaterial({
        color: '#ffffff', metalness: 0, roughness: 0.03, transmission: 1, thickness: 1.2, ior: 1.5,
        dispersion: 3, attenuationColor: new Color(tint).lerp(new Color('#ffffff'), 0.55), attenuationDistance: 2.2,
        specularIntensity: 1, envMapIntensity: 1.4, clearcoat: 1, clearcoatRoughness: 0.02,
      });
    case 'ceramic':
      return new MeshPhysicalMaterial({color: tint, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1});
    case 'iridescent':
      return new MeshPhysicalMaterial({
        color: '#dfe3ff', metalness: 0.8, roughness: 0.14, iridescence: 1, iridescenceIOR: 1.65,
        iridescenceThicknessRange: [160, 820], envMapIntensity: 1.3, clearcoat: 0.6,
      });
    case 'matte':
      return new MeshStandardMaterial({color: tint, roughness: 0.82, metalness: 0});
    case 'emissive':
      return new MeshStandardMaterial({color: '#0c0c0e', emissive: tint, emissiveIntensity: 3.2, roughness: 0.35});
    case 'carbon':
      return new MeshPhysicalMaterial({color: '#16171b', metalness: 0.55, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.04});
  }
}
