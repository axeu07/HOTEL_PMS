/**
 * Materials for the hero scene. All lighting is baked into hotel.glb, so these
 * are unlit: they read vertex colours and add only the small animated touches
 * (palm sway, room lights, water, sky).
 */
import * as THREE from 'three';

export interface SharedUniforms {
  uTime: { value: number };
  uViewportHeight: { value: number };
}

type Compile = THREE.Material['onBeforeCompile'];

/** Swaying foliage. uv.x is how far the vertex moves, uv.y offsets its phase. */
export function foliageMaterial(shared: SharedUniforms) {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const compile: Compile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <project_vertex>',
        `vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
         float wave = uTime * 0.9 + uv.y * 6.283 + worldPos.x * 0.05;
         float gust = 0.65 + 0.35 * sin(uTime * 0.23 + worldPos.z * 0.03);
         worldPos.x += sin(wave) * uv.x * 0.55 * gust;
         worldPos.z += cos(wave * 0.8) * uv.x * 0.32 * gust;
         worldPos.y += sin(wave * 1.9 + worldPos.z) * uv.x * uv.x * 0.2 * gust;
         vec4 mvPosition = viewMatrix * worldPos;
         gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  material.onBeforeCompile = compile;
  material.customProgramCacheKey = () => 'hero-foliage';
  return material;
}

/** Room windows: a slow breathing glow, and a few rooms switch off and on. */
export function litWindowMaterial(shared: SharedUniforms) {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true });
  const compile: Compile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vGain;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float breath = 1.0 + 0.045 * sin(uTime * 0.6 + uv.x * 40.0);
         float room = uv.y > 0.86 ? 0.14 + 0.86 * smoothstep(-0.25, 0.25, sin(uTime * 0.11 + uv.x * 6.283)) : 1.0;
         vGain = 1.7 * breath * room;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGain;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vGain;');
  };
  material.onBeforeCompile = compile;
  material.customProgramCacheKey = () => 'hero-lit';
  return material;
}

/** Soft pools of light on the ground. */
export function lightPoolMaterial() {
  return new THREE.ShaderMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vQuad; varying vec3 vTint;
      void main() { vQuad = uv; vTint = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vQuad; varying vec3 vTint;
      void main() {
        float d = length(vQuad - 0.5) * 2.0;
        float a = pow(max(1.0 - d, 0.0), 2.0);
        gl_FragColor = vec4(vTint * a * 1.1, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** Lamp glow, drawn as distance-attenuated points. */
export function haloMaterial(shared: SharedUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uViewportHeight: shared.uViewportHeight },
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uViewportHeight;
      varying vec3 vTint;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float pulse = 0.93 + 0.07 * sin(uTime * 1.3 + uv.y * 40.0);
        vTint = color * pulse;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uv.x * 10.0 * projectionMatrix[1][1] * uViewportHeight * 0.5 / -mv.z, 1.5, 96.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vTint;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = smoothstep(0.26, 0.0, d);
        float glow = pow(max(1.0 - d, 0.0), 2.4);
        gl_FragColor = vec4(vTint * (glow * 0.8 + core * 1.3), 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** Dusk sky dome: gradient, afterglow, slow high cloud, a few stars. */
export function skyMaterial(shared: SharedUniforms) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: shared.uTime },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vDir;
      float hash(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) { return noise(p) * 0.55 + noise(p * 2.1 + 3.1) * 0.3 + noise(p * 4.3 + 7.7) * 0.15; }
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 ember  = vec3(1.25, 0.46, 0.17);
        vec3 rose   = vec3(0.62, 0.26, 0.31);
        vec3 mauve  = vec3(0.17, 0.13, 0.30);
        vec3 indigo = vec3(0.022, 0.044, 0.135);
        vec3 c = mix(ember, rose, smoothstep(0.0, 0.05, h));
        c = mix(c, mauve, smoothstep(0.03, 0.15, h));
        c = mix(c, indigo, smoothstep(0.11, 0.4, h));

        // Afterglow low behind the wing, to the left of the tower.
        vec3 sun = normalize(vec3(-0.42, 0.015, -0.9));
        float g = max(dot(d, sun), 0.0);
        c += vec3(1.1, 0.42, 0.13) * pow(g, 34.0) * 0.26;
        c += vec3(1.6, 0.85, 0.42) * pow(g, 260.0) * 0.4;

        // High cloud, streaked horizontally and lit from below.
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.16);
          float n = fbm(uv * vec2(0.55, 1.6) + vec2(uTime * 0.006, 0.0));
          float cloud = smoothstep(0.5, 0.78, n) * smoothstep(0.015, 0.11, h) * (1.0 - smoothstep(0.42, 0.7, h));
          vec3 lit = mix(vec3(0.1, 0.08, 0.19), vec3(0.8, 0.36, 0.26), pow(g, 3.0) * (1.0 - smoothstep(0.03, 0.26, h)) + 0.08);
          c = mix(c, lit, cloud * 0.85);

          // Stars, only where the sky has gone dark.
          vec2 cell = floor(uv * 62.0);
          float star = step(0.984, hash(cell));
          float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + hash(cell + 2.0)) + hash(cell + 5.0) * 40.0);
          float dotShape = smoothstep(0.17, 0.0, length(fract(uv * 62.0) - 0.5));
          c += vec3(0.92, 0.94, 1.0) * star * dotShape * twinkle * smoothstep(0.26, 0.55, h) * (1.0 - cloud) * 0.8;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** Shader handed to three's Reflector: reflections of the hotel over glowing, rippling water. */
export const waterShader = {
  name: 'HotelPoolWater',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uHalfSize: { value: new THREE.Vector2(1, 1) },
    uCentre: { value: new THREE.Vector2(0, 0) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vProj; varying vec3 vWorld;
    void main() {
      vProj = textureMatrix * vec4(position, 1.0);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uHalfSize, uCentre;
    varying vec4 vProj; varying vec3 vWorld;

    vec2 ripple(vec2 p, float t) {
      vec2 r = vec2(0.0);
      r += vec2(cos(p.x * 0.5 + p.y * 0.2 + t * 0.5), cos(p.y * 0.7 - p.x * 0.17 + t * 0.42)) * 0.5;
      r += vec2(cos(p.x * 1.3 - p.y * 0.6 - t * 0.7), cos(p.y * 1.6 + p.x * 0.5 + t * 0.8)) * 0.3;
      r += vec2(cos(p.x * 3.1 + p.y * 2.3 + t * 1.1), cos(p.y * 3.7 - p.x * 1.9 - t * 1.0)) * 0.14;
      return r;
    }

    void main() {
      vec2 p = vWorld.xz;
      vec2 r = ripple(p, uTime);
      vec3 n = normalize(vec3(r.x * 0.14, 1.0, r.y * 0.14));
      vec3 V = normalize(cameraPosition - vWorld);
      float fresnel = pow(1.0 - max(dot(n, V), 0.0), 2.6);

      // The reflection stretches vertically in a way that reads as a calm surface.
      vec4 uv = vProj;
      uv.x += r.x * 0.004 * uv.w;
      uv.y += r.y * 0.012 * uv.w;
      vec3 reflected = texture2DProj(tDiffuse, uv).rgb;

      // Pool lit from inside: bright turquoise at the walls, deeper in the middle.
      vec2 q = abs(p - uCentre);
      float edge = min(uHalfSize.x - q.x, uHalfSize.y - q.y);
      float toWall = exp(-max(edge, 0.0) * 0.1);
      vec3 deep = vec3(0.012, 0.2, 0.24);
      vec3 lit = vec3(0.04, 0.82, 0.78);
      vec3 body = mix(deep, lit, toWall * 0.85);

      // Faint caustic lines drifting across the floor.
      float caustic = pow(abs(sin(p.x * 0.8 + r.x * 2.1) * sin(p.y * 0.8 + r.y * 2.1)), 7.0);
      body += vec3(0.05, 0.42, 0.4) * caustic * (0.34 + toWall);

      vec3 c = mix(body, reflected, clamp(0.2 + fresnel * 0.85, 0.0, 0.92));

      // Glitter where the surface catches the lamps.
      float glint = smoothstep(0.84, 1.0, r.x * r.y * 2.5 + 0.5);
      c += reflected * glint * 0.3;

      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

/** Drifting motes close to the camera: small, but they sell the depth when the view moves. */
export function moteMaterial(shared: SharedUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uViewportHeight: shared.uViewportHeight },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uViewportHeight;
      attribute float aSeed;
      varying float vFade;
      void main() {
        vec3 p = position;
        float t = uTime * 0.06 + aSeed * 40.0;
        p.x += sin(t * 1.3) * 3.0;
        p.y = mod(p.y + uTime * (0.08 + aSeed * 0.14), 14.0);
        p.z += cos(t) * 3.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vFade = smoothstep(0.0, 1.5, p.y) * (1.0 - smoothstep(10.0, 14.0, p.y)) * (0.5 + 0.5 * sin(uTime * (0.5 + aSeed) + aSeed * 50.0));
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((0.05 + aSeed * 0.09) * projectionMatrix[1][1] * uViewportHeight * 0.5 / -mv.z, 1.0, 10.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * pow(max(1.0 - d, 0.0), 2.0) * vFade * 0.75, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
