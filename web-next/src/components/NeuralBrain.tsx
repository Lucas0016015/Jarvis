import { useRef, useMemo, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

/* ────────────────────────────────────────────────────────────
   NEURAL BRAIN 3D — Brain-Shaped Particles (Not a sphere!)
   Uses a mathematical brain deformation instead of a sphere.
   ──────────────────────────────────────────────────────────── */

type BrainState = 'idle' | 'thinking' | 'speaking'

interface NeuralBrainProps {
  state?: BrainState
}

/* ── Brain Shape Transformation ───────────────────────────────
   Transforms a sphere point into a brain-like shape:
   - Two hemispheres with a slight separation
   - Flattened bottom (brainstem-like protrusion)
   - Organic folds via gyroid noise (gyri/sulci)
   - Wider top (cerebrum), narrower bottom (brainstem)
   ─────────────────────────────────────────────────────────── */

function brainTransform(x: number, yOrig: number, z: number): { x: number; y: number; z: number; inside: boolean } {
  let y = yOrig

  // 1. Ellipsoid base: stretch X and Z, compress Y slightly
  x *= 1.15
  z *= 1.05
  y *= 0.82

  // 2. Hemispheric separation — wider at top, none at bottom
  const sep = 0.22 * Math.max(0, y + 0.3) * Math.max(0, 1.1 - Math.abs(z) * 0.3)
  x += x > 0 ? sep : -sep

  // 3. Brainstem protrusion: elongate and narrow at bottom
  if (y < -0.35) {
    const t = Math.abs(y + 0.35) // how far below -0.35
    y -= t * 1.8                 // elongate downward
    x *= Math.max(0.35, 1.0 - t * 1.2)
    z *= Math.max(0.35, 1.0 - t * 0.9)
  }

  // 4. Widen the upper cerebrum
  const upperWidening = Math.max(0, y + 0.2) * 0.18
  x *= 1 + upperWidening
  z *= 1 + upperWidening * 0.4

  // 5. Cerebellum bump at back-bottom
  if (y < -0.1 && z > 0.5) {
    const cerebellar = Math.exp(-((y + 0.3) ** 2 + (z - 0.7) ** 2) * 8)
    z += cerebellar * 0.35
    y -= cerebellar * 0.15
  }

  // 6. Organic folds (gyri/sulci) via gyroid
  const gyroid = (
    Math.sin(x * 3.8) * Math.cos(y * 3.8) +
    Math.sin(y * 3.8) * Math.cos(z * 3.8) +
    Math.sin(z * 3.8) * Math.cos(x * 3.8)
  )
  const r = Math.sqrt(x * x + y * y + z * z)
  if (r > 0.25) {
    const foldAmp = 0.08 + 0.06 * Math.sin(y * 7) // folds vary by height
    const mod = 1.0 + gyroid * foldAmp / Math.max(r, 0.4)
    x *= mod
    y *= mod
    z *= mod
  }

  // 7. Rejection test: ensure we are within "skin"
  const finalR = Math.sqrt(x * x + y * y + z * z)
  const skinRadius = 1.0 + 0.05 * Math.sin(y * 4) // slightly bumpy skin

  return { x, y, z, inside: finalR <= skinRadius && finalR >= 0.35 }
}

/* ── Particle Generation ──────────────────────────────────── */

const SURFACE_COUNT = 4000
const ORBIT_COUNT = 1500
const ORBIT_LAYERS = 7

function generateBrainSurface() {
  const positions: number[] = []
  const sizes: number[] = []
  const phases: number[] = []
  const speeds: number[] = []
  const basePositions: number[] = []

  let attempts = 0
  while (positions.length / 3 < SURFACE_COUNT && attempts < SURFACE_COUNT * 50) {
    attempts++
    // Uniform sphere sample
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 0.85 + Math.random() * 0.32 // bias toward outer shell

    const bx = r * Math.sin(phi) * Math.cos(theta)
    const by = r * Math.cos(phi)
    const bz = r * Math.sin(phi) * Math.sin(theta)

    const t = brainTransform(bx, by, bz)
    if (!t.inside) continue

    // Only keep points close to the "surface" (narrow shell)
    positions.push(t.x + (Math.random() - 0.5) * 0.03)
    positions.push(t.y + (Math.random() - 0.5) * 0.03)
    positions.push(t.z + (Math.random() - 0.5) * 0.03)
    basePositions.push(t.x, t.y, t.z)

    sizes.push(1.8 + Math.random() * 7.0)
    phases.push(Math.random() * Math.PI * 2)
    speeds.push(0.4 + Math.random() * 1.4)
  }

  return {
    positions: new Float32Array(positions),
    basePositions: new Float32Array(basePositions),
    sizes: new Float32Array(sizes),
    phases: new Float32Array(phases),
    speeds: new Float32Array(speeds)
  }
}

function generateLinks(surfacePositions: Float32Array) {
  const MAX_DIST = 0.28
  const links: number[] = []
  const progresses: number[] = []

  const count = surfacePositions.length / 3
  for (let a = 0; a < Math.min(count, 900); a++) {
    for (let b = a + 1; b < Math.min(count, 900); b++) {
      const dx = surfacePositions[a * 3] - surfacePositions[b * 3]
      const dy = surfacePositions[a * 3 + 1] - surfacePositions[b * 3 + 1]
      const dz = surfacePositions[a * 3 + 2] - surfacePositions[b * 3 + 2]
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 < MAX_DIST * MAX_DIST && Math.random() > 0.55) {
        links.push(
          surfacePositions[a * 3], surfacePositions[a * 3 + 1], surfacePositions[a * 3 + 2],
          surfacePositions[b * 3], surfacePositions[b * 3 + 1], surfacePositions[b * 3 + 2]
        )
        progresses.push(Math.random())
      }
    }
  }
  return {
    positions: new Float32Array(links),
    progresses: new Float32Array(progresses)
  }
}

function generateOrbitNeurons() {
  const positions = new Float32Array(ORBIT_COUNT * 3)
  const sizes = new Float32Array(ORBIT_COUNT)
  const phases = new Float32Array(ORBIT_COUNT)

  for (let i = 0; i < ORBIT_COUNT; i++) {
    const layer = Math.floor(Math.random() * ORBIT_LAYERS)
    const angle = (i % 250) * (Math.PI * 2 / 250) + (Math.random() - 0.5) * 0.3
    // Elliptical orbit: wider in X, narrower in Z
    const rx = 2.0 + layer * 0.85 + (Math.random() - 0.5) * 0.4
    const rz = 1.6 + layer * 0.65 + (Math.random() - 0.5) * 0.35
    const y = (layer - ORBIT_LAYERS / 2) * 0.45 + (Math.random() - 0.5) * 0.5

    positions[i * 3] = Math.cos(angle) * rx
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = Math.sin(angle) * rz

    sizes[i] = 1.5 + Math.random() * 5.5
    phases[i] = Math.random() * Math.PI * 2
  }
  return { positions, sizes, phases }
}

/* ── Shaders ──────────────────────────────────────────────── */

const SURFACE_VS = `
  precision mediump float;
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute vec3  aBase;
  uniform float uTime;
  uniform float uState;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    vec3 pos = aBase;
    float sp = 1.0 + uState * 3.0;

    // Organic displacement simulating neural activation
    float nx = sin(aBase.y * 4.0 + uTime * 0.5 * aSpeed * sp + aPhase) * 0.06;
    float ny = cos(aBase.x * 3.5 + uTime * 0.4 * aSpeed * sp + aPhase * 1.3) * 0.05;
    float nz = sin(aBase.z * 3.0 + uTime * 0.6 * aSpeed * sp + aPhase * 0.7) * 0.04;
    pos += vec3(nx, ny, nz);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * uPixelRatio * (200.0 / -mv.z);
    gl_Position = projectionMatrix * mv;

    float pulse = 0.5 + sin(uTime * 3.0 + aPhase * 4.0) * 0.5;
    vAlpha = 0.25 + pulse * 0.5;

    vec3 ci = vec3(0.0, 0.85, 1.0);
    vec3 ct = vec3(1.0, 0.5, 0.0);
    vec3 cs = vec3(0.0, 1.0, 0.6);
    vColor = mix(mix(ci, ct, uState), cs, max(0.0, uState - 1.0));
  }
`

const SURFACE_FS = `
  precision mediump float;
  varying float vAlpha;
  varying vec3  vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float glow = pow(1.0 - d * 2.0, 3.5);
    float alpha = glow * vAlpha + core * 0.9;
    vec3 col = vColor * (glow * 0.7 + core * 2.5);
    col += core * vColor * 0.6;
    gl_FragColor = vec4(col, alpha);
  }
`

const LINK_VS = `
  precision mediump float;
  uniform float uTime;
  uniform float uState;
  attribute float aProgress;
  varying float vAlpha;
  void main() {
    vec3 pos = position;
    float sp = 1.0 + uState * 2.0;
    pos += sin(uTime * 0.7 * sp + aProgress * 12.0) * 0.04;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    vAlpha = 0.06 + sin(uTime * 1.5 + aProgress * 6.28) * 0.05;
  }
`

const LINK_FS = `
  precision mediump float;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor, vAlpha);
  }
`

const ORBIT_VS = `
  precision mediump float;
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uState;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying vec3  vColor;
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
    vec3 ci = vec3(0.0, 0.75, 1.0), ct = vec3(1.0, 0.4, 0.0), cs = vec3(0.0, 0.95, 0.55);
    vColor = mix(mix(ci, ct, uState), cs, max(0.0, uState - 1.0));
  }
`

const ORBIT_FS = `
  precision mediump float;
  varying float vAlpha;
  varying vec3  vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float glow = pow(1.0 - d * 2.0, 3.0);
    gl_FragColor = vec4(vColor * (glow + core * 3.0), glow * vAlpha + core * 0.8);
  }
`

/* ── Sub-Components ──────────────────────────────────────── */

function BrainParticles({ state }: { state: BrainState }) {
  const meshRef = useRef<THREE.Points>(null)
  const matRef  = useRef<THREE.ShaderMaterial>(null)

  const { positions, basePositions, sizes, phases, speeds } = useMemo(generateBrainSurface, [])

  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uState:      { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
  }), [])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    const t = clock.getElapsedTime()
    matRef.current.uniforms.uTime.value = t
    matRef.current.uniforms.uState.value = state === 'thinking' ? 1 : state === 'speaking' ? 2 : 0
  })

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={SURFACE_COUNT} array={positions}   itemSize={3} />
        <bufferAttribute attach="attributes-aBase"   count={SURFACE_COUNT} array={basePositions} itemSize={3} />
        <bufferAttribute attach="attributes-aSize"   count={SURFACE_COUNT} array={sizes}       itemSize={1} />
        <bufferAttribute attach="attributes-aPhase"   count={SURFACE_COUNT} array={phases}      itemSize={1} />
        <bufferAttribute attach="attributes-aSpeed"   count={SURFACE_COUNT} array={speeds}      itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={SURFACE_VS}
        fragmentShader={SURFACE_FS}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function BrainLinks({ state }: { state: BrainState }) {
  const surfaceData = useMemo(generateBrainSurface, [])
  const links       = useMemo(() => generateLinks(surfaceData.positions), [surfaceData])
  const matRef      = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uState: { value: 0 },
    uColor: { value: new THREE.Color(0, 0.50, 0.90) }
  }), [])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    const t = clock.getElapsedTime()
    const uState = state === 'thinking' ? 1 : state === 'speaking' ? 2 : 0
    matRef.current.uniforms.uTime.value = t
    matRef.current.uniforms.uState.value = uState

    const cIdle  = new THREE.Color(0, 0.50, 0.90)
    const cThink = new THREE.Color(1, 0.42, 0)
    const cSpeak = new THREE.Color(0, 0.88, 0.50)
    const target = uState < 1 ? cIdle : uState < 2 ? cThink : cSpeak
    matRef.current.uniforms.uColor.value.lerp(target, 0.05)
  })

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={links.positions.length / 3} array={links.positions} itemSize={3} />
        <bufferAttribute attach="attributes-aProgress" count={links.progresses.length}   array={links.progresses} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={LINK_VS}
        fragmentShader={LINK_FS}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}

function OrbitNeurons({ state }: { state: BrainState }) {
  const meshRef = useRef<THREE.Points>(null)
  const matRef  = useRef<THREE.ShaderMaterial>(null)

  const { positions, sizes, phases } = useMemo(generateOrbitNeurons, [])

  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uState:      { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
  }), [])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value = clock.getElapsedTime()
    matRef.current.uniforms.uState.value = state === 'thinking' ? 1 : state === 'speaking' ? 2 : 0
  })

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={ORBIT_COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aSize"     count={ORBIT_COUNT} array={sizes}     itemSize={1} />
        <bufferAttribute attach="attributes-aPhase"    count={ORBIT_COUNT} array={phases}    itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={ORBIT_VS}
        fragmentShader={ORBIT_FS}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function CoreGlow({ state }: { state: BrainState }) {
  const meshRef = useRef<THREE.Mesh>(null)

  const color = useMemo(() => new THREE.Color(0, 0.45, 0.95), [])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()
    const pulse = 1 + Math.sin(t * 0.6) * 0.03
    meshRef.current.scale.setScalar(pulse)

    const uState = state === 'thinking' ? 1 : state === 'speaking' ? 2 : 0
    const cIdle  = new THREE.Color(0, 0.45, 0.95)
    const cThink = new THREE.Color(1, 0.40, 0)
    const cSpeak = new THREE.Color(0, 0.85, 0.50)
    const target = uState < 1 ? cIdle : uState < 2 ? cThink : cSpeak

    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.color.lerp(target, 0.04)
  })

  return (
    <mesh ref={meshRef}>
      {/* Deformed icosahedron for core — narrower at bottom */}
      <icosahedronGeometry args={[0.75, 2]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.06}
        depthWrite={false}
      />
    </mesh>
  )
}

function Scene({ state }: { state: BrainState }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y += 0.0012
  })

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.015} />
      <pointLight position={[3, 2, 4]}  intensity={0.6} color="#00aaff" />
      <pointLight position={[-3, -1, -2]} intensity={0.4} color="#0088cc" />
      <pointLight position={[0, -3, 3]}  intensity={0.3} color="#004488" />

      <CoreGlow state={state} />
      <BrainParticles state={state} />
      <BrainLinks state={state} />
      <OrbitNeurons state={state} />
    </group>
  )
}

function PostFX({ state }: { state: BrainState }) {
  const intensity = state === 'thinking' ? 3.0 : state === 'speaking' ? 2.2 : 1.5
  return (
    <EffectComposer>
      <Bloom
        intensity={intensity}
        luminanceThreshold={0.025}
        luminanceSmoothing={0.9}
        radius={0.95}
      />
    </EffectComposer>
  )
}

/* ── Main Export ──────────────────────────────────────────── */

export default function NeuralBrain({ state = 'idle' }: NeuralBrainProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  useEffect(() => {
    // Solo mutamos el contenedor padre, NUNCA document.body global
    const container = containerRef.current
    if (container) {
      container.style.background = '#000008'
      container.style.margin = '0'
      container.style.overflow = 'hidden'
    }
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#000008' }}>
      <Canvas
        camera={{ position: [0, 0.2, 4.2], fov: 55, near: 0.01, far: 100 }}
        dpr={isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2)}
        gl={{ antialias: false, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#000008'))
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.2
        }}
      >
        <color attach="background" args={['#000008']} />
        <fog attach="fog" args={['#000015', 5, 12]} />

        {!isMobile && (
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={2}
            maxDistance={7}
            dampingFactor={0.04}
            rotateSpeed={0.4}
            autoRotate={false}
          />
        )}

        <Scene state={state} />
        <PostFX state={state} />
      </Canvas>

      {/* HUD overlay — JARVIS branding */}
      <div style={{
        position: 'absolute',
        top: 24,
        left: 28,
        color: '#00f2ff',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        letterSpacing: 10,
        fontSize: 20,
        fontWeight: 700,
        pointerEvents: 'none',
        textShadow: '0 0 30px rgba(0,242,255,0.9), 0 0 60px rgba(0,242,255,0.4)',
      }}>
        JARVIS
      </div>
      <div style={{
        position: 'absolute',
        top: 52,
        left: 28,
        color: 'rgba(0,242,255,0.45)',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        letterSpacing: 4,
        fontSize: 9,
        pointerEvents: 'none',
      }}>
        NEURAL QUANTUM INTERFACE
      </div>

      {/* Status dot */}
      <div style={{
        position: 'absolute',
        bottom: 28,
        left: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: state === 'thinking' ? '#ffaa00' : state === 'speaking' ? '#00ffcc' : '#00ff88',
          boxShadow: `0 0 15px ${state === 'thinking' ? '#ffaa00' : state === 'speaking' ? '#00ffcc' : '#00ff88'}`,
          animation: 'pulse 2s infinite',
        }} />
        <span style={{
          color: state === 'thinking' ? '#ffaa00' : state === 'speaking' ? '#00ffcc' : '#00ff88',
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: 10,
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}>
          {state === 'thinking' ? 'Processing Neural Patterns' : state === 'speaking' ? 'Transmitting Intelligence' : 'Neural Link Active'}
        </span>
      </div>

      {/* Hint */}
      <div style={{
        position: 'absolute',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(0,242,255,0.3)',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontSize: 9,
        letterSpacing: 3,
        pointerEvents: 'none',
        textAlign: 'center',
      }}>
        {isMobile ? 'TOUCH TO ORBIT' : 'DRAG TO ROTATE  ·  SCROLL TO ZOOM'}
      </div>

      {/* Inject keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
