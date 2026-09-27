import React, { useRef, useEffect, useMemo, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { animate } from 'animejs';
import { useTheme } from 'next-themes';

const EDGE_COLORS = {
  'Shared Device': '#006A67',      // Teal
  'Shared IP': '#4A2C76',          // Amethyst
  'Shared UPI': '#D4AF37',         // Gold
};
const DEFAULT_EDGE_COLOR = '#0F2350';

// Shared geometry — allocated once in VRAM, reused by all 4000+ nodes
const sharedSphereGeometry = new THREE.SphereGeometry(1, 8, 8);

const NetworkBackground = ({ graphData, onNodeClick }) => {
  const fgRef = useRef();
  const [dataSource, setDataSource] = useState('simulated');
  const [webglError, setWebglError] = useState(false);
  const [activeGpu, setActiveGpu] = useState(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Fallback UI when hardware acceleration is unavailable
  if (webglError) {
    return (
      <div className="fixed inset-0 z-0 flex items-center justify-center" style={{ background: isDark ? '#000000' : '#F4F5F7' }}>
        <div className="text-center p-8 border border-red-500/30 rounded-2xl bg-red-500/10 backdrop-blur-md max-w-md">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-red-400 mb-2">Hardware Acceleration Required</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Your browser is using a software renderer (SwiftShader/llvmpipe) instead of your GPU.
            Please enable hardware acceleration in your browser settings to view the 3D graph.
          </p>
          <p className="text-xs text-gray-500 mt-3">
            Chrome: Settings → System → "Use hardware acceleration when available"
          </p>
        </div>
      </div>
    );
  }

  // Auto-rotate
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;
    fg.cameraPosition({ x: 0, y: 0, z: 380 });
    let angle = 0;
    const rotate = () => {
      angle += 0.0006;
      const distance = 380;
      fg.cameraPosition({
        x: distance * Math.sin(angle),
        y: 40 * Math.sin(angle * 0.3),
        z: distance * Math.cos(angle),
      });
    };
    const interval = setInterval(rotate, 30);
    return () => clearInterval(interval);
  }, []);

  // Renderer, controls, force tuning + GPU detection
  useEffect(() => {
    if (!fgRef.current) return;
    const renderer = fgRef.current.renderer();
    if (!renderer) {
      setWebglError(true);
      return;
    }

    renderer.setClearColor(isDark ? 0x000000 : 0xF4F5F7, 1);

    // ---- GPU Detection ----
    try {
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const gpuName = dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER);
      console.log('Active renderer:', gpuName);
      setActiveGpu(gpuName);

      // Detect software rasterizer
      const lower = gpuName.toLowerCase();
      if (lower.includes('swiftshader') || lower.includes('llvmpipe') || lower.includes('software')) {
        console.warn('⚠ Software rasterizer detected! GPU acceleration is not active.');
        setWebglError(true);
        return;
      }
    } catch (e) {
      console.warn('Could not detect GPU:', e);
    }

    const controls = fgRef.current.controls();
    if (controls) {
      controls.enabled = false;
    }

    const fg = fgRef.current;
    if (fg.d3Force) {
      const charge = fg.d3Force('charge');
      if (charge) {
        charge.strength(-4).distanceMax(150);
      }
      const link = fg.d3Force('link');
      if (link) {
        link.distance(18).strength(0.5);
      }
    }
  }, [isDark]);

  // Material cache — only ~8 unique materials instead of 4000+
  // This is the single biggest draw-call optimization: shared materials
  // allow Three.js to batch geometry into fewer GPU calls.
  const getMaterial = useMemo(() => {
    const cache = {};
    return (colorHex, opacity) => {
      const key = `${colorHex}_${opacity}`;
      if (!cache[key]) {
        cache[key] = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity,
        });
      }
      return cache[key];
    };
  }, []);

  const nodeThreeObject = React.useCallback((node) => {
    const isDefault = node.is_default === 1;
    const score = node.credit_score || 500;
    const isConnected = node._connected;

    let colorHex;
    if (isDefault) {
      colorHex = 0x4A2C76;
    } else if (score > 750) {
      colorHex = 0x006A67;
    } else if (score > 600) {
      colorHex = 0xD4AF37;
    } else {
      colorHex = 0x0F2350;
    }

    const opacity = isConnected
      ? (isDefault ? 0.9 : 0.8)
      : 0.7;

    const material = getMaterial(colorHex, opacity);
    const mesh = new THREE.Mesh(sharedSphereGeometry, material);

    const size = isConnected
      ? (isDefault ? 1.2 : 0.7)
      : 0.65;
      
    mesh.scale.set(size, size, size);
    
    return mesh;
  }, [getMaterial]);

  // Edge color by type — returns CSS hex strings
  const linkColor = React.useCallback((link) => {
    return isDark ? (link.type === 'Shared Device' ? '#2DD4BF' : link.type === 'Shared IP' ? '#A855F7' : link.type === 'Shared UPI' ? '#FACC15' : '#60A5FA') : (EDGE_COLORS[link.type] || DEFAULT_EDGE_COLOR);
  }, []);

  // Generate clustered placeholder data OR use real API data
  // Tag nodes as connected/isolated and assign initial positions
  const displayData = useMemo(() => {
    let nodes, links;
    let isLive = false;

    if (graphData && graphData.nodes && graphData.nodes.length > 0) {
      isLive = true;
      nodes = [...graphData.nodes];
      links = [...(graphData.links || [])];
    } else {
      // Generate simulated data
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

    // Build set of connected node IDs
    const connectedIds = new Set();
    for (const link of links) {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      connectedIds.add(srcId);
      connectedIds.add(tgtId);
    }

    // Tag nodes and assign initial positions
    // Connected → near center. Isolated → spread around them.
    const centerRadius = 80;
    const outerMin = 100;
    const outerMax = 250;

    for (const node of nodes) {
      const id = node.id;
      const isConn = connectedIds.has(id);
      node._connected = isConn;

      // Only assign positions if they don't already have them from the server
      if (node._targetX === undefined) {
        let tx, ty, tz;
        if (isConn) {
          // Spawn near center
          tx = (Math.random() - 0.5) * centerRadius * 2;
          ty = (Math.random() - 0.5) * centerRadius * 2;
          tz = (Math.random() - 0.5) * centerRadius * 2;
        } else {
          // Spread around the connected core
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
        
        // Start all at a single point for the big bang effect
        // Using fx, fy, fz makes them immune to physics, but they will still be rendered
        node.fx = 0;
        node.fy = 0;
        node.fz = 0;
        
        animate(node, {
          fx: tx,
          fy: ty,
          fz: tz,
          duration: 3000 + Math.random() * 2000, // Organic settling time
          delay: 0, // No delay, all burst out immediately from the "single node"
          ease: 'easeOutQuint' // Buttery smooth deceleration
        });
      }
    }

    setDataSource(isLive ? 'live' : 'simulated');
    return { nodes, links };
  }, [graphData]);

  const nodeCount = displayData.nodes?.length || 0;
  const edgeCount = displayData.links?.length || 0;

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
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={(node) => `
          <div style="background: rgba(15, 35, 80, 0.92); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); font-family: 'SF Pro Display', -apple-system, sans-serif; backdrop-filter: blur(8px); min-width: 140px;">
            <div style="color: #fff; font-weight: 600; font-size: 13px; margin-bottom: 4px;">${node.name || 'Unknown'}</div>
            <div style="color: #D4AF37; font-size: 11px; font-weight: 500;">Row #${node.id}</div>
            <div style="color: rgba(255,255,255,0.5); font-size: 10px; margin-top: 3px;">Credit Score: ${node.credit_score || '—'} ${node.is_default ? '· ⚠ Defaulter' : ''}</div>
          </div>
        `}
        linkLabel={(link) => {
          const srcName = typeof link.source === 'object' ? (link.source.name || `Row #${link.source.id}`) : `Node ${link.source}`;
          const tgtName = typeof link.target === 'object' ? (link.target.name || `Row #${link.target.id}`) : `Node ${link.target}`;
          const edgeType = link.type || 'Unknown';
          const color = isDark ? (edgeType === 'Shared Device' ? '#2DD4BF' : edgeType === 'Shared IP' ? '#A855F7' : edgeType === 'Shared UPI' ? '#FACC15' : '#60A5FA') : (EDGE_COLORS[edgeType] || DEFAULT_EDGE_COLOR);
          return `
            <div style="background: rgba(15, 35, 80, 0.92); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); font-family: 'SF Pro Display', -apple-system, sans-serif; backdrop-filter: blur(8px); min-width: 160px;">
              <div style="color: ${color}; font-weight: 700; font-size: 12px; margin-bottom: 6px; letter-spacing: 0.03em;">${edgeType}</div>
              <div style="color: rgba(255,255,255,0.7); font-size: 11px; margin-bottom: 2px;">⬤ ${srcName}</div>
              <div style="color: rgba(255,255,255,0.7); font-size: 11px;">⬤ ${tgtName}</div>
            </div>
          `;
        }}
        linkColor={linkColor}
        linkWidth={0.3}
        linkOpacity={0.15}
        nodeRelSize={2}
        backgroundColor={isDark ? '#000000' : '#F4F5F7'}
        showNavInfo={false}
        enableNodeDrag={false}
        enableNavigationControls={false}
        enablePointerInteraction={true}
        onNodeClick={onNodeClick || undefined}
        cooldownTicks={Infinity}
        warmupTicks={0}
        d3AlphaDecay={0}
        d3VelocityDecay={1}
        d3AlphaMin={0.005}
        width={window.innerWidth}
        height={window.innerHeight}
      />

      {/* Live Data-Source Indicator Badge */}
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
            transition: 'all 0.6s ease',
          }}
        />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.03em',
            color: dataSource === 'live'
              ? 'rgba(48, 209, 88, 0.9)'
              : 'rgba(180, 150, 30, 0.9)',
            transition: 'color 0.6s ease',
          }}
        >
          {dataSource === 'live' ? '● Live Graph' : '⟳ Simulated Data'}
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 500,
            color: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(15, 35, 80, 0.45)',
            letterSpacing: '0.02em',
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
              letterSpacing: '0.02em',
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
