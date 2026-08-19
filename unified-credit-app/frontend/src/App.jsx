import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoadingScreen from './components/LoadingScreen';
import NetworkBackground from './components/NetworkBackground';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import DashboardCard from './components/DashboardCard';
import MethodologySection from './components/MethodologySection';
import InsightsSection from './components/InsightsSection';
import Footer from './components/Footer';
import AICopilot from './components/AICopilot';

function App() {
  const [bgReady, setBgReady] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  const [liveData, setLiveData] = useState({
    total_processed: 0,
    running_default_rate: 0,
    running_roc_auc: 0,
    fraud_alerts: 0,
    history: [],
  });
  const [isConnected, setIsConnected] = useState(false);

  const [activeMode, setActiveMode] = useState("a");
  const [apiData, setApiData] = useState({});
  const [show3DView, setShow3DView] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  // Fetch real engine metrics from API when mode changes
  useEffect(() => {
    fetch(`http://localhost:8000/api/engine/${activeMode}/metrics`)
      .then(r => r.json())
      .then(data => {
        setApiData(prev => ({ ...prev, [activeMode]: data }));
      })
      .catch(() => {});
  }, [activeMode]);

  // Fetch initial graph for background
  useEffect(() => {
    fetch('http://localhost:8000/api/graph')
      .then(r => r.json())
      .then(data => {
        setGraphData(data);
        // Give Three.js a moment to render, then mark ready
        setTimeout(() => setBgReady(true), 2000);
      })
      .catch(() => {
        // If backend isn't up, still allow entry after timeout
        setTimeout(() => setBgReady(true), 4000);
      });
  }, []);

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/live-metrics');
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLiveData(prev => {
        const newHistory = [...prev.history, {
          time: new Date().toLocaleTimeString(),
          default_rate: data.running_default_rate,
        }].slice(-30);
        return { ...data, history: newHistory };
      });
    };
    return () => ws.close();
  }, []);

  // When bg is ready OR user skips, reveal the content
  useEffect(() => {
    if (bgReady || skipped) {
      setShowContent(true);
    }
  }, [bgReady, skipped]);

  const handleSkip = useCallback(() => {
    setSkipped(true);
  }, []);

  const handleGraphUpdate = useCallback((data) => {
    setGraphData(data);
  }, []);

  const handleOpenChat = useCallback(() => {
    setShowChat(true);
    setShow3DView(false);
  }, []);

  const handleCloseChat = useCallback(() => {
    setShowChat(false);
    setSelectedNode(null);
  }, []);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    setShowChat(true);
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* 3D Background — always renders, loads in background */}
      <NetworkBackground graphData={graphData} isInteractive={show3DView || showChat} onNodeClick={handleNodeClick} />

      {/* Loading Screen — hides when content should show */}
      {!showContent && !show3DView && !showChat && (
        <LoadingScreen ready={bgReady} onSkip={handleSkip} />
      )}

      {/* Main Content — fades in. Hidden when 3D or Chat is active */}
      {!show3DView && !showChat && (
        <div
          className={`relative z-10 transition-opacity duration-1000 ${
            showContent ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <Navbar isConnected={isConnected} onOpen3D={() => setShow3DView(true)} onOpenChat={handleOpenChat} />
          <HeroSection />
          <DashboardCard liveData={liveData} onGraphUpdate={handleGraphUpdate} activeMode={activeMode} setActiveMode={setActiveMode} apiData={apiData} />
          <MethodologySection activeMode={activeMode} apiData={apiData} />
          <InsightsSection activeMode={activeMode} apiData={apiData} />
          <Footer />
        </div>
      )}

      {/* 3D Hologram View — full takeover */}
      {show3DView && (
        <div className={`relative z-50 transition-opacity duration-1000 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute top-6 left-6">
            <button
              onClick={() => setShow3DView(false)}
              className="px-6 py-2.5 bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-full hover:bg-white/20 transition-all font-semibold shadow-[0_0_20px_rgba(0,106,103,0.3)] flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Exit Hologram
            </button>
          </div>
        </div>
      )}

      {/* AI Copilot Chat — full takeover, same as 3D view */}
      {showChat && (
        <AICopilot onClose={handleCloseChat} selectedNode={selectedNode} />
      )}
    </div>
  );
}

export default App;
