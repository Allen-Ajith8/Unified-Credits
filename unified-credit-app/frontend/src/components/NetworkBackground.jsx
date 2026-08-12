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
      renderer.setClearColor(0x050a18, 1); // Very dark blue-black
    }
    const controls = fgRef.current.controls();
    if (controls) {
      controls.enabled = false;
    }
  }, []);

  // Glow texture for star-like nodes
  const starTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Outer soft glow
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    
    return new THREE.CanvasTexture(canvas);
  }, []);

  const nodeThreeObject = React.useCallback((node) => {
    const isDefault = node.is_default === 1;
    const score = node.credit_score || 500;
    const prob = node.prob || 0.5;
    
    // Color based on risk profile using our palette
    let color;
    if (isDefault) {
      color = new THREE.Color(0x4A2C76); // Amethyst — defaulters
    } else if (score > 750) {
      color = new THREE.Color(0xD4AF37); // Gold — premium borrowers
    } else if (score > 600) {
      color = new THREE.Color(0x006A67); // Teal — healthy cash flow
    } else {
      color = new THREE.Color(0x0F2350).lerp(new THREE.Color(0x3366CC), 0.4); // Lighter sapphire — visible
    }

    // Size: defaulters slightly bigger for visibility, base size larger overall
    const baseSize = isDefault ? 5 : 3;
    const sizeMultiplier = node.size || 1.5;
    const finalSize = baseSize * sizeMultiplier;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: starTexture,
      color: color,
      transparent: true,
      opacity: isDefault ? 0.95 : 0.75,
      blending: THREE.AdditiveBlending, // Glow effect
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(finalSize, finalSize, 1);
    return sprite;
  }, [starTexture]);

  // Generate default scattered nodes if no data from API yet
  const displayData = useMemo(() => {
    if (graphData && graphData.nodes && graphData.nodes.length > 0) {
      return graphData;
    }
    // Generate 3340 placeholder stars while waiting for API
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
    <div className="fixed inset-0 z-0" style={{ background: '#050a18' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={displayData}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={() => 'rgba(100, 140, 255, 0.06)'}
        linkWidth={0.3}
        linkOpacity={0.06}
        backgroundColor="#050a18"
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
