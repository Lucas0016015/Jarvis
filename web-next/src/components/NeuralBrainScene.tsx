////////////////////////////////////////////////////////////////////////////////
// NeuralBrainScene — Pure Three.js brain (no HTML overlays inside Canvas)
////////////////////////////////////////////////////////////////////////////////

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

export type BrainState = 'idle' | 'thinking' | 'speaking' | 'listening' | 'error'

function brainTransform(x: number, yOrig: number, z: number) {
  let y = yOrig
  x *= 1.15; z *= 1.05; y *= 0.82
  const sep = 0.22 * Math.max(0, y + 0.3) * Math.max(0, 1.1 - Math.abs(z) * 0.3)
  x += x > 0 ? sep : -sep
  if (y < -0.35) {
    const t = Math.abs(y + 0.35)
    y -= t * 1.8
    x *= Math.max(0.35, 1.0 - t * 1.2)
    z *= Math.max(0.35, 1.0 - t * 0.9)
  }
  const uw = Math.max(0, y + 0.2) * 0.18
  x *= 1 + uw; z *= 1 + uw * 0.4
  if (y < -0.1 && z > 0.5) {
    const cb = Math.exp(-((y + 0.3) ** 2 + (z - 0.7) ** 2) * 8)
    z += cb * 0.35; y -= cb * 0.15
  }
  const gyroid = (
    Math.sin(x * 3.8) * Math.cos(y * 3.8) +
    Math.sin(y * 3.8) * Math.cos(z * 3.8) +
    Math.sin(z * 3.8) * Math.cos(x * 3.8)
  )
  const r = Math.sqrt(x * x + y * y + z * z)
  if (r > 0.25) {
    const foldAmp = 0.08 + 0.06 * Math.sin(y * 7)
    const mod = 1.0 + gyroid * foldAmp / Math.max(r, 0.4)
    x *= mod; y *= mod; z *= mod
  }
  const finalR = Math.sqrt(x * x + y * y + z * z)
  return { x, y, z, inside: finalR <= 1.05 + 0.05 * Math.sin(y * 4) && finalR >= 0.35 }
}

const SURFACE_COUNT = 4000
const ORBIT_COUNT  = 800
const ORBIT_LAYERS = 5

function generateBrainSurface() {
  const pos: number[] = [], base: number[] = [], sz: number[] = [], ph: number[] = [], sp: number[] = []
  let attempts = 0
  while (pos.length / 3 < SURFACE_COUNT && attempts < SURFACE_COUNT * 50) {
    attempts++
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 0.85 + Math.random() * 0.32
    const bx = r * Math.sin(phi) * Math.cos(theta)
    const by = r * Math.cos(phi)
    const bz = r * Math.sin(phi) * Math.sin(theta)
    const t = brainTransform(bx, by, bz)
    if (!t.inside) continue
    pos.push(t.x + (Math.random() - 0.5) * 0.03)
    pos.push(t.y + (Math.random() - 0.5) * 0.03)
    pos.push(t.z + (Math.random() - 0.5) * 0.03)
    base.push(t.x, t.y, t.z)
    sz.push(1.8 + Math.random() * 7.0)
    ph.push(Math.random() * Math.PI * 2)
    sp.push(0.4 + Math.random() * 1.4)
  }
  return {
    positions: new Float32Array(pos),
    basePositions: new Float32Array(base),
    sizes: new Float32Array(sz),
    phases: new Float32Array(ph),
    speeds: new Float32Array(sp),
  }
}

function generateLinks(surface: Float32Array) {
  const MAX = 0.28, links: number[] = [], pr: number[] = []
  const count = surface.length / 3
  for (let a = 0; a < Math.min(count, 900); a++) {
    for (let b = a + 1; b < Math.min(count, 900); b++) {
      const dx = surface[a * 3] - surface[b * 3]
      const dy = surface[a * 3 + 1] - surface[b * 3 + 1]
      const dz = surface[a * 3 + 2] - surface[b * 3 + 2]
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 < MAX * MAX && Math.random() > 0.55) {
        links.push(surface[a*3], surface[a*3+1], surface[a*3+2], surface[b*3], surface[b*3+1], surface[b*3+2])
        pr.push(Math.random())
      }
    }
  }
  return { positions: new Float32Array(links), progresses: new Float32Array(pr) }
}

function generateOrbitNeurons() {
  const pos = new Float32Array(ORBIT_COUNT * 3), sz = new Float32Array(ORBIT_COUNT), ph = new Float32Array(ORBIT_COUNT)
  for (let i = 0; i < ORBIT_COUNT; i++) {
    const layer = Math.floor(Math.random() * ORBIT_LAYERS)
    const angle = (i % 250) * (Math.PI * 2 / 250) + (Math.random() - 0.5) * 0.3
    const rx = 2.0 + layer * 0.85 + (Math.random() - 0.5) * 0.4
    const rz = 1.6 + layer * 0.65 + (Math.random() - 0.5) * 0.35
    const y = (layer - ORBIT_LAYERS / 2) * 0.45 + (Math.random() - 0.5) * 0.5
    pos[i * 3] = Math.cos(angle) * rx
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = Math.sin(angle) * rz
    sz[i] = 1.5 + Math.random() * 5.5
    ph[i] = Math.random() * Math.PI * 2
  }
  return { positions: pos, sizes: sz, phases: ph }
}

const SURFACE_VS = `
  attribute float aSize, aPhase, aSpeed; attribute vec3 aBase;
  uniform float uTime, uState, uPixelRatio;
  varying float vAlpha; varying vec3 vColor;
  void main() {
    vec3 pos = aBase;
    float sp = 1.0 + uState * 3.0;
    float nx = sin(aBase.y * 4.0 + uTime * 0.5 * aSpeed * sp + aPhase) * 0.06;
    float ny = cos(aBase.x * 3.5 + uTime * 0.4 * aSpeed * sp + aPhase * 1.3) * 0.05;
    float nz = sin(aBase.z * 3.0 + uTime * 0.6 * aSpeed * sp + aPhase * 0.7) * 0.04;
    pos += vec3(nx, ny, nz);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * uPixelRatio * (200.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
    float pulse = 0.5 + sin(uTime * 3.0 + aPhase * 4.0) * 0.5;
    vAlpha = 0.25 + pulse * 0.5;
    // idle: blue-violet, thinking: violet-magenta, speaking: cian-turquoise
    vec3 idle    = mix(vec3(0.27,0.53,1.0), vec3(0.53,0.27,1.0), uState * 0.5);
    vec3 think   = mix(vec3(0.67,0.27,1.0), vec3(1.0,0.27,0.67), uState - 1.0);
    vec3 speak   = mix(vec3(0.0,0.83,1.0), vec3(0.27,1.0,0.80), max(0.0, uState - 1.0));
    vColor = uState < 1.0 ? idle : uState < 2.0 ? think : speak;
  }`

const SURFACE_FS = `
  varying float vAlpha; varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float glow = pow(1.0 - d * 2.0, 3.5);
    float alpha = glow * vAlpha + core * 0.9;
    vec3 col = vColor * (glow * 0.7 + core * 2.5);
    col += core * vColor * 0.6;
    gl_FragColor = vec4(col, alpha);
  }`

const LINK_VS = `
  uniform float uTime, uState; attribute float aProgress;
  varying float vAlpha;
  void main() {
    vec3 pos = position;
    float sp = 1.0 + uState * 2.0;
    pos += sin(uTime * 0.7 * sp + aProgress * 12.0) * 0.04;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    vAlpha = 0.06 + sin(uTime * 1.5 + aProgress * 6.28) * 0.05;
  }`

const LINK_FS = `
  uniform vec3 uColor; varying float vAlpha;
  void main() { gl_FragColor = vec4(uColor, vAlpha); }
`

const ORBIT_VS = `
  attribute float aSize, aPhase;
  uniform float uTime, uState, uPixelRatio;
  varying float vAlpha; varying vec3 vColor;
  void main() {
    vec3 pos = position;
    float sp = 1.0 + uState * 2.5;
    float w = sin(uTime * 0.3 * sp + aPhase) * 0.12;
    pos += normalize(pos + 0.001) * w;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * uPixelRatio * (160.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
    float pulse = 0.4 + sin(uTime * 2.0 + aPhase * 3.0) * 0.35;
    vAlpha = 0.2 + pulse * 0.35;
    vec3 idle  = mix(vec3(0.27,0.53,1.0), vec3(0.53,0.27,1.0), uState * 0.5);
    vec3 think = mix(vec3(0.67,0.27,1.0), vec3(1.0,0.27,0.67), uState - 1.0);
    vec3 speak = mix(vec3(0.0,0.83,1.0), vec3(0.27,1.0,0.80), max(0.0, uState - 1.0));
    vColor = uState < 1.0 ? idle : uState < 2.0 ? think : speak;
  }`

const ORBIT_FS = `
  varying float vAlpha; varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float glow = pow(1.0 - d * 2.0, 3.0);
    gl_FragColor = vec4(vColor * (glow + core * 3.0), glow * vAlpha + core * 0.8);
  }`

function HoloShell() {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.08
      meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.05) * 0.1
    }
  })
  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.15, 1]} />
      <meshBasicMaterial
        color={new THREE.Color(0.27, 0.53, 1.0)}
        wireframe
        transparent
        opacity={0.12}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

function BrainParticles({ state }: { state: BrainState }) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const { positions, basePositions, sizes, phases, speeds } = useMemo(generateBrainSurface, [])
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uState: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } }), [])
  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value = clock.getElapsedTime()
    matRef.current.uniforms.uState.value = state === 'thinking' ? 1 : state === 'speaking' ? 2 : 0
  })
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={SURFACE_COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aBase" count={SURFACE_COUNT} array={basePositions} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" count={SURFACE_COUNT} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-aPhase" count={SURFACE_COUNT} array={phases} itemSize={1} />
        <bufferAttribute attach="attributes-aSpeed" count={SURFACE_COUNT} array={speeds} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial ref={matRef} vertexShader={SURFACE_VS} fragmentShader={SURFACE_FS} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

function BrainLinks({ state }: { state: BrainState }) {
  const surfaceData = useMemo(generateBrainSurface, [])
  const links = useMemo(() => generateLinks(surfaceData.positions), [surfaceData])
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uState: { value: 0 }, uColor: { value: new THREE.Color(0.27, 0.53, 1.0) } }), [])
  useFrame(({ clock }) => {
    if (!matRef.current) return
    const t = clock.getElapsedTime()
    const uState = state === 'thinking' ? 1 : state === 'speaking' ? 2 : 0
    matRef.current.uniforms.uTime.value = t
    matRef.current.uniforms.uState.value = uState
    const cIdle = new THREE.Color(0.27, 0.53, 1.0), cThink = new THREE.Color(0.67, 0.27, 1.0), cSpeak = new THREE.Color(0.0, 0.83, 1.0)
    const target = uState < 1 ? cIdle : uState < 2 ? cThink : cSpeak
    matRef.current.uniforms.uColor.value.lerp(target, 0.04)
  })
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={links.positions.length / 3} array={links.positions} itemSize={3} />
        <bufferAttribute attach="attributes-aProgress" count={links.progresses.length} array={links.progresses} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial ref={matRef} vertexShader={LINK_VS} fragmentShader={LINK_FS} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  )
}

function OrbitNeurons({ state }: { state: BrainState }) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const { positions, sizes, phases } = useMemo(generateOrbitNeurons, [])
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uState: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } }), [])
  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value = clock.getElapsedTime()
    matRef.current.uniforms.uState.value = state === 'thinking' ? 1 : state === 'speaking' ? 2 : 0
  })
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={ORBIT_COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" count={ORBIT_COUNT} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-aPhase" count={ORBIT_COUNT} array={phases} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial ref={matRef} vertexShader={ORBIT_VS} fragmentShader={ORBIT_FS} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

function CoreGlow({ state }: { state: BrainState }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const color = useMemo(() => new THREE.Color(0.27, 0.53, 1.0), [])
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()
    meshRef.current.scale.setScalar(1 + Math.sin(t * 0.6) * 0.03)
    const uState = state === 'thinking' ? 1 : state === 'speaking' ? 2 : 0
    const cIdle = new THREE.Color(0.27, 0.53, 1.0), cThink = new THREE.Color(0.67, 0.27, 1.0), cSpeak = new THREE.Color(0.0, 0.83, 1.0)
    const target = uState < 1 ? cIdle : uState < 2 ? cThink : cSpeak
    ;(meshRef.current.material as THREE.MeshBasicMaterial).color.lerp(target, 0.04)
  })
  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[0.75, 2]} />
      <meshBasicMaterial color={color} transparent opacity={0.06} depthWrite={false} />
    </mesh>
  )
}

function Scene({ state }: { state: BrainState }) {
  const groupRef = useRef<THREE.Group>(null)
  useFrame(() => { if (groupRef.current) groupRef.current.rotation.y += 0.0009 })
  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.015} />
      <pointLight position={[3, 2, 4]} intensity={0.6} color="#4466ff" />
      <pointLight position={[-3, -1, -2]} intensity={0.4} color="#8833cc" />
      <pointLight position={[0, -3, 3]} intensity={0.3} color="#4422aa" />
      <CoreGlow state={state} />
      <HoloShell />
      <BrainParticles state={state} />
      <BrainLinks state={state} />
      <OrbitNeurons state={state} />
    </group>
  )
}

export default function NeuralBrainScene({ state = 'idle' }: { state?: BrainState }) {
  return (
    <Canvas
      camera={{ position: [0, 0.15, 3.8], fov: 52, near: 0.01, far: 100 }}
      dpr={Math.min(window.devicePixelRatio, 2)}
      gl={{ antialias: false, alpha: true, premultipliedAlpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color(0, 0, 0), 0)
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.0
      }}
      style={{ background: 'transparent' }}
    >
      <Scene state={state} />
      <EffectComposer>
        <Bloom intensity={2.2} luminanceThreshold={0.18} luminanceSmoothing={0.85} radius={0.75} mipmapBlur />
      </EffectComposer>
    </Canvas>
  )
}