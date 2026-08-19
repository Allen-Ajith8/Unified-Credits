import React, { useRef, useEffect, useMemo, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

const EDGE_COLORS = {
  'Shared Device': '#006A67',      // Teal
  'Shared IP': '#4A2C76',          // Amethyst
  'Shared UPI': '#D4AF37',         // Gold
};
const DEFAULT_EDGE_COLOR = '#0F2350';

const NetworkBackground = ({ graphData, onNodeClick }) => {
  const fgRef = useRef();
  const [dataSource, setDataSource] = useState('simulated');

  // Auto-rotate
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;
    fg.cameraPosition({ x: 0, y: 0, z: 500 });
    let angle = 0;
    const rotate = () => {
      angle += 0.0006;
      const distance = 500;
      fg.cameraPosition({
        x: distance * Math.sin(angle),
        y: 40 * Math.sin(angle * 0.3),
        z: distance * Math.cos(angle),
      });
    };
    const interval = setInterval(rotate, 30);
    return () => clearInterval(interval);
  }, []);

  // Renderer, controls, force tuning
  useEffect(() => {
    if (!fgRef.current) return;
    const renderer = fgRef.current.renderer();
    if (renderer) {
      renderer.setClearColor(0xF4F5F7, 1);
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
  }, []);

  // Shared geometry for nodes — low-poly spheres for better performance with 40k nodes
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(1, 6, 6), []);

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

    // Connected nodes: prominent. Isolated nodes: visible ambient particles.
    const opacity = isConnected
      ? (isDefault ? 0.9 : 0.8)
      : 0.7;

    const material = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity,
    });

    const mesh = new THREE.Mesh(sphereGeometry, material);

    // Connected nodes are normal size, isolated ones slightly smaller
    const size = isConnected
      ? (isDefault ? 1.2 : 0.7)
      : 0.65;
    mesh.scale.set(size, size, size);
    return mesh;
  }, [sphereGeometry]);

  // Edge color by type — returns CSS hex strings
  const linkColor = React.useCallback((link) => {
    return EDGE_COLORS[link.type] || DEFAULT_EDGE_COLOR;
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
      if (node.x === undefined || node.y === undefined || node.z === undefined) {
        if (isConn) {
          // Spawn near center
          node.x = (Math.random() - 0.5) * centerRadius * 2;
          node.y = (Math.random() - 0.5) * centerRadius * 2;
          node.z = (Math.random() - 0.5) * centerRadius * 2;
        } else {
          // Spread around the connected core
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const r = outerMin + Math.random() * (outerMax - outerMin);
          node.x = r * Math.sin(phi) * Math.cos(theta);
          node.y = r * Math.sin(phi) * Math.sin(theta);
          node.z = r * Math.cos(phi);
        }
      }
    }

    setDataSource(isLive ? 'live' : 'simulated');
    return { nodes, links };
  }, [graphData]);

  const nodeCount = displayData.nodes?.length || 0;
  const edgeCount = displayData.links?.length || 0;

  return (
    <div className="fixed inset-0 z-0" style={{ background: '#F4F5F7' }}>
      <ForceGraph3D
        ref={fgRef}
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
          const color = EDGE_COLORS[edgeType] || DEFAULT_EDGE_COLOR;
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
        backgroundColor="#F4F5F7"
        showNavInfo={false}
        enableNodeDrag={false}
        enableNavigationControls={false}
        enablePointerInteraction={true}
        onNodeClick={onNodeClick || undefined}
        cooldownTicks={0}
        warmupTicks={0}
        d3AlphaDecay={1}
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
            color: 'rgba(15, 35, 80, 0.45)',
            letterSpacing: '0.02em',
          }}
        >
          {nodeCount.toLocaleString()} nodes{edgeCount > 0 ? ` · ${edgeCount.toLocaleString()} edges` : ''}
        </span>
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
