/**
 * The storyboard vocabulary for cinematic 3D shots. Plain constants only (no three.js), so the schema and the
 * tests can import them without loading a renderer.
 */
export const worlds = ['studio', 'space', 'city', 'terrain', 'abstract'] as const;
export const moods = ['auto', 'noon', 'golden', 'dusk', 'night', 'dawn', 'neon'] as const;

export const cameraMoves = [
  'push-in', 'pull-out', 'orbit', 'crane-up', 'crane-down', 'fly-by', 'truck-left', 'truck-right',
  'fly-through', 'reveal', 'spiral', 'drift', 'static',
] as const;

export const particleKinds = ['auto', 'none', 'dust', 'sparks', 'embers', 'snow', 'rain', 'bokeh', 'fireflies'] as const;

export const materials = ['chrome', 'gold', 'glass', 'ceramic', 'iridescent', 'matte', 'emissive', 'carbon'] as const;
export const shapes = ['orb', 'ring', 'knot', 'crystal', 'capsule', 'cube'] as const;
export const devices = ['phone', 'tablet', 'laptop'] as const;
export const planets = ['earth', 'moon', 'mars', 'gas-giant', 'ice', 'lava'] as const;

export const transitions = ['cut', 'fade', 'flash', 'zoom', 'whip', 'blur', 'slide', 'wipe'] as const;
export const directions = ['left', 'right', 'up', 'down'] as const;
export const mediaMotions = ['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'pan-down'] as const;
export const titlePositions = ['center', 'top', 'bottom', 'lower-third'] as const;
export const grades = ['none', 'teal-orange', 'warm', 'cool', 'mono', 'vivid'] as const;
export const textBackdrops = ['aurora', 'grid', 'solid'] as const;
