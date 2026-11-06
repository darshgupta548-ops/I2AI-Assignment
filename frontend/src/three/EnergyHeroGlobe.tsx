import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float } from '@react-three/drei';
import * as THREE from 'three';

// Animated Glowing Energy Core & Flowing Particles
function EnergyCore() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const particlesRef = useRef<THREE.Points>(null!);
  const ring1Ref = useRef<THREE.Mesh>(null!);
  const ring2Ref = useRef<THREE.Mesh>(null!);
  const nodesRef = useRef<THREE.Group>(null!);

  // Generate orbital particles
  const particleCount = 180;
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    
    // Cyan/emerald energy consumption + amber solar generation colors
    const cyan = new THREE.Color('#06b6d4');
    const emerald = new THREE.Color('#10b981');
    const amber = new THREE.Color('#f59e0b');

    for (let i = 0; i < particleCount; i++) {
      // Fibonacci sphere distribution with noise
      const phi = Math.acos(-1 + (2 * i) / particleCount);
      const theta = Math.sqrt(particleCount * Math.PI) * phi;
      const radius = 2.4 + (Math.random() - 0.5) * 0.8;

      pos[i * 3] = radius * Math.cos(theta) * Math.sin(phi);
      pos[i * 3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
      pos[i * 3 + 2] = radius * Math.cos(phi);

      // Randomly assign energy type color
      const rand = Math.random();
      const chosenColor = rand < 0.45 ? cyan : (rand < 0.75 ? emerald : amber);
      col[i * 3] = chosenColor.r;
      col[i * 3 + 1] = chosenColor.g;
      col[i * 3 + 2] = chosenColor.b;
    }
    return [pos, col];
  }, []);

  // Energy Nodes (hostel sub-meters / solar panels)
  const nodes = useMemo(() => {
    return [
      { pos: [1.8, 1.2, 0.9], color: '#f59e0b', label: 'Solar PV Array' },
      { pos: [-1.6, -1.0, 1.4], color: '#06b6d4', label: 'HVAC Chiller' },
      { pos: [0.8, -1.9, -1.1], color: '#10b981', label: 'Hostel Block A' },
      { pos: [-1.4, 1.5, -1.2], color: '#38bdf8', label: 'Hostel Block B' },
      { pos: [0.0, 2.2, 0.4], color: '#fbbf24', label: 'Grid Interconnect' },
    ];
  }, []);

  useFrame((state, delta) => {
    // Gentle rotation
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.15;
      meshRef.current.rotation.x += delta * 0.08;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y -= delta * 0.12;
      particlesRef.current.rotation.z += delta * 0.05;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z += delta * 0.22;
      ring1Ref.current.rotation.x += delta * 0.1;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y += delta * 0.18;
      ring2Ref.current.rotation.z -= delta * 0.15;
    }
    if (nodesRef.current) {
      nodesRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <Float speed={2.5} rotationIntensity={0.6} floatIntensity={1.2}>
      {/* Central Inner Pulsing Energy Core */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshStandardMaterial
          color="#0ea5e9"
          emissive="#0284c7"
          emissiveIntensity={0.6}
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* Floating Orbital Particle Swarm */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.07}
          vertexColors
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Orbital Flow Ring 1 (Cyan) */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[2.5, 0.02, 16, 100]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.6} />
      </mesh>

      {/* Orbital Flow Ring 2 (Emerald) */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 4, Math.PI / 4, 0]}>
        <torusGeometry args={[2.7, 0.02, 16, 100]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.5} />
      </mesh>

      {/* Pulsing Energy Nodes */}
      <group ref={nodesRef}>
        {nodes.map((node, idx) => (
          <mesh key={idx} position={node.pos as [number, number, number]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial
              color={node.color}
              emissive={node.color}
              emissiveIntensity={1.8}
            />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

// Graceful 2D Fallback if WebGL is unavailable
function FallbackEnergyOrb() {
  return (
    <div className="relative w-72 h-72 md:w-96 md:h-96 mx-auto flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/20 via-emerald-500/10 to-amber-500/20 blur-2xl animate-pulse" />
      <div className="w-48 h-48 rounded-full border border-cyan-500/40 border-dashed animate-spin flex items-center justify-center">
        <div className="w-36 h-36 rounded-full border border-emerald-500/50 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-cyan-500/30 blur-sm flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-cyan-400 shadow-[0_0_20px_#06b6d4]" />
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 text-xs font-mono text-cyan-400/80 bg-slate-900/80 px-3 py-1 rounded-full border border-cyan-800/40">
        Hostel Energy Node Network Active
      </div>
    </div>
  );
}

export const EnergyHeroGlobe: React.FC = () => {
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setHasWebGL(Boolean(gl));
    } catch {
      setHasWebGL(false);
    }
  }, []);

  if (hasWebGL === false) {
    return <FallbackEnergyOrb />;
  }

  return (
    <div className="w-full h-[380px] md:h-[480px] relative">
      <Canvas
        camera={{ position: [0, 0, 5.8], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1.2} color="#38bdf8" />
        <pointLight position={[-10, -10, -10]} intensity={0.8} color="#10b981" />
        <EnergyCore />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          maxPolarAngle={Math.PI / 1.7}
          minPolarAngle={Math.PI / 2.3}
        />
      </Canvas>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] font-mono text-slate-400 bg-slate-900/70 border border-slate-800 px-3 py-0.5 rounded-full backdrop-blur-sm pointer-events-none">
        Interactive 3D Energy Mesh · Drag to inspect nodes
      </div>
    </div>
  );
};
