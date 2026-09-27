import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ReactLenis } from 'lenis/react';
import { ThemeProvider } from 'next-themes';
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
    total_processed: null,
    running_default_rate: null,
    running_roc_auc: null,
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
    fetch(`/api/engine/${activeMode}/metrics`)
      .then(r => r.json())
      .then(data => {
        setApiData(prev => ({ ...prev, [activeMode]: data }));
      })
      .catch(() => {});
  }, [activeMode]);

  // Fetch ALL engine metrics on startup so comparison view has data
  useEffect(() => {
    ['a', 'b', 'c'].forEach(mode => {
      fetch(`/api/engine/${mode}/metrics`)
        .then(r => r.json())
        .then(data => {
          setApiData(prev => ({ ...prev, [mode]: data }));
        })
        .catch(() => {});
    });
  }, []);

  // Fetch initial graph for background
  useEffect(() => {
    fetch('/api/graph')
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

  // WebSocket connection with reconnection
  useEffect(() => {
    let ws;
    let reconnectTimer;
    let reconnectDelay = 1000;

    function connect() {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/live-metrics`);
      ws.onopen = () => {
        setIsConnected(true);
        reconnectDelay = 1000; // Reset on successful connect
      };
      ws.onclose = () => {
        setIsConnected(false);
        // Reconnect with exponential backoff (max 30s)
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          connect();
        }, reconnectDelay);
      };
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
        // If engines were updated, refetch all metrics
        if (data.type === 'engines_updated') {
          ['a', 'b', 'c'].forEach(mode => {
            fetch(`/api/engine/${mode}/metrics`)
              .then(r => r.json())
              .then(d => setApiData(prev => ({ ...prev, [mode]: d })))
              .catch(() => {});
          });
        }
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
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
    <ThemeProvider attribute="class" defaultTheme="light">
      <ReactLenis root>
        <div className="relative min-h-screen dark:bg-black">
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
      </ReactLenis>
    </ThemeProvider>
  );
}

export default App;
