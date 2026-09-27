import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, MeshTransmissionMaterial, Html, CameraControls } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, ToneMapping } from '@react-three/postprocessing';
import * as THREE from 'three';
import { animate } from 'animejs';
import { useTheme } from 'next-themes';
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d';

const EDGE_COLORS_DARK = {
  'Shared Device': new THREE.Color('#2DD4BF'),
  'Shared IP':     new THREE.Color('#A855F7'),
  'Shared UPI':    new THREE.Color('#FACC15'),
};
const EDGE_COLORS_LIGHT = {
  'Shared Device': new THREE.Color('#006A67'),
  'Shared IP':     new THREE.Color('#4A2C76'),
  'Shared UPI':    new THREE.Color('#D4AF37'),
};
const DEFAULT_EDGE_DARK  = new THREE.Color('#60A5FA');
const DEFAULT_EDGE_LIGHT = new THREE.Color('#0F2350');

const NODE_COLORS = {
  default:    new THREE.Color(0x4A2C76),
  high:       new THREE.Color(0x006A67),
  mid:        new THREE.Color(0xD4AF37),
  low:        new THREE.Color(0x0F2350),
};

const _dummy = new THREE.Object3D();

// ============================================================
// Graph Nodes & Edges (Instanced)
// ============================================================
const GraphGeometry = ({ graphData, isDark, onDataSourceChange }) => {
  const instancedRef = useRef();
  const linesRef = useRef();
  
  // 1. Build display data (Big Bang animation)
  const displayData = useMemo(() => {
    let nodes, links;
    let isLive = false;

    if (graphData && graphData.nodes && graphData.nodes.length > 0) {
      isLive = true;
      nodes = graphData.nodes.map(n => ({ ...n }));
      links = (graphData.links || []).map(l => ({ ...l }));
    } else {
      nodes = [];
      links = [];
      const totalNodes = 3340;
      const clusterCount = 280;
      const edgeTypes = ['Shared Device', 'Shared IP', 'Shared Employer', 'Shared Zip Code', 'Shared Company'];

      for (let i = 0; i < totalNodes; i++) {
        nodes.push({
          id: i,
          name: `Simulated User ${i}`,
          credit_score: Math.floor(Math.random() * 500) + 300,
          is_default: Math.random() < 0.26 ? 1 : 0,
          size: 1,
        });
      }

      for (let c = 0; c < clusterCount; c++) {
        const clusterSize = Math.floor(Math.random() * 11) + 5;
        const startIdx = Math.floor(Math.random() * (totalNodes - clusterSize));
        const edgeType = edgeTypes[c % edgeTypes.length];
        for (let j = 0; j < clusterSize - 1; j++) {
          links.push({ source: startIdx + j, target: startIdx + j + 1, type: edgeType });
          if (j + 2 < clusterSize && Math.random() < 0.35) {
            links.push({ source: startIdx + j, target: startIdx + j + 2, type: edgeType });
          }
        }
      }
      for (let i = 0; i < 200; i++) {
        links.push({
          source: Math.floor(Math.random() * totalNodes),
          target: Math.floor(Math.random() * totalNodes),
          type: edgeTypes[Math.floor(Math.random() * edgeTypes.length)],
        });
      }
    }

    const connectedIds = new Set();
    for (const link of links) {
      connectedIds.add(typeof link.source === 'object' ? link.source.id : link.source);
      connectedIds.add(typeof link.target === 'object' ? link.target.id : link.target);
    }

    const centerRadius = 80;
    const outerMin = 100;
    const outerMax = 250;

    for (const node of nodes) {
      const isConn = connectedIds.has(node.id);
      node._connected = isConn;

      if (node.fx === undefined) {
        let tx, ty, tz;
        if (isConn) {
          tx = (Math.random() - 0.5) * centerRadius * 2;
          ty = (Math.random() - 0.5) * centerRadius * 2;
          tz = (Math.random() - 0.5) * centerRadius * 2;
        } else {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const r = outerMin + Math.random() * (outerMax - outerMin);
          tx = r * Math.sin(phi) * Math.cos(theta);
          ty = r * Math.sin(phi) * Math.sin(theta);
          tz = r * Math.cos(phi);
        }

        node.fx = 0; node.fy = 0; node.fz = 0;
        node.x = 0; node.y = 0; node.z = 0;

        animate(node, {
          fx: tx, fy: ty, fz: tz,
          x: tx, y: ty, z: tz,
          duration: 3000 + Math.random() * 2000,
          delay: 0,
          ease: 'easeOutQuint'
        });
      }
    }

    setTimeout(() => onDataSourceChange(isLive ? 'live' : 'simulated', nodes.length, links.length), 0);
    return { nodes, links, isLive };
  }, [graphData, onDataSourceChange]);

  // 2. Physics Simulation for Live Data
  const simulation = useMemo(() => {
    if (!displayData.isLive) return null;
    return forceSimulation(displayData.nodes)
      .force('link', forceLink(displayData.links).id(d => d.id).distance(18).strength(0.5))
      .force('charge', forceManyBody().strength(-4).distanceMax(150))
      .force('center', forceCenter(0, 0, 0))
      .numDimensions(3);
  }, [displayData]);

  // 3. Build colors and arrays once
  const { nodeColors, lineColors, linePositions } = useMemo(() => {
    const nColors = new Float32Array(displayData.nodes.length * 3);
    for (let i = 0; i < displayData.nodes.length; i++) {
      const node = displayData.nodes[i];
      const isDefault = node.is_default === 1;
      const score = node.credit_score || 500;
      let c = NODE_COLORS.low;
      if (isDefault) c = NODE_COLORS.default;
      else if (score > 750) c = NODE_COLORS.high;
      else if (score > 600) c = NODE_COLORS.mid;
      nColors[i*3+0] = c.r; nColors[i*3+1] = c.g; nColors[i*3+2] = c.b;
    }

    const eCount = displayData.links.length;
    const edgeColors = isDark ? EDGE_COLORS_DARK : EDGE_COLORS_LIGHT;
    const defaultColor = isDark ? DEFAULT_EDGE_DARK : DEFAULT_EDGE_LIGHT;
    const lColors = new Float32Array(eCount * 6);
    for (let i = 0; i < eCount; i++) {
      const link = displayData.links[i];
      const c = edgeColors[link.type] || defaultColor;
      lColors[i*6+0] = c.r; lColors[i*6+1] = c.g; lColors[i*6+2] = c.b;
      lColors[i*6+3] = c.r; lColors[i*6+4] = c.g; lColors[i*6+5] = c.b;
    }

    const lPos = new Float32Array(eCount * 6);
    return { nodeColors: nColors, lineColors: lColors, linePositions: lPos };
  }, [displayData, isDark]);

  // 4. Render loop
  useFrame(() => {
    if (simulation) simulation.tick();
    
    const nodes = displayData.nodes;
    const links = displayData.links;
    
    if (instancedRef.current) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const isConnected = node._connected;
        const size = isConnected ? (node.is_default === 1 ? 1.2 : 0.7) : 0.65;
        // Use fx/fy/fz if set (simulated), else x/y/z (live physics)
        _dummy.position.set(node.fx ?? node.x ?? 0, node.fy ?? node.y ?? 0, node.fz ?? node.z ?? 0);
        _dummy.scale.set(size, size, size);
        _dummy.updateMatrix();
        instancedRef.current.setMatrixAt(i, _dummy.matrix);
      }
      instancedRef.current.instanceMatrix.needsUpdate = true;
    }

    if (linesRef.current && links.length > 0) {
      const pos = linesRef.current.geometry.attributes.position.array;
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const src = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
        const tgt = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
        if (src && tgt) {
          pos[i*6+0] = src.fx ?? src.x ?? 0; pos[i*6+1] = src.fy ?? src.y ?? 0; pos[i*6+2] = src.fz ?? src.z ?? 0;
          pos[i*6+3] = tgt.fx ?? tgt.x ?? 0; pos[i*6+4] = tgt.fy ?? tgt.y ?? 0; pos[i*6+5] = tgt.fz ?? tgt.z ?? 0;
        }
      }
      linesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={instancedRef} args={[null, null, displayData.nodes.length]}>
        <sphereGeometry args={[1, 8, 8]}>
          <instancedBufferAttribute attach="attributes-color" args={[nodeColors, 3]} />
        </sphereGeometry>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
      
      {displayData.links.length > 0 && (
        <lineSegments ref={linesRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={linePositions.length / 3} array={linePositions} itemSize={3} usage={THREE.DynamicDrawUsage} />
            <bufferAttribute attach="attributes-color" count={lineColors.length / 3} array={lineColors} itemSize={3} />
          </bufferGeometry>
          <lineBasicMaterial vertexColors transparent opacity={0.18} toneMapped={false} />
        </lineSegments>
      )}
    </group>
  );
};

// ============================================================
// Camera Controller
// ============================================================
const CameraManager = ({ isInteractive }) => {
  const cameraControlRef = useRef();

  useEffect(() => {
    if (cameraControlRef.current) {
      cameraControlRef.current.setLookAt(0, 20, 380, 0, 0, 0, false);
      
      const timeout = setTimeout(() => {
        if (!isInteractive && cameraControlRef.current) {
          cameraControlRef.current.setLookAt(0, 0, 250, 0, 0, 0, true);
        }
      }, 4500);
      return () => clearTimeout(timeout);
    }
  }, []);

  useFrame((state, delta) => {
    if (!isInteractive && cameraControlRef.current) {
      cameraControlRef.current.azimuthAngle += 0.05 * delta;
    }
  });

  return (
    <CameraControls 
      ref={cameraControlRef} 
      enabled={true} 
      mouseButtons={{
        left: isInteractive ? 1 : 0,
        middle: 0,
        right: isInteractive ? 2 : 0,
        wheel: isInteractive ? 8 : 0
      }}
      touches={{
        one: isInteractive ? 1 : 0,
        two: isInteractive ? 2 : 0,
        three: isInteractive ? 3 : 0
      }}
      dollySpeed={1.2}
      azimuthRotateSpeed={0.8}
      polarRotateSpeed={0.8}
      dampingFactor={0.1}
    />
  );
};

// ============================================================
// 3D Glass UI
// ============================================================
const GlassFloatingCards = ({ isDark }) => {
  return (
    <group position={[0, -20, 150]} rotation={[0, 0, 0]}>
      {/* Huge glass backdrop for Hero Section */}
      <mesh>
        <planeGeometry args={[140, 80]} />
        <MeshTransmissionMaterial 
          background={new THREE.Color(isDark ? '#000000' : '#F4F5F7')}
          thickness={15}
          roughness={0.15}
          transmission={1}
          ior={1.2}
          chromaticAberration={0.08}
          anisotropy={0.3}
          distortion={0.5}
          distortionScale={0.5}
          temporalDistortion={0.1}
          color={isDark ? '#1a1a2e' : '#ffffff'}
        />
      </mesh>
    </group>
  );
};

// ============================================================
// Main Component
// ============================================================
export default function NetworkBackground({ graphData, isInteractive, onNodeClick }) {
  const [stats, setStats] = useState({ source: 'simulated', nodes: 0, edges: 0 });
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="fixed inset-0 z-0 transition-colors duration-300" style={{ background: isDark ? '#000000' : '#F4F5F7' }}>
      <Canvas
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 20, 380], fov: 45 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[isDark ? '#000000' : '#F4F5F7']} />
        
        <CameraManager isInteractive={isInteractive} />
        
        <GraphGeometry 
          graphData={graphData} 
          isDark={isDark} 
          onDataSourceChange={(s, n, e) => setStats({ source: s, nodes: n, edges: e })} 
        />
        
        {!isInteractive && <GlassFloatingCards isDark={isDark} />}

        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} />
          <DepthOfField focusDistance={0.02} focalLength={0.1} bokehScale={2} />
        </EffectComposer>
      </Canvas>

      {/* Stats Badge Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '20px',
          background: stats.source === 'live' ? 'rgba(48, 209, 88, 0.12)' : 'rgba(212, 175, 55, 0.12)',
          border: `1px solid ${stats.source === 'live' ? 'rgba(48, 209, 88, 0.3)' : 'rgba(212, 175, 55, 0.3)'}`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif",
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 600, color: stats.source === 'live' ? '#30D158' : '#D4AF37' }}>
          {stats.source === 'live' ? '● Live Graph' : '⟳ Simulated Data'}
        </span>
        <span style={{ fontSize: '10px', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
          {stats.nodes.toLocaleString()} nodes · {stats.edges.toLocaleString()} edges
        </span>
      </div>
    </div>
  );
}
