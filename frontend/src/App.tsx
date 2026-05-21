import React, { useState } from 'react';
import { useOllamaStream } from './hooks/useOllamaStream';
import type { Message } from './hooks/useOllamaStream';

export default function App() {
  // Extract real-time stream status engines from our unified custom out-of-band hook
  const { streamData, isStreaming, streamError, executeStream, clearStream } = useOllamaStream();
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  
  // Immutably locked systemic engine instructions mirroring architectural contracts
  const SYSTEM_PROMPT = "You are H.I.V.E., a hardened local AI orchestration assistant. Provide precise, professional, and accurate technical solutions.";

  /**
   * Linear, performance-optimized execution thread handling data submission,
   * socket generation pipelines, and array historical commits without side-effects.
   */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isStreaming) return;

    // 1. Stage the new user prompt frame locally to render the user's transmission block
    const newUserMessage: Message = { role: 'user', content: userInput };
    const updatedHistory = [...chatHistory, newUserMessage];
    setChatHistory(updatedHistory);
    setUserInput('');
    clearStream();

    // 2. Dispatch the array stack across the wire and await the final accumulated text chunk string
    const finalAssistantResponse = await executeStream(updatedHistory, { systemPrompt: SYSTEM_PROMPT });
    
    // 3. Imperatively commit the finished response directly inside the event chain path
    if (finalAssistantResponse) {
      setChatHistory((prev) => [...prev, { role: 'assistant', content: finalAssistantResponse }]);
      clearStream();
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-darker)', fontFamily: 'sans-serif' }}>
      
      {/* SIDEBAR CONTAINER PANEL */}
      <aside style={{ width: '280px', background: 'var(--bg-surface)', borderRight: '1px solid var(--border-glow)', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {/* Brand Row & Adaptive Connection State Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: isStreaming ? 'var(--neon-cyan)' : 'var(--maroon-glow)', boxShadow: isStreaming ? '0 0 8px var(--neon-cyan)' : 'none' }}></div>
            <h1 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '2px', color: 'var(--text-main)', fontWeight: 800 }}>H.I.V.E.</h1>
          </div>
          
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '10px' }}>System Profile</div>
          <div style={{ background: 'var(--bg-darker)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--maroon-primary)', fontSize: '0.85rem', marginBottom: '20px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Engine:</span> <strong style={{ color: 'var(--neon-purple)' }}>llama3.1 (8B)</strong>
          </div>
        </div>

        {/* ACTIVE HARDWARE MONITOR BOUNDARY DISPLAY (8GB VRAM Limits Safeguard) */}
        <div style={{ background: 'var(--bg-darker)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-glow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '5px' }}>
            <span style={{ color: 'var(--text-muted)' }}>GPU VRAM allocation</span>
            <span style={{ color: 'var(--maroon-glow)' }}>~6.5GB Cap</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: '72%', height: '100%', background: 'linear-gradient(90deg, var(--maroon-primary), var(--maroon-glow))' }}></div>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>Isolated Local Runtime Secure</div>
        </div>
      </aside>

      {/* CORE CHAT WINDOW CONSOLE */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* TOP STATUS HEADER */}
        <header style={{ height: '60px', borderBottom: '1px solid var(--border-glow)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', padding: '0 30px', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Operational Node: <span style={{ color: 'var(--neon-cyan)' }}>127.0.0.1:8000</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-darker)', padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--border-glow)' }}>
            Status: <span style={{ color: '#10b981' }}>ONLINE</span>
          </div>
        </header>

        {/* HISTORIC STREAM CHAT CONSOLE AREA */}
        <section style={{ flex: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {chatHistory.length === 0 && !streamData && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '400px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                H.I.V.E. Core Operational Console Interface initialized. Enter a localized transmission token request below to execute isolated model inference.
              </p>
            </div>
          )}

          {/* Render historical back-and-forth communication rows from state memory */}
          {chatHistory.map((msg, idx) => (
            <div key={idx} style={{ padding: '15px 20px', borderRadius: '8px', maxWidth: '85%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', background: msg.role === 'user' ? 'var(--maroon-primary)' : 'var(--bg-surface)', border: msg.role === 'user' ? 'none' : '1px solid var(--border-glow)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {msg.role === 'user' ? 'TRANSMISSION' : 'H.I.V.E CORE RESPONSE'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            </div>
          ))}

          {/* ACTIVE INCOMING CHUNK TOKEN RENDER NODE (Neon Border Frame Aura) */}
          {streamData && (
            <div style={{ padding: '15px 20px', borderRadius: '8px', maxWidth: '85%', alignSelf: 'flex-start', background: 'var(--bg-surface)', border: '1px solid var(--neon-cyan)', fontSize: '0.95rem', lineHeight: '1.5', boxShadow: '0 0 10px rgba(0, 242, 254, 0.05)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--neon-cyan)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                STREAMING LIVE CHUNKS...
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-main)' }}>
                {streamData}
                <span style={{ color: 'var(--neon-cyan)', marginLeft: '2px', fontWeight: 'bold' }}>_</span>
              </div>
            </div>
          )}

          {/* ERROR EXCEPTION WARNING BANNER */}
          {streamError && (
            <div style={{ padding: '15px 20px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '0.9rem', maxWidth: '85%' }}>
              <strong>System Halt Exception:</strong> {streamError}
            </div>
          )}
        </section>

        {/* INPUT TRANSMISSION CONTROL BOX */}
        <footer style={{ padding: '20px 30px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-glow)' }}>
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: '15px' }}>
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={isStreaming ? "Awaiting engine pipeline depletion loop..." : "Transmit prompt payload to local AI engine..."}
              disabled={isStreaming}
              style={{ flex: 1, background: 'var(--bg-darker)', border: '1px solid var(--border-glow)', borderRadius: '6px', padding: '12px 18px', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s' }}
            />
            <button
              type="submit"
              disabled={isStreaming || !userInput.trim()}
              style={{ background: isStreaming || !userInput.trim() ? '#1e293b' : 'linear-gradient(135deg, var(--maroon-primary), var(--maroon-glow))', color: isStreaming || !userInput.trim() ? 'var(--text-muted)' : 'var(--text-main)', border: 'none', padding: '0 25px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', cursor: isStreaming || !userInput.trim() ? 'not-allowed' : 'pointer', letterSpacing: '1px', transition: 'all 0.2s' }}
            >
              {isStreaming ? 'STREAMING' : 'TRANSMIT'}
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}