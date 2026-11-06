import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

// 01 — Linear Regression 3D Clay Illustration
export const LinearRegressionIllustration: React.FC = () => {
  return (
    <div className="w-full h-44 relative pointer-events-none">
      <Canvas camera={{ position: [0, 1.2, 3.8], fov: 42 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 6, 5]} intensity={1.2} color="#FFFFFF" />
        <directionalLight position={[-4, -3, -2]} intensity={0.4} color="#DCEAF4" />
        <Float speed={2} rotationIntensity={0.3} floatIntensity={0.6}>
          <group rotation={[0.2, 0.4, 0]}>
            {/* Coordinate Plane Grid */}
            <gridHelper args={[3.2, 8, '#BFDBFE', '#E2E8F0']} position={[0, -0.6, 0]} />
            
            {/* Best Fit Regression Line */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, 0.55]}>
              <cylinderGeometry args={[0.045, 0.045, 3.0, 24]} />
              <meshStandardMaterial color="#2563EB" roughness={0.3} metalness={0.1} />
            </mesh>

            {/* Clay Data Spheres */}
            {[
              [-1.1, -0.75, 0.1],
              [-0.7, -0.3, -0.15],
              [-0.3, -0.1, 0.2],
              [0.0, 0.1, -0.1],
              [0.4, 0.35, 0.12],
              [0.8, 0.5, -0.18],
              [1.15, 0.72, 0.08],
              [-0.4, -0.45, 0.25],
              [0.6, 0.18, -0.22]
            ].map((pos, idx) => (
              <mesh key={idx} position={pos as [number, number, number]}>
                <sphereGeometry args={[0.09, 24, 24]} />
                <meshStandardMaterial color="#60A5FA" roughness={0.4} metalness={0.05} />
              </mesh>
            ))}
          </group>
        </Float>
      </Canvas>
    </div>
  );
};

// 02 — Decision Tree 3D Clay Illustration
export const DecisionTreeIllustration: React.FC = () => {
  return (
    <div className="w-full h-44 relative pointer-events-none">
      <Canvas camera={{ position: [0, 0.4, 3.8], fov: 42 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 5, 4]} intensity={1.2} color="#FFFFFF" />
        <directionalLight position={[-3, -2, -2]} intensity={0.4} color="#DCEDE5" />
        <Float speed={1.8} rotationIntensity={0.25} floatIntensity={0.5}>
          <group position={[0, -0.1, 0]} rotation={[0.1, -0.2, 0]}>
            {/* Root Node */}
            <mesh position={[0, 1.0, 0]}>
              <sphereGeometry args={[0.16, 24, 24]} />
              <meshStandardMaterial color="#059669" roughness={0.35} />
            </mesh>

            {/* Left & Right Child Branches */}
            <mesh position={[-0.55, 0.5, 0]} rotation={[0, 0, 0.7]}>
              <cylinderGeometry args={[0.035, 0.035, 1.2, 16]} />
              <meshStandardMaterial color="#A7F3D0" roughness={0.4} />
            </mesh>
            <mesh position={[0.55, 0.5, 0]} rotation={[0, 0, -0.7]}>
              <cylinderGeometry args={[0.035, 0.035, 1.2, 16]} />
              <meshStandardMaterial color="#A7F3D0" roughness={0.4} />
            </mesh>

            {/* Level 1 Nodes */}
            <mesh position={[-0.9, 0.0, 0]}>
              <sphereGeometry args={[0.13, 24, 24]} />
              <meshStandardMaterial color="#10B981" roughness={0.35} />
            </mesh>
            <mesh position={[0.9, 0.0, 0]}>
              <sphereGeometry args={[0.13, 24, 24]} />
              <meshStandardMaterial color="#10B981" roughness={0.35} />
            </mesh>

            {/* Leaf Branches & Nodes */}
            {[-1.3, -0.5, 0.5, 1.3].map((xPos, idx) => (
              <group key={idx}>
                <mesh position={[xPos * 0.7, -0.38, 0]} rotation={[0, 0, (idx % 2 === 0 ? 0.4 : -0.4)]}>
                  <cylinderGeometry args={[0.025, 0.025, 0.8, 16]} />
                  <meshStandardMaterial color="#D1FAE5" roughness={0.4} />
                </mesh>
                <mesh position={[xPos, -0.75, 0]}>
                  <sphereGeometry args={[0.10, 24, 24]} />
                  <meshStandardMaterial color="#34D399" roughness={0.4} />
                </mesh>
              </group>
            ))}
          </group>
        </Float>
      </Canvas>
    </div>
  );
};

// 03 — K-Means 3D Clay Illustration
export const KMeansIllustration: React.FC = () => {
  return (
    <div className="w-full h-44 relative pointer-events-none">
      <Canvas camera={{ position: [0, 1.0, 3.8], fov: 42 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 5, 4]} intensity={1.2} color="#FFFFFF" />
        <Float speed={2.2} rotationIntensity={0.35} floatIntensity={0.6}>
          <group rotation={[0.3, 0.3, 0]}>
            {/* Cluster 1: Warm Amber / Gold */}
            <mesh position={[-0.8, 0.4, 0]}>
              <torusGeometry args={[0.24, 0.02, 16, 32]} />
              <meshStandardMaterial color="#D97706" />
            </mesh>
            {[[-0.9, 0.5, 0.1], [-0.7, 0.25, -0.1], [-1.0, 0.3, -0.05], [-0.65, 0.6, 0.15]].map((pos, i) => (
              <mesh key={i} position={pos as [number, number, number]}>
                <sphereGeometry args={[0.08, 20, 20]} />
                <meshStandardMaterial color="#FBBF24" roughness={0.3} />
              </mesh>
            ))}

            {/* Cluster 2: Soft Cyan */}
            <mesh position={[0.75, 0.45, 0.1]}>
              <torusGeometry args={[0.24, 0.02, 16, 32]} />
              <meshStandardMaterial color="#0284C7" />
            </mesh>
            {[[0.8, 0.6, 0.15], [0.65, 0.35, -0.1], [0.95, 0.35, 0.05], [0.6, 0.55, 0.2]].map((pos, i) => (
              <mesh key={i} position={pos as [number, number, number]}>
                <sphereGeometry args={[0.08, 20, 20]} />
                <meshStandardMaterial color="#38BDF8" roughness={0.3} />
              </mesh>
            ))}

            {/* Cluster 3: Rose / Coral */}
            <mesh position={[0.0, -0.55, -0.1]}>
              <torusGeometry args={[0.24, 0.02, 16, 32]} />
              <meshStandardMaterial color="#E11D48" />
            </mesh>
            {[[-0.15, -0.4, -0.05], [0.15, -0.65, 0.1], [0.0, -0.35, -0.15], [-0.2, -0.7, 0.15]].map((pos, i) => (
              <mesh key={i} position={pos as [number, number, number]}>
                <sphereGeometry args={[0.08, 20, 20]} />
                <meshStandardMaterial color="#FB7185" roughness={0.3} />
              </mesh>
            ))}
          </group>
        </Float>
      </Canvas>
    </div>
  );
};

// 04 — PCA 3D Clay Illustration
export const PCAIllustration: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null!);

  return (
    <div className="w-full h-44 relative pointer-events-none">
      <Canvas camera={{ position: [0, 1.2, 4.0], fov: 42 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 5, 5]} intensity={1.2} color="#FFFFFF" />
        <Float speed={2} rotationIntensity={0.4} floatIntensity={0.7}>
          <group ref={groupRef} rotation={[0.4, 0.5, 0]}>
            {/* Original Axes (Muted) */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.015, 0.015, 2.6, 16]} />
              <meshStandardMaterial color="#CBD5E1" />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 2.6, 16]} />
              <meshStandardMaterial color="#CBD5E1" />
            </mesh>

            {/* Rotated Principal Component 1 (PC1 - Lavender Accent) */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, 0.65]}>
              <cylinderGeometry args={[0.045, 0.045, 3.2, 24]} />
              <meshStandardMaterial color="#7C3AED" roughness={0.3} />
            </mesh>

            {/* Orthogonal Principal Component 2 (PC2) */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, 0.65 + Math.PI / 2]}>
              <cylinderGeometry args={[0.035, 0.035, 2.0, 24]} />
              <meshStandardMaterial color="#A78BFA" roughness={0.35} />
            </mesh>

            {/* Projected Ellipsoidal Point Cloud */}
            {[
              [-1.2, -0.7, 0.05],
              [-0.8, -0.4, -0.1],
              [-0.4, -0.2, 0.1],
              [0.0, 0.0, -0.05],
              [0.35, 0.2, 0.08],
              [0.75, 0.45, -0.1],
              [1.15, 0.7, 0.05],
              [-0.5, 0.1, 0.15],
              [0.5, -0.1, -0.12]
            ].map((p, idx) => (
              <mesh key={idx} position={p as [number, number, number]}>
                <sphereGeometry args={[0.075, 20, 20]} />
                <meshStandardMaterial color="#C4B5FD" roughness={0.3} />
              </mesh>
            ))}
          </group>
        </Float>
      </Canvas>
    </div>
  );
};
