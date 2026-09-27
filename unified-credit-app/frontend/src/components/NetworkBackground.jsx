import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { animate } from 'animejs';
import { useTheme } from 'next-themes';

// ============================================================
// Constants
// ============================================================
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

// Shared geometry — allocated ONCE in VRAM
const sharedSphereGeometry = new THREE.SphereGeometry(1, 8, 8);

// Reusable math objects to avoid GC pressure in the render loop
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

// ============================================================
// Component
// ============================================================
const NetworkBackground = ({ graphData, onNodeClick, isInteractive }) => {
  const fgRef = useRef();
  const instancedRef = useRef(null);
  const edgeMeshRef = useRef(null);
  const rotateRef = useRef(null);
  const [dataSource, setDataSource] = useState('simulated');
  const [webglError, setWebglError] = useState(false);
  const [activeGpu, setActiveGpu] = useState(null);
  const [fps, setFps] = useState(0);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const displayDataRef = useRef({ nodes: [], links: [] });

  // ============================================================
  // 1. Build display data FIRST (Big Bang animation)
  //    Must be defined before any effect that references it.
  // ============================================================
  const displayData = useMemo(() => {
    let nodes, links;
    let isLive = false;

    if (graphData && graphData.nodes && graphData.nodes.length > 0) {
      isLive = true;
      nodes = [...graphData.nodes];
      links = [...(graphData.links || [])];
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

    // Build connected node set
    const connectedIds = new Set();
    for (const link of links) {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      connectedIds.add(srcId);
      connectedIds.add(tgtId);
    }

    const centerRadius = 80;
    const outerMin = 100;
    const outerMax = 250;

    for (const node of nodes) {
      const isConn = connectedIds.has(node.id);
      node._connected = isConn;

      if (node._targetX === undefined) {
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

        node._targetX = tx;
        node._targetY = ty;
        node._targetZ = tz;

        // Big Bang: start at center, burst outward
        node.fx = 0;
        node.fy = 0;
        node.fz = 0;

        animate(node, {
          fx: tx, fy: ty, fz: tz,
          duration: 3000 + Math.random() * 2000,
          delay: 0,
          ease: 'easeOutQuint'
        });
      }
    }

    setDataSource(isLive ? 'live' : 'simulated');
    const data = { nodes, links, isLive };
    displayDataRef.current = data;
    return data;
  }, [graphData]);

  // ============================================================
  // 4. Effects (all hooks below — no early returns between hooks)
  // ============================================================

  // FPS Counter
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId;
    const measure = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(measure);
    };
    rafId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Bulletproof continuous rotation and render loop
  useEffect(() => {
    let rafId;
    const renderLoop = () => {
      const fg = fgRef.current;
      if (fg) {
        const scene = fg.scene();
        const camera = fg.camera();
        const renderer = fg.renderer();
        
        if (scene && camera && renderer) {
          // 1. Rotate the scene endlessly
          scene.rotation.y += 0.0015;
          
          // 2. Sync matrices during the Big Bang animation or when physics are paused
          const nodes = displayDataRef.current.nodes;
          const links = displayDataRef.current.links;
          const instanced = instancedRef.current;
          const lineSeg = edgeMeshRef.current;
          
          if (instanced && nodes && nodes.length > 0) {
            for (let i = 0; i < nodes.length; i++) {
              const node = nodes[i];
              const isDefault = node.is_default === 1;
              const isConnected = node._connected;
              const size = isConnected ? (isDefault ? 1.2 : 0.7) : 0.65;
              _dummy.position.set(node.fx ?? node.x ?? 0, node.fy ?? node.y ?? 0, node.fz ?? node.z ?? 0);
              _dummy.scale.set(size, size, size);
              _dummy.updateMatrix();
              instanced.setMatrixAt(i, _dummy.matrix);
            }
            instanced.instanceMatrix.needsUpdate = true;
          }

          if (lineSeg && links && links.length > 0) {
            const posArr = lineSeg.geometry.attributes.position.array;
            for (let i = 0; i < links.length; i++) {
              const link = links[i];
              const src = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
              const tgt = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
              if (src && tgt) {
                posArr[i*6+0] = src.fx ?? src.x ?? 0; posArr[i*6+1] = src.fy ?? src.y ?? 0; posArr[i*6+2] = src.fz ?? src.z ?? 0;
                posArr[i*6+3] = tgt.fx ?? tgt.x ?? 0; posArr[i*6+4] = tgt.fy ?? tgt.y ?? 0; posArr[i*6+5] = tgt.fz ?? tgt.z ?? 0;
              }
            }
            lineSeg.geometry.attributes.position.needsUpdate = true;
          }

          // 3. Force the renderer to paint our rotation/animation!
          renderer.render(scene, camera);
        }
      }
      rafId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Toggle interactive controls (zoom, pan, rotate)
  useEffect(() => {
    if (!fgRef.current) return;
    const controls = fgRef.current.controls();
    if (controls) {
      controls.enabled = !!isInteractive;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.rotateSpeed = 0.8;
      controls.zoomSpeed = 1.2;
    }
  }, [isInteractive]);

  // Set initial camera position once (so it's not super close before zoomToFit fires)
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.cameraPosition({ x: 0, y: 20, z: 380 });
    }
  }, []);

  // GPU detection + renderer setup
  useEffect(() => {
    if (!fgRef.current) return;
    const renderer = fgRef.current.renderer();
    if (!renderer) {
      setWebglError(true);
      return;
    }

    renderer.setClearColor(isDark ? 0x000000 : 0xF4F5F7, 1);

    try {
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const gpuName = dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER);
      console.log('Active renderer:', gpuName);
      setActiveGpu(gpuName);

      const lower = gpuName.toLowerCase();
      if (lower.includes('swiftshader') || lower.includes('llvmpipe') || lower.includes('software')) {
        console.warn('⚠ Software rasterizer detected!');
        setWebglError(true);
        return;
      }
    } catch (e) {
      console.warn('Could not detect GPU:', e);
    }

    const fg = fgRef.current;
    if (fg.d3Force) {
      const charge = fg.d3Force('charge');
      if (charge) charge.strength(-4).distanceMax(150);
      const link = fg.d3Force('link');
      if (link) link.distance(18).strength(0.5);
    }
  }, [isDark]);

  // Build instanced rendering objects
  useEffect(() => {
    if (!fgRef.current) return;
    const scene = fgRef.current.scene();
    if (!scene) return;

    // Clean up previous instances
    if (instancedRef.current) {
      scene.remove(instancedRef.current);
      instancedRef.current.dispose();
    }
    if (edgeMeshRef.current) {
      scene.remove(edgeMeshRef.current);
      edgeMeshRef.current.geometry.dispose();
      edgeMeshRef.current.material.dispose();
    }

    // ---- InstancedMesh for nodes (1 draw call) ----
    const nCount = displayData.nodes?.length || 0;
    if (nCount > 0) {
      const mat = new THREE.MeshBasicMaterial();
      const instanced = new THREE.InstancedMesh(sharedSphereGeometry, mat, nCount);
      instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      for (let i = 0; i < nCount; i++) {
        const node = displayData.nodes[i];
        const isDefault = node.is_default === 1;
        const score = node.credit_score || 500;

        if (isDefault)        _color.copy(NODE_COLORS.default);
        else if (score > 750) _color.copy(NODE_COLORS.high);
        else if (score > 600) _color.copy(NODE_COLORS.mid);
        else                  _color.copy(NODE_COLORS.low);

        instanced.setColorAt(i, _color);
      }
      instanced.instanceColor.needsUpdate = true;
      scene.add(instanced);
      instancedRef.current = instanced;
    }

    // ---- LineSegments for edges (1 draw call) ----
    const eCount = displayData.links?.length || 0;
    if (eCount > 0) {
      const positions = new Float32Array(eCount * 6);
      const colors = new Float32Array(eCount * 6);

      const edgeColors = isDark ? EDGE_COLORS_DARK : EDGE_COLORS_LIGHT;
      const defaultColor = isDark ? DEFAULT_EDGE_DARK : DEFAULT_EDGE_LIGHT;

      for (let i = 0; i < eCount; i++) {
        const link = displayData.links[i];
        const c = edgeColors[link.type] || defaultColor;
        colors[i * 6 + 0] = c.r; colors[i * 6 + 1] = c.g; colors[i * 6 + 2] = c.b;
        colors[i * 6 + 3] = c.r; colors[i * 6 + 4] = c.g; colors[i * 6 + 5] = c.b;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.attributes.position.setUsage(THREE.DynamicDrawUsage);

      const lineMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.18,
      });
      const lineSegments = new THREE.LineSegments(geo, lineMat);
      scene.add(lineSegments);
      edgeMeshRef.current = lineSegments;
    }

    return () => {
      if (instancedRef.current) {
        scene.remove(instancedRef.current);
        instancedRef.current.dispose();
        instancedRef.current = null;
      }
      if (edgeMeshRef.current) {
        scene.remove(edgeMeshRef.current);
        edgeMeshRef.current.geometry.dispose();
        edgeMeshRef.current.material.dispose();
        edgeMeshRef.current = null;
      }
    };
  }, [displayData, isDark]);

  // Auto-fit to screen after Big Bang animation settles
  useEffect(() => {
    if (!fgRef.current || !graphData || !graphData.nodes || graphData.nodes.length === 0) return;
    const timeout = setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(1200, 40);
      }
    }, 4500);
    return () => clearTimeout(timeout);
  }, [graphData]);

  // ============================================================
  // 5. Render
  // ============================================================
  const nodeCount = displayData.nodes?.length || 0;
  const edgeCount = displayData.links?.length || 0;

  // Fallback UI when hardware acceleration is unavailable
  if (webglError) {
    return (
      <div className="fixed inset-0 z-0 flex items-center justify-center" style={{ background: isDark ? '#000000' : '#F4F5F7' }}>
        <div className="text-center p-8 border border-red-500/30 rounded-2xl bg-red-500/10 backdrop-blur-md max-w-md">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-red-400 mb-2">Hardware Acceleration Required</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Your browser is using a software renderer instead of your GPU.
            Please enable hardware acceleration in your browser settings.
          </p>
          <p className="text-xs text-gray-500 mt-3">
            Chrome: Settings → System → &quot;Use hardware acceleration when available&quot;
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-0 transition-colors duration-300" style={{ background: isDark ? '#000000' : '#F4F5F7' }}>
      <ForceGraph3D
        ref={fgRef}
        rendererConfig={{
          powerPreference: 'high-performance',
          antialias: true,
          alpha: false,
          failIfMajorPerformanceCaveat: true,
        }}
        graphData={displayData}
        nodeVisibility={false}
        linkVisibility={false}
        enableNavigationControls={!!isInteractive}
        enableNodeDrag={false}
        enablePointerInteraction={false}
        backgroundColor={isDark ? '#000000' : '#F4F5F7'}
        showNavInfo={false}
        cooldownTicks={Infinity}
        warmupTicks={0}
        d3AlphaDecay={0}
        d3VelocityDecay={1}
        d3AlphaMin={0.005}
        width={window.innerWidth}
        height={window.innerHeight}
      />

      {/* Stats Badge */}
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
          background: dataSource === 'live'
            ? 'rgba(48, 209, 88, 0.12)'
            : 'rgba(212, 175, 55, 0.12)',
          border: `1px solid ${dataSource === 'live'
            ? 'rgba(48, 209, 88, 0.3)'
            : 'rgba(212, 175, 55, 0.3)'}`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transition: 'all 0.6s ease',
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif",
        }}
      >
        {/* FPS Counter */}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: fps >= 50 ? '#30D158' : fps >= 25 ? '#FACC15' : '#FF453A',
            minWidth: '48px',
          }}
        >
          {fps} FPS
        </span>
        <span style={{ width: '1px', height: '14px', background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }} />
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: dataSource === 'live' ? '#30D158' : '#D4AF37',
            boxShadow: dataSource === 'live'
              ? '0 0 6px rgba(48, 209, 88, 0.6)'
              : '0 0 6px rgba(212, 175, 55, 0.6)',
            animation: dataSource === 'simulated' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
          }}
        />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.03em',
            color: dataSource === 'live' ? 'rgba(48, 209, 88, 0.9)' : 'rgba(180, 150, 30, 0.9)',
          }}
        >
          {dataSource === 'live' ? '● Live Graph' : '⟳ Simulated Data'}
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 500,
            color: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(15, 35, 80, 0.45)',
          }}
        >
          {nodeCount.toLocaleString()} nodes{edgeCount > 0 ? ` · ${edgeCount.toLocaleString()} edges` : ''}
        </span>
        {activeGpu && (
          <span
            style={{
              fontSize: '9px',
              fontWeight: 600,
              color: '#A855F7',
              borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
              paddingLeft: '8px',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            🎮 {activeGpu}
          </span>
        )}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
};

export default React.memo(NetworkBackground);
