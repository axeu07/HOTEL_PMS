/** The WebGL half of the hero. Lazy-loaded: three.js is only fetched by devices that will use it. */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { HeroTier } from './capabilities';
import { foliageMaterial, haloMaterial, lightPoolMaterial, litWindowMaterial, moteMaterial, skyMaterial, waterShader, type SharedUniforms } from './materials';
import type { HeroRig } from './rig';

const MODEL_URL = `${import.meta.env.BASE_URL}models/hotel.glb`;
const FOG_COLOR = new THREE.Color(0.34, 0.17, 0.17);

/** Must match POOL in scripts/build-hotel-model.mjs. */
const POOL = { x0: -46, x1: 34, z0: 20, z1: 62 };

const DPR_STEPS = { high: [1.5, 1.25, 1, 0.8], low: [1.5, 1.25, 1] } as const;

/* ---------- Model ---------- */

function HotelModel({ shared }: { shared: SharedUniforms }) {
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
  });

  useMemo(() => {
    const baked = new THREE.MeshBasicMaterial({ vertexColors: true });
    const glass = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const byName: Record<string, THREE.Material> = {
      solid: baked,
      far: baked,
      foliage: foliageMaterial(shared),
      lit: litWindowMaterial(shared),
      glass,
      pools: lightPoolMaterial(),
      halos: haloMaterial(shared),
    };
    gltf.scene.traverse((object) => {
      const renderable = object as THREE.Mesh | THREE.Points;
      if (!renderable.geometry) return;
      const material = byName[object.name] ?? byName[object.parent?.name ?? ''];
      if (material) renderable.material = material;
      object.frustumCulled = object.name !== 'foliage';
      object.matrixAutoUpdate = false;
      object.updateMatrix();
    });
    gltf.scene.updateMatrixWorld(true);
  }, [gltf, shared]);

  return <primitive object={gltf.scene} />;
}

/* ---------- Water, reflecting the scene ---------- */

function Pool({ tier, shared }: { tier: Exclude<HeroTier, 'static'>; shared: SharedUniforms }) {
  const mirror = useMemo(() => {
    const size = tier === 'high' ? 600 : 320;
    const width = POOL.x1 - POOL.x0;
    const depth = POOL.z1 - POOL.z0;
    const reflector = new Reflector(new THREE.PlaneGeometry(width, depth), {
      shader: waterShader,
      textureWidth: Math.round(size * 1.6),
      textureHeight: size,
      clipBias: 0.002,
      multisample: 0,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.set((POOL.x0 + POOL.x1) / 2, 0.03, (POOL.z0 + POOL.z1) / 2);

    const uniforms = (reflector.material as THREE.ShaderMaterial).uniforms;
    uniforms.uHalfSize.value = new THREE.Vector2(width / 2, depth / 2);
    uniforms.uCentre.value = new THREE.Vector2(reflector.position.x, reflector.position.z);
    uniforms.uTime = shared.uTime;

    // Rendering the scene a second time is the most expensive step per frame. Doing it
    // on alternate frames halves that, and the ripples hide the one-frame lag.
    const renderReflection = reflector.onBeforeRender;
    let frame = 0;
    reflector.onBeforeRender = function (...args) {
      if (frame++ % 2 === 0) renderReflection.apply(this, args);
    };
    return reflector;
  }, [tier, shared]);

  useEffect(
    () => () => {
      mirror.dispose();
      mirror.geometry.dispose();
    },
    [mirror],
  );

  return <primitive object={mirror} />;
}

/* ---------- Atmosphere ---------- */

function Sky({ shared }: { shared: SharedUniforms }) {
  const material = useMemo(() => skyMaterial(shared), [shared]);
  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[10, 24, 16]} />
    </mesh>
  );
}

function Motes({ shared }: { shared: SharedUniforms }) {
  const { geometry, material } = useMemo(() => {
    const count = 130;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80 - 4;
      positions[i * 3 + 1] = Math.random() * 14;
      positions[i * 3 + 2] = Math.random() * 52 + 12;
      seeds[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return { geometry: g, material: moteMaterial(shared) };
  }, [shared]);
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/* ---------- Camera: opening move, cursor response, scroll push-in ---------- */

const START = new THREE.Vector3(-20, 58, 256);
const BASE = new THREE.Vector3(-4, 41, 214);
const PUSHED = new THREE.Vector3(-6, 14, 92);
const LOOK = new THREE.Vector3(-4, 18, 0);
const LOOK_START = new THREE.Vector3(-4, 22, 0);
const LOOK_PUSHED = new THREE.Vector3(-6, 9, 0);

const easeOut = (t: number) => 1 - (1 - t) ** 3;

function CameraRig({ rig, shared, tier, onReady, onTooSlow }: { rig: HeroRig; shared: SharedUniforms; tier: Exclude<HeroTier, 'static'>; onReady: () => void; onTooSlow: () => void }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const setDpr = useThree((s) => s.setDpr);
  const smooth = useRef({ x: 0, y: 0 });
  const position = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const perf = useRef({ frames: 0, elapsed: 0, warm: 0, step: 0, strikes: 0, announced: 0, time: 0 });

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const p = perf.current;
    p.time += delta;
    shared.uTime.value = p.time;
    shared.uViewportHeight.value = state.size.height * state.viewport.dpr;

    const follow = 1 - Math.exp(-delta * 2.4);
    smooth.current.x += (rig.pointerX - smooth.current.x) * follow;
    smooth.current.y += (rig.pointerY - smooth.current.y) * follow;

    const opening = easeOut(rig.intro);
    position.lerpVectors(START, BASE, opening);
    look.lerpVectors(LOOK_START, LOOK, opening);
    if (rig.scroll > 0) {
      position.lerp(PUSHED, rig.scroll);
      look.lerp(LOOK_PUSHED, rig.scroll);
    }

    // Tall screens need to stand further back to keep the building in frame.
    const aspect = state.size.width / state.size.height;
    const distance = aspect < 1 ? Math.min(1.15 / aspect, 1.95) : aspect < 1.5 ? 1.5 / aspect : 1;
    position.z *= distance;
    // On a portrait screen the copy takes the lower half, so lift the hotel clear of it.
    if (aspect < 1) look.y -= 7;

    // Moving the camera against a nearly fixed target is what gives the scene its parallax.
    const drift = Math.sin(p.time * 0.13);
    position.x += smooth.current.x * 7.5 + drift * 1.2;
    position.y += smooth.current.y * 3 + Math.sin(p.time * 0.19) * 0.4;
    look.x += smooth.current.x * 1.5;
    look.y += smooth.current.y * 0.7;
    camera.position.copy(position);
    camera.lookAt(look);

    // Tell the page once real frames have reached the screen, then watch the frame rate.
    if (p.announced < 3) {
      p.announced += 1;
      if (p.announced === 3) onReady();
      return;
    }
    p.warm += rawDelta;
    if (p.warm < 2.5) return;
    p.frames += 1;
    p.elapsed += rawDelta;
    if (p.elapsed < 1.5) return;
    const fps = p.frames / p.elapsed;
    p.frames = 0;
    p.elapsed = 0;
    if (fps >= 42) {
      p.strikes = 0;
      return;
    }
    const steps = DPR_STEPS[tier];
    if (p.step < steps.length - 1) {
      p.step += 1;
      setDpr(Math.min(steps[p.step], window.devicePixelRatio || 1));
    } else if (fps < 22 && ++p.strikes >= 2) {
      onTooSlow();
    }
  });

  return null;
}

/* ---------- Canvas ---------- */

interface HotelSceneProps {
  tier: Exclude<HeroTier, 'static'>;
  rig: HeroRig;
  active: boolean;
  onReady: () => void;
  onFailed: () => void;
}

export default function HotelScene({ tier, rig, active, onReady, onFailed }: HotelSceneProps) {
  const shared = useMemo<SharedUniforms>(() => ({ uTime: { value: 0 }, uViewportHeight: { value: 800 } }), []);
  const fog = useMemo(() => new THREE.FogExp2(FOG_COLOR, 0.0011), []);
  const startDpr = Math.min(DPR_STEPS[tier][0], window.devicePixelRatio || 1);

  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={startDpr}
      camera={{ fov: 31, near: 8, far: 2400, position: START.toArray() }}
      gl={{ antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        scene.fog = fog;
        gl.toneMappingExposure = 1.04;
        gl.domElement.addEventListener('webglcontextlost', onFailed, { once: true });
      }}
    >
      <color attach="background" args={['#100f1f']} />
      <Suspense fallback={null}>
        <Sky shared={shared} />
        <HotelModel shared={shared} />
        <Pool tier={tier} shared={shared} />
        {tier === 'high' && <Motes shared={shared} />}
        <CameraRig rig={rig} shared={shared} tier={tier} onReady={onReady} onTooSlow={onFailed} />
      </Suspense>
    </Canvas>
  );
}
