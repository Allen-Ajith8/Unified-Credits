import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const AICopilot = ({ onClose, selectedNode }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Welcome to the **UCE AI Copilot**. I can answer questions about borrower risk, graph connections, and fraud patterns.\n\nTry asking:\n• *"Why is borrower #120 risky?"*\n• *"Who shares an IP with borrower #50?"*\n• *"Explain the default risk in the central cluster."*',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copilotStatus, setCopilotStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Check copilot status
  useEffect(() => {
    fetch('/api/copilot/status')
      .then(r => r.json())
      .then(data => setCopilotStatus(data))
      .catch(() => setCopilotStatus({ ingested: false, error: 'Backend not reachable' }));
  }, []);

  // If a node is selected, pre-fill context
  useEffect(() => {
    if (selectedNode && selectedNode.name) {
      setInput(`Tell me about ${selectedNode.name} (Row #${selectedNode.id})`);
    }
  }, [selectedNode]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage,
          node_id: selectedNode?.id ?? null,
        }),
      });
      const data = await response.json();
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || 'No response received.',
          status: data.status,
        },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠ Could not reach the backend. Make sure the server is running on port 8000.',
          status: 'error',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Simple markdown-like rendering
  const renderContent = (text) => {
    return text.split('\n').map((line, i) => {
      let processed = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');

      if (line.startsWith('• ') || line.startsWith('- ')) {
        processed = `<span style="margin-left: 8px">${processed}</span>`;
      }

      return (
        <span key={i} dangerouslySetInnerHTML={{ __html: processed }} style={{ display: 'block', minHeight: line === '' ? '8px' : 'auto' }} />
      );
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-50"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Top bar with back button and status */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full hover:bg-white/20 transition-all font-semibold flex items-center gap-2"
          style={{ color: '#0F2350', fontSize: '13px' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to Dashboard
        </button>

        <div
          className="backdrop-blur-xl"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 16px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.18)',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0F2350, #006A67)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
          >
            🧠
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F2350', letterSpacing: '-0.01em' }}>
              UCE AI Copilot
            </div>
            <div style={{ fontSize: '9px', color: '#86868B', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: copilotStatus?.ingested ? '#30D158' : copilotStatus?.error ? '#FF453A' : '#FFD60A',
                  display: 'inline-block',
                }}
              />
              {copilotStatus?.ingested
                ? 'Phi-3.5 · Knowledge Graph Ready'
                : copilotStatus?.error
                  ? 'Ollama Offline'
                  : 'Initializing...'}
            </div>
          </div>
        </div>
      </div>

      {/* Chat container — centered, full height */}
      <div
        style={{
          position: 'absolute',
          top: '80px',
          bottom: '0',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '680px',
          display: 'flex',
          flexDirection: 'column',
          padding: '0 16px',
        }}
      >
        {/* Messages area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 3%, black 97%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 3%, black 97%, transparent 100%)',
          }}
        >
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i === 0 ? 0.3 : 0 }}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '14px 18px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #0F2350, #1a3a6e)'
                    : 'rgba(255, 255, 255, 0.75)',
                  backdropFilter: msg.role === 'user' ? 'none' : 'blur(20px)',
                  WebkitBackdropFilter: msg.role === 'user' ? 'none' : 'blur(20px)',
                  color: msg.role === 'user' ? '#fff' : '#0F2350',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  letterSpacing: '-0.005em',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(15, 35, 80, 0.06)',
                  boxShadow: msg.role === 'user'
                    ? '0 4px 16px rgba(15, 35, 80, 0.3)'
                    : '0 2px 8px rgba(0,0,0,0.05)',
                }}
              >
                {renderContent(msg.content)}
              </div>
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: 'flex', justifyContent: 'flex-start' }}
            >
              <div
                style={{
                  padding: '14px 22px',
                  borderRadius: '18px 18px 18px 4px',
                  background: 'rgba(255, 255, 255, 0.75)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(15, 35, 80, 0.06)',
                  color: '#86868B',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div className="copilot-typing">
                  <span /><span /><span />
                </div>
                Reasoning...
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar — pinned to bottom */}
        <div style={{ padding: '12px 0 24px 0' }}>
          {selectedNode && (
            <div
              style={{
                fontSize: '10px',
                color: '#006A67',
                marginBottom: '8px',
                padding: '5px 10px',
                background: 'rgba(0, 106, 103, 0.08)',
                backdropFilter: 'blur(12px)',
                borderRadius: '8px',
                display: 'inline-block',
                border: '1px solid rgba(0, 106, 103, 0.12)',
              }}
            >
              🔗 Context: {selectedNode.name} (Row #{selectedNode.id})
            </div>
          )}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              padding: '10px 14px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.65)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(15, 35, 80, 0.08)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about any borrower, cluster, or risk pattern..."
              style={{
                flex: 1,
                padding: '8px 4px',
                border: 'none',
                background: 'transparent',
                fontSize: '14px',
                color: '#0F2350',
                outline: 'none',
                letterSpacing: '-0.01em',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                border: 'none',
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg, #0F2350, #006A67)'
                  : 'rgba(15, 35, 80, 0.06)',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.25s',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !loading ? '#fff' : '#86868B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Typing indicator animation */}
      <style>{`
        .copilot-typing {
          display: flex;
          gap: 3px;
          align-items: center;
        }
        .copilot-typing span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #86868B;
          animation: copilotBounce 1.2s infinite ease-in-out;
        }
        .copilot-typing span:nth-child(2) { animation-delay: 0.15s; }
        .copilot-typing span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes copilotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </motion.div>
  );
};

export default AICopilot;
