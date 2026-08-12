import React, { useRef, useEffect, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

const NetworkBackground = ({ graphData }) => {
  const fgRef = useRef();

  // Auto-rotate the camera
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;
    fg.cameraPosition({ x: 0, y: 0, z: 600 });
    let angle = 0;
    const rotate = () => {
      angle += 0.0008;
      const distance = 600;
      fg.cameraPosition({
        x: distance * Math.sin(angle),
        y: 80 * Math.sin(angle * 0.3),
        z: distance * Math.cos(angle),
      });
    };
    const interval = setInterval(rotate, 30);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!fgRef.current) return;
    const renderer = fgRef.current.renderer();
    if (renderer) {
      renderer.setClearColor(0xF4F5F7, 1); // Cream/slate pearl background
    }
    const controls = fgRef.current.controls();
    if (controls) {
      controls.enabled = false;
    }
  }, []);

  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(1, 12, 12), []);

  const nodeThreeObject = React.useCallback((node) => {
    const isDefault = node.is_default === 1;
    const score = node.credit_score || 500;
    
    // Color based on risk profile using the deep vibrant palette
    let colorHex;
    if (isDefault) {
      colorHex = 0x4A2C76; // Digital Amethyst — defaulters
    } else if (score > 750) {
      colorHex = 0x006A67; // Dynamic Teal
    } else if (score > 600) {
      colorHex = 0xD4AF37; // Brushed Gold
    } else {
      colorHex = 0x0F2350; // Deep Sapphire
    }

    const material = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: isDefault ? 1.0 : 0.85,
    });
    
    const mesh = new THREE.Mesh(sphereGeometry, material);
    
    // Solid base size. Defaulters slightly larger
    const baseSize = isDefault ? 4.5 : 2.5;
    const sizeMultiplier = node.size || 1.5;
    const finalSize = baseSize * sizeMultiplier;
    
    mesh.scale.set(finalSize, finalSize, finalSize);
    return mesh;
  }, [sphereGeometry]);

  // Generate default scattered nodes if no data from API yet
  const displayData = useMemo(() => {
    if (graphData && graphData.nodes && graphData.nodes.length > 0) {
      return graphData;
    }
    // Generate 3340 placeholder nodes while waiting for API
    const nodes = [];
    for (let i = 0; i < 3340; i++) {
      nodes.push({
        id: i,
        credit_score: Math.floor(Math.random() * 500) + 300,
        is_default: Math.random() < 0.26 ? 1 : 0,
        size: 1 + Math.random() * 1.5,
      });
    }
    return { nodes, links: [] };
  }, [graphData]);

  return (
    <div className="fixed inset-0 z-0" style={{ background: '#F4F5F7' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={displayData}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={() => 'rgba(15, 35, 80, 0.15)'}
        linkWidth={0.5}
        linkOpacity={0.2}
        backgroundColor="#F4F5F7"
        showNavInfo={false}
        enableNodeDrag={false}
        enableNavigationControls={false}
        enablePointerInteraction={false}
        cooldownTicks={150}
        warmupTicks={80}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.25}
        d3AlphaMin={0.001}
        width={window.innerWidth}
        height={window.innerHeight}
      />
    </div>
  );
};

export default React.memo(NetworkBackground);
