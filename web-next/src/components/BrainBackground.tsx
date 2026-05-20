'use client'

import { useRef, useMemo, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import * as THREE from 'three'
import { useJarvisStore } from '@/store/jarvisStore'

/* ──────────────────────────────────────────────────────────────
   JARVIS BRAIN v2 — Ice Material + Particles + States
   Based on brain-3d.html we recreated earlier.
   Now integrated into React Three Fiber with Zustand store.
─────────────────────────────────────────────────────────────── */

/* ── Color Palettes per state ───────────────────────────────── */
const STATE_PALETTE = {
  idle:      { base: 0xd0e8e8, emissive: 0x2a1030, edge: 0x40e0d0, grooveIntensity: 0.55, rimIntensity: 1.4 },
  listening: { base: 0xc8e0e8, emissive: 0x2a3040, edge: 0x00ff88, grooveIntensity: 0.70, rimIntensity: 1.8 },
  thinking:  { base: 0xe8d0e0, emissive: 0x801030, edge: 0xff69b4, grooveIntensity: 0.85, rimIntensity: 2.0 },
  speaking:  { base: 0xd0e8e0, emissive: 0x1a4030, edge: 0x00d4ff, grooveIntensity: 0.50, rimIntensity: 1.5 },
  error:     { base: 0xffa0a0, emissive: 0x401010, edge: 0xff4444, grooveIntensity: 1.00, rimIntensity: 2.2 },
  sleep:     { base: 0x8890a0, emissive: 0x101020, edge: 0x5566aa, grooveIntensity: 0.30, rimIntensity: 0.8 },
}

/* ── Ice Brain Mesh Component ──────────────────────────────── */
function IceBrain() {
  const groupRef = useRef<THREE.Group>(null)
  const mainMeshRef = useRef<THREE.Mesh>(null)
  const innerMeshRef = useRef<THREE.Mesh>(null)
  const glowMeshRef = useRef<THREE.Mesh>(null)
  // Remove unused refs

  const { activityState } = useJarvisStore()
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)

  /* Load STL once */
  useEffect(() => {
    const loader = new STLLoader()
    loader.load('/models/brain.stl', (geo) => {
      geo.computeVertexNormals()
      geo.center()
      setGeometry(geo)
    })
  }, [])

  /* Ice brain component with mutable materials */
  const materialRef = useRef<THREE.MeshPhysicalMaterial | null>(null)
  const innerMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null)
  const glowMatRef = useRef<THREE.MeshBasicMaterial | null>(null)

  /* Materials - mutable refs for useFrame */
  const mainMaterial = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: 0xd0e8e8, emissive: 0x2a1030, emissiveIntensity: 0.3, metalness: 0, roughness: 0.25,
      transmission: 0.6, thickness: 1.2, ior: 1.45, clearcoat: 0.8, clearcoatRoughness: 0.1,
      sheen: 0.5, sheenColor: new THREE.Color(0xff69b4), sheenRoughness: 0.5,
      specularIntensity: 1.0, specularColor: new THREE.Color(0xffffff),
      side: THREE.DoubleSide, flatShading: true, envMapIntensity: 0.5,
    })
    materialRef.current = m
    return m
  }, [])

  const innerMaterial = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: 0x40e0d0, emissive: 0xff1493, emissiveIntensity: 0.4,
      transparent: true, opacity: 0.15, side: THREE.BackSide, flatShading: true,
    })
    innerMatRef.current = m
    return m
  }, [])

  const glowMaterial = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      color: 0xff69b4, transparent: true, opacity: 0, side: THREE.FrontSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    glowMatRef.current = m
    return m
  }, [])

  /* Animation loop */
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    const cfg = STATE_PALETTE[activityState as keyof typeof STATE_PALETTE] || STATE_PALETTE.idle

    // Idle rotation
    groupRef.current.rotation.x = (-Math.PI / 2) + Math.sin(t * 0.15) * 0.05
    groupRef.current.rotation.z = (Math.PI / 3.5) + Math.cos(t * 0.1) * 0.03

    // State-based material changes
    // Lerp colors
    mainMaterial.color.lerp(new THREE.Color(cfg.base), 0.05)
    mainMaterial.emissive.lerp(new THREE.Color(cfg.emissive), 0.05)

    if (activityState === 'thinking') {
      const blink = (Math.sin(t * 3) + 1) / 2
      mainMaterial.opacity = 0.5 + blink * 0.5
      mainMaterial.transmission = 0.3 + blink * 0.5
      mainMaterial.emissiveIntensity = 0.3 + blink * 0.5
      innerMatRef.current!.opacity = 0.1 + blink * 0.4
    } else if (activityState === 'speaking') {
      mainMaterial.opacity = 1
      mainMaterial.transmission = 0
      mainMaterial.emissiveIntensity = 1.0
      innerMatRef.current!.opacity = 0.15
    } else {
      mainMaterial.opacity = 1
      mainMaterial.transmission = 0.6
      mainMaterial.emissiveIntensity = 0.3
      innerMatRef.current!.opacity = 0.15
    }

    // Glow pulse
    glowMatRef.current!.opacity = 0.15 + Math.sin(t * 0.8) * 0.05
  })

  if (!geometry) {
    return (
      <mesh>
        <icosahedronGeometry args={[0.8, 2]} />
        <meshBasicMaterial color="#4488aa" wireframe />
      </mesh>
    )
  }

  const box = new THREE.Box3().setFromObject(new THREE.Mesh(geometry))
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const scale = 2 / maxDim

  return (
    <group ref={groupRef} scale={scale}>
      {/* Main brain */}
      <mesh ref={mainMeshRef} geometry={geometry} castShadow receiveShadow>
        <primitive object={mainMaterial} attach="material" />
      </mesh>
      {/* Inner glow */}
      <mesh ref={innerMeshRef} geometry={geometry} scale={[0.97, 0.97, 0.97]}>
        <primitive object={innerMaterial} attach="material" />
      </mesh>
      {/* Outer glow */}
      <mesh ref={glowMeshRef} geometry={geometry} scale={[1.02, 1.02, 1.02]}>
        <primitive object={glowMaterial} attach="material" />
      </mesh>
    </group>
  )
}

/* ── Particle Orbitals ─────────────────────────────────────── */
function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null)
  const velocities = useRef<Array<{ angle: number; speed: number; yOffset: number; rad: number }>>([])

  const PARTICLE_COUNT = 32
  const palette = [0xff69b4, 0x40e0d0, 0xffffff, 0xec4899, 0x7c3aed]

  const geo = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    velocities.current = []

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = 1.5 + Math.random() * 2

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = radius * Math.cos(phi)

      const c = new THREE.Color(palette[Math.floor(Math.random() * palette.length)])
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b

      velocities.current.push({ angle: theta, speed: 0.2 + Math.random() * 0.8, yOffset: Math.random() * Math.PI * 2, rad: radius })
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [])

  useFrame(({ clock }) => {
    if (!pointsRef.current) return
    const pos = (pointsRef.current.geometry as THREE.BufferGeometry).attributes.position.array as Float32Array
    const t = clock.getElapsedTime()
    const dt = clock.getDelta()

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const v = velocities.current[i]
      v.angle += v.speed * dt * 0.5
      const r = v.rad + Math.sin(t + v.yOffset) * 0.3
      pos[i * 3] = r * Math.cos(v.angle)
      pos[i * 3 + 1] = r * Math.sin(t * 0.3 + v.yOffset) * 0.5
      pos[i * 3 + 2] = r * Math.sin(v.angle)
    }

    ;(pointsRef.current.geometry as THREE.BufferGeometry).attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial
        size={0.05}
        vertexColors
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  )
}

/* ── Thought Bubbles floating ──────────────────────────────── */
function ThoughtBubbles() {
  const bubbles = useRef<THREE.Mesh[]>([])
  const palette = [0xff69b4, 0x40e0d0, 0xffffff, 0xec4899, 0x7c3aed]

  const group = useMemo(() => {
    const g = new THREE.Group()
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: palette[i % palette.length],
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending
      })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), mat)
      mesh.position.set((Math.random() - 0.5) * 3, -2 - Math.random() * 3, (Math.random() - 0.5) * 3)
      mesh.userData = { speed: 0.3 + Math.random() * 0.7, phase: Math.random() * Math.PI * 2, wobble: Math.random() * 0.5 }
      g.add(mesh)
      bubbles.current.push(mesh)
    }
    return g
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const dt = clock.getDelta()
    bubbles.current.forEach(th => {
      th.position.y += th.userData.speed * dt * 0.5
      th.position.x += Math.sin(th.userData.wobble * t + th.userData.phase) * dt * 0.2
      ;(th.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(t * 2 + th.userData.phase) * 0.15
      if (th.position.y > 3.5) {
        th.position.y = -2.5
        th.position.x = (Math.random() - 0.5) * 3
        th.position.z = (Math.random() - 0.5) * 3
      }
    })
  })

  return <primitive object={group} />
}

/* ── Lights ────────────────────────────────────────────────── */
function StageLights() {
  const { scene } = useThree()

  useEffect(() => {
    scene.background = new THREE.Color(0x0a0a0f)
    const ambient = new THREE.AmbientLight(0x404040, 0.5)
    scene.add(ambient)
    const dir = new THREE.DirectionalLight(0xffffff, 1.2)
    dir.position.set(5, 5, 5)
    dir.castShadow = true
    scene.add(dir)
    const fill = new THREE.DirectionalLight(0xff69b4, 0.6)
    fill.position.set(-3, 2, -2)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0x40e0d0, 0.8)
    rim.position.set(0, -3, 4)
    scene.add(rim)
    const bottom = new THREE.PointLight(0xff1493, 0.5, 10)
    bottom.position.set(0, -2, 0)
    scene.add(bottom)
    const top = new THREE.PointLight(0xff69b4, 0.4, 8)
    top.position.set(0, 3, 0)
    scene.add(top)

    return () => {
      scene.remove(ambient, dir, fill, rim, bottom, top)
    }
  }, [scene])

  return null
}

/* ── Exported Scene ────────────────────────────────────────── */
export default function BrainBackground() {
  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{ position: [3, 0, 4], fov: 45, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        shadows
      >
        <color attach="background" args={['#0a0a0f']} />
        <fog attach="fog" args={['#0a0a0f', 6, 20]} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={1.5}
          maxDistance={8}
          target={[0, 0, 0]}
        />
        <Suspense fallback={null}>
          <StageLights />
          <IceBrain />
          <ParticleField />
          <ThoughtBubbles />
        </Suspense>
        <EffectComposer>
          <Bloom intensity={0.6} luminanceThreshold={0.2} luminanceSmoothing={0.9} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
