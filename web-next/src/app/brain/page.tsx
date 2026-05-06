'use client';

import React, { Suspense, useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';

type BrainState = 'idle' | 'thinking' | 'speaking';

/* =========================================================
   SHADERS  —  Holographic + Fresnel + Scanlines + Gradient
   ========================================================= */

const HOLO_VS = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const HOLO_FS = `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  uniform float uTime;
  uniform float uState;

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.2);

    // Neon reference palette: deep magenta → hot pink → electric cyan
    vec3 cMagenta   = vec3(0.95, 0.0,  0.85);
    vec3 cPink      = vec3(1.0,  0.4,  0.9);
    vec3 cCyan      = vec3(0.0,  0.85, 1.0);
    vec3 cDeepBlue  = vec3(0.05, 0.0,  0.35);
    vec3 cThink     = vec3(1.0,  0.55, 0.0);
    vec3 cSpeak     = vec3(0.5,  1.0,  0.85);

    float yWave = sin(vWorldPosition.y * 3.0 + uTime * 1.5) * 0.5 + 0.5;
    vec3 baseColor = mix(cDeepBlue, cMagenta, yWave * 0.6);
    baseColor = mix(baseColor, cPink, fresnel * 1.2);
    baseColor = mix(baseColor, cCyan, pow(fresnel, 2.0) * 0.9);

    if (uState > 0.5 && uState < 1.5) {
      baseColor = mix(baseColor, cThink, 0.4 + sin(uTime * 4.0) * 0.1);
    } else if (uState >= 1.5) {
      baseColor = mix(baseColor, cSpeak, 0.45 + sin(uTime * 5.0) * 0.15);
    }

    // Stronger scanlines
    float scan = sin(vWorldPosition.y * 55.0 + uTime * 4.0) * 0.12;
    float fineGrid = sin(vWorldPosition.x * 70.0 + vWorldPosition.z * 50.0 + uTime * 2.0) * 0.04;
    float pulse = sin(uTime * 2.5 + vWorldPosition.x * 2.5) * 0.08;

    float alpha = 0.08 + fresnel * 0.92 + scan * 0.4 + fineGrid * 0.3;

    vec3 finalColor = baseColor * (1.5 + fresnel * 4.0 + pulse);
    finalColor += scan * cCyan * 0.7;
    finalColor += fineGrid * cPink * 0.5;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const WIRE_VS = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const WIRE_FS = `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform float uTime;
  uniform float uState;

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.0);

    vec3 cCyan    = vec3(0.0,  0.9,  1.0);
    vec3 cMagenta = vec3(1.0,  0.3,  0.95);
    vec3 cThink   = vec3(1.0,  0.55, 0.0);
    vec3 cSpeak   = vec3(0.45, 1.0,  0.75);

    vec3 col = mix(cMagenta, cCyan, fresnel * 1.2);
    if (uState > 0.5 && uState < 1.5) col = mix(col, cThink, 0.55);
    else if (uState >= 1.5) col = mix(col, cSpeak, 0.65);

    float edgeGlow = pow(fresnel, 1.5);
    float alpha = edgeGlow * 0.85 + 0.15;
    vec3 finalCol = col * (1.5 + edgeGlow * 4.0);

    gl_FragColor = vec4(finalCol, alpha);
  }
`;

const PARTICLE_VS = `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uState;
  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    vec3 pos = position;
    float sp = 1.0 + uState * 2.0;
    float wobble = sin(uTime * 0.5 * sp + aPhase) * 0.15;
    pos += normalize(pos + 0.001) * wobble;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * uPixelRatio * (200.0 / -mv.z);
    gl_Position = projectionMatrix * mv;

    float pulse = 0.4 + sin(uTime * 2.0 + aPhase * 3.0) * 0.35;
    vAlpha = 0.25 + pulse * 0.4;

    vec3 cCyan    = vec3(0.0, 0.85, 1.0);
    vec3 cMagenta = vec3(1.0, 0.0, 1.0);
    vColor = mix(cCyan, cMagenta, 0.5 + sin(aPhase + uTime) * 0.5);
  }
`;

const PARTICLE_FS = `
  precision highp float;
  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float glow = pow(1.0 - d * 2.0, 3.0);
    gl_FragColor = vec4(vColor * (glow + core * 3.0), glow * vAlpha + core * 0.8);
  }
`;

/* =========================================================
   FALLBACK BRAIN — Procedural if STL fails
   ========================================================= */

function ProceduralBrain({ state }: { state: BrainState }) {
  const groupRef = useRef<THREE.Group>(null);
  const holoMatRef = useRef<THREE.ShaderMaterial>(null);
  const wireMatRef = useRef<THREE.ShaderMaterial>(null);

  const geo = useMemo(() => {
    // Create a distorted icosahedron to simulate brain-ish shape
    const baseGeo = new THREE.IcosahedronGeometry(1.3, 6);
    const pos = baseGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const noise = Math.sin(v.x * 3.5) * Math.cos(v.y * 2.8) * Math.sin(v.z * 4.2);
      const dist = 1.0 + noise * 0.18 + Math.sin(v.y * 6.0) * 0.08;
      // Bulge front/back to make it more brain-like
      const brainShape = dist * (1.0 + Math.cos(v.z * 2.0) * 0.08);
      v.multiplyScalar(brainShape);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    baseGeo.computeVertexNormals();
    baseGeo.rotateX(-Math.PI / 2);
    return baseGeo;
  }, []);

  const holoUniforms = useMemo(() => ({ uTime: { value: 0 }, uState: { value: 0 } }), []);
  const wireUniforms = useMemo(() => ({ uTime: { value: 0 }, uState: { value: 0 } }), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const s = state === 'thinking' ? 1 : state === 'speaking' ? 2 : 0;
    if (holoMatRef.current) { holoMatRef.current.uniforms.uTime.value = t; holoMatRef.current.uniforms.uState.value = s; }
    if (wireMatRef.current) { wireMatRef.current.uniforms.uTime.value = t; wireMatRef.current.uniforms.uState.value = s; }
    if (groupRef.current) groupRef.current.rotation.y += 0.002;
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geo}>
        <shaderMaterial ref={holoMatRef} vertexShader={HOLO_VS} fragmentShader={HOLO_FS} uniforms={holoUniforms} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh geometry={geo}>
        <shaderMaterial ref={wireMatRef} vertexShader={WIRE_VS} fragmentShader={WIRE_FS} uniforms={wireUniforms} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} wireframe />
      </mesh>
    </group>
  );
}

/* =========================================================
   BRAIN MODEL  —  Load STL + Center + Scale + Dual Shader
   ========================================================= */

function BrainModel({ state }: { state: BrainState }) {
  const rawGeo = useLoader(STLLoader, '/brain.stl');
  const groupRef = useRef<THREE.Group>(null);
  const holoMatRef = useRef<THREE.ShaderMaterial>(null);
  const wireMatRef = useRef<THREE.ShaderMaterial>(null);

  const processedGeometry = useMemo(() => {
    const geo = rawGeo.clone();
    geo.center();
    const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position as THREE.BufferAttribute);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2.8 / maxDim;
    geo.scale(scale, scale, scale);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [rawGeo]);

  const holoUniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uState: { value: 0 },
  }), []);

  const wireUniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uState: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const s = state === 'thinking' ? 1 : state === 'speaking' ? 2 : 0;

    if (holoMatRef.current) {
      holoMatRef.current.uniforms.uTime.value = t;
      holoMatRef.current.uniforms.uState.value = s;
    }
    if (wireMatRef.current) {
      wireMatRef.current.uniforms.uTime.value = t;
      wireMatRef.current.uniforms.uState.value = s;
    }
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Holographic solid shell */}
      <mesh geometry={processedGeometry}>
        <shaderMaterial
          ref={holoMatRef}
          vertexShader={HOLO_VS}
          fragmentShader={HOLO_FS}
          uniforms={holoUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Glowing wireframe overlay */}
      <mesh geometry={processedGeometry}>
        <shaderMaterial
          ref={wireMatRef}
          vertexShader={WIRE_VS}
          fragmentShader={WIRE_FS}
          uniforms={wireUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          wireframe
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   ORBIT PARTICLES
   ========================================================= */

const ORBIT_COUNT = 2000;
const ORBIT_LAYERS = 8;

function generateOrbitParticles() {
  const positions = new Float32Array(ORBIT_COUNT * 3);
  const sizes = new Float32Array(ORBIT_COUNT);
  const phases = new Float32Array(ORBIT_COUNT);

  for (let i = 0; i < ORBIT_COUNT; i++) {
    const layer = Math.floor(Math.random() * ORBIT_LAYERS);
    const angle = (i % 300) * (Math.PI * 2 / 300) + (Math.random() - 0.5) * 0.3;
    const rx = 2.2 + layer * 0.9 + (Math.random() - 0.5) * 0.5;
    const rz = 1.8 + layer * 0.7 + (Math.random() - 0.5) * 0.4;
    const y = (layer - ORBIT_LAYERS / 2) * 0.5 + (Math.random() - 0.5) * 0.6;

    positions[i * 3]     = Math.cos(angle) * rx;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(angle) * rz;

    sizes[i]  = 1.5 + Math.random() * 6.0;
    phases[i] = Math.random() * Math.PI * 2;
  }
  return { positions, sizes, phases };
}

function OrbitParticles({ state }: { state: BrainState }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, sizes, phases } = useMemo(generateOrbitParticles, []);

  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) },
    uState:      { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    matRef.current.uniforms.uState.value = state === 'thinking' ? 1 : state === 'speaking' ? 2 : 0;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={ORBIT_COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aSize"    count={ORBIT_COUNT} array={sizes}     itemSize={1} />
        <bufferAttribute attach="attributes-aPhase"   count={ORBIT_COUNT} array={phases}    itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={PARTICLE_VS}
        fragmentShader={PARTICLE_FS}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* =========================================================
   LOADER UI
   ========================================================= */

function HolographicLoader() {
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center w-full h-full pointer-events-none">
      <div className="relative">
        <div className="w-16 h-16 border-2 border-[rgba(255,0,220,0.4)] rounded-full animate-spin"
             style={{ borderTopColor: '#ff00dc', boxShadow: '0 0 20px rgba(255,0,220,0.4)' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full"
               style={{ background: '#ff00dc', boxShadow: '0 0 15px #ff00dc' }} />
        </div>
      </div>
      <p className="mt-5 text-[10px] tracking-[4px] uppercase"
         style={{ color: 'rgba(255,0,220,0.7)', textShadow: '0 0 12px rgba(255,0,220,0.5)' }}>
        Loading Neural Model
      </p>
      </div>
    </Html>
  );
}

/* =========================================================
   SCENE & POST-PROCESSING
   ========================================================= */

function Scene({ state }: { state: BrainState }) {
  return (
    <>
      <ambientLight intensity={0.02} />
      <pointLight position={[3, 2, 4]}  intensity={0.6} color="#00aaff" />
      <pointLight position={[-3, -1, -2]} intensity={0.4} color="#ff00ff" />
      <pointLight position={[0, -3, 3]}  intensity={0.3} color="#004488" />

      <BrainModel state={state} />
      <OrbitParticles state={state} />
    </>
  );
}

function PostFX({ state }: { state: BrainState }) {
  const intensity = state === 'thinking' ? 3.5 : state === 'speaking' ? 4.0 : 2.5;
  return (
    <EffectComposer>
      <Bloom
        intensity={intensity}
        luminanceThreshold={0.015}
        luminanceSmoothing={1.0}
        mipmapBlur
        radius={1.2}
      />
    </EffectComposer>
  );
}

/* =========================================================
   PAGE
   ========================================================= */

export default function BrainHologramPage() {
  const [state, setState] = useState<BrainState>('idle');

  const stateColor = state === 'thinking' ? '#ffaa00' : state === 'speaking' ? '#00ffcc' : '#00ff88';
  const stateLabel = state === 'thinking' ? 'Processing Neural Patterns' : state === 'speaking' ? 'Transmitting Intelligence' : 'Neural Link Active';

  return (
    <main className="w-screen h-screen bg-black relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-6 left-7 z-10 pointer-events-none">
        <h1
          className="text-xl font-bold tracking-[10px] text-[#00f2ff]"
          style={{ textShadow: '0 0 30px rgba(0,242,255,0.9), 0 0 60px rgba(0,242,255,0.4)' }}
        >
          JARVIS
        </h1>
        <p className="text-[9px] tracking-[4px] text-[rgba(0,242,255,0.45)] mt-1 uppercase">
          Holographic Neural Interface
        </p>
      </div>

      {/* State toggles */}
      <div className="absolute top-6 right-7 z-10 flex flex-col gap-2">
        {(['idle', 'thinking', 'speaking'] as BrainState[]).map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={`px-4 py-2 text-[9px] uppercase tracking-widest border transition-all duration-300 text-left min-w-[120px] ${
              state === s
                ? 'bg-[rgba(0,242,255,0.2)] border-[#00f2ff] text-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.3)]'
                : 'bg-[rgba(0,242,255,0.05)] border-[rgba(0,242,255,0.3)] text-[rgba(0,242,255,0.7)] hover:bg-[rgba(0,242,255,0.12)]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Status indicator */}
      <div className="absolute bottom-7 left-7 z-10 flex items-center gap-3 pointer-events-none">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{
            background: stateColor,
            boxShadow: `0 0 15px ${stateColor}`,
            animation: 'pulse 2s infinite',
          }}
        />
        <span
          className="text-[10px] tracking-[3px] uppercase font-mono"
          style={{ color: stateColor }}
        >
          {stateLabel}
        </span>
      </div>

      {/* Hint */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-[9px] tracking-[3px] text-[rgba(0,242,255,0.3)] text-center font-mono">
        DRAG TO ROTATE · SCROLL TO ZOOM
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50, near: 0.01, far: 100 }}
        dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#000008'));
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.3;
        }}
      >
        <color attach="background" args={['#000008']} />
        <fog attach="fog" args={['#000015', 6, 14]} />

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={2.5}
          maxDistance={8}
          dampingFactor={0.05}
          rotateSpeed={0.5}
          autoRotate={false}
        />

        <Suspense fallback={<HolographicLoader />}>
          <Scene state={state} />
          <PostFX state={state} />
        </Suspense>
      </Canvas>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.6; }
        }
      `}</style>
    </main>
  );
}
