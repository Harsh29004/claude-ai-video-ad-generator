import {useThree} from '@react-three/fiber';
import {useEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {SRGBColorSpace, TextureLoader, type AnimationClip, type Group, type Texture} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

const cache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let promise = cache.get(key) as Promise<T> | undefined;
  if (!promise) cache.set(key, promise = load());
  return promise;
}

/**
 * Loads something asynchronously without React Suspense. The video frame is held with delayRender() until the
 * asset is ready, then the canvas is drawn again with it, so no frame is ever captured half-loaded.
 */
function useAsync<T>(key: string | null, load: () => Promise<T>): T | null {
  const advance = useThree((s) => s.advance);
  const [state, setState] = useState<{key: string; value: T} | null>(null);
  const handle = useRef<number | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const own = delayRender(`Loading ${key}`, {timeoutInMilliseconds: 120000});
    handle.current = own;
    cached(key, load).then((value) => {
      if (alive) setState({key, value});
    }, (error: unknown) => cancelRender(error instanceof Error ? error : new Error(String(error))));
    return () => {
      alive = false;
      if (handle.current === own) {
        continueRender(own);
        handle.current = null;
      }
    };
    // `load` is a fresh closure every render; the key identifies the asset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const value = state && state.key === key ? state.value : null;

  useEffect(() => {
    if (value === null) return;
    advance(performance.now());
    if (handle.current !== null) {
      continueRender(handle.current);
      handle.current = null;
    }
  }, [value, advance]);

  return value;
}

export function useImageTexture(src: string | undefined): Texture | null {
  return useAsync(src ? `texture:${src}` : null, () => new TextureLoader().loadAsync(staticFile(src!)).then((texture) => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }));
}

export function useGltf(src: string | undefined): {scene: Group; animations: AnimationClip[]} | null {
  return useAsync(src ? `gltf:${src}` : null, () => new GLTFLoader().loadAsync(staticFile(src!))
    .then((gltf) => ({scene: gltf.scene, animations: gltf.animations})));
}
