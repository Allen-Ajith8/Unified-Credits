import React, { useRef, useEffect, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

const NetworkBackground = ({ graphData }) => {
  const fgRef = useRef();

  // Auto-rotate the camera
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;
    fg.cameraPosition({ x: 0, y: 0, z: 400 });
    let angle = 0;
    const rotate = () => {
      angle += 0.001;
      const distance = 400;
      fg.cameraPosition({
        x: distance * Math.sin(angle),
        y: 50 * Math.sin(angle * 0.5),
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
      renderer.setClearColor(0xF4F5F7, 1); // Pearl background
    }
    const controls = fgRef.current.controls();
    if (controls) {
      controls.enabled = false;
    }
  }, []);

  const starTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }, []);

  const nodeThreeObject = React.useCallback((node) => {
    const isDefault = node.is_default === 1;
    const score = node.credit_score || 500;
    
    // Sapphire: #0F2350, Teal: #006A67, Amethyst: #4A2C76, Gold: #D4AF37
    let color;
    if (isDefault) {
      color = new THREE.Color(0x4A2C76); // Amethyst
    } else if (score > 700) {
      color = new THREE.Color(0xD4AF37); // Gold
    } else if (score > 550) {
      color = new THREE.Color(0x006A67); // Teal
    } else {
      color = new THREE.Color(0x0F2350); // Sapphire
    }

    const size = (node.size || 1.5) * 1.5;
    const spriteMaterial = new THREE.SpriteMaterial({
      map: starTexture,
      color: color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(size * 4, size * 4, 1);
    return sprite;
  }, [starTexture]);

  return (
    <div className="fixed inset-0 z-0" style={{ background: '#F4F5F7' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={() => 'rgba(15, 35, 80, 0.08)'} /* Sapphire thin edges */
        linkWidth={0.4}
        linkOpacity={0.08}
        backgroundColor="#F4F5F7"
        showNavInfo={false}
        enableNodeDrag={false}
        enableNavigationControls={false}
        enablePointerInteraction={false}
        cooldownTicks={100}
        warmupTicks={50}
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.3}
        width={window.innerWidth}
        height={window.innerHeight}
      />
    </div>
  );
};

export default React.memo(NetworkBackground);
