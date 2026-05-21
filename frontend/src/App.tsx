import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-bash';

import { useOllamaStream } from './hooks/useOllamaStream';
import type { Message } from './hooks/useOllamaStream';

export default function App() {
  const { streamData, isStreaming, streamError, executeStream, clearStream } = useOllamaStream();
  const [userInput, setUserInput] = useState<string>('');
  
  // UI Ingestion Status States
  const [uploadStatus, setUploadStatus] = useState<string>('READY');
  const [uploadMessage, setUploadMessage] = useState<string>('');

  // FEATURE STATE: Initialize chat memory tracking right out of local storage
  const [chatHistory, setChatHistory] = useState<Message[]>(() => {
    const cachedMemory = localStorage.getItem('HIVE_SESSION_THREAD');
    return cachedMemory ? JSON.parse(cachedMemory) : [];
  });
  
  // PERSISTENCE MONITOR: Sync updates to browser state domains smoothly
  useEffect(() => {
    localStorage.setItem('HIVE_SESSION_THREAD', JSON.stringify(chatHistory));
    Prism.highlightAll();
  }, [chatHistory, streamData]);

  const SYSTEM_PROMPT = "You are H.I.V.E., a hardened local AI orchestration assistant. Provide precise, professional, and accurate technical solutions.";

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isStreaming) return;

    const newUserMessage: Message = { role: 'user', content: userInput };
    const updatedHistory = [...chatHistory, newUserMessage];
    setChatHistory(updatedHistory);
    setUserInput('');
    clearStream();

    const finalAssistantResponse = await executeStream(updatedHistory, { systemPrompt: SYSTEM_PROMPT });
    
    if (finalAssistantResponse) {
      setChatHistory((prev) => [...prev, { role: 'assistant', content: finalAssistantResponse }]);
      clearStream();
    }
  };

  // HANDLER METHOD: Upload document frame safely straight to backend API
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetFile = e.target.files?.[0];
    if (!targetFile) return;

    setUploadStatus('INGESTING');
    setUploadMessage(`Compiling vector grid for: ${targetFile.name}...`);

    const formData = new FormData();
    formData.append('file', targetFile);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadStatus('SUCCESS');
        setUploadMessage(`Success: ${targetFile.name} fully vectorized.`);
        // Reset message indicator back to standard idle layout after 4 seconds
        setTimeout(() => { setUploadStatus('READY'); setUploadMessage(''); }, 4000);
      } else {
        setUploadStatus('ERROR');
        setUploadMessage(`Error: ${data.detail || 'Upload pipeline failed.'}`);
      }
    } catch (err) {
      // ✅ RESOLVED ESLint Warning: Used variable 'err' to log connection fault context telemetry
      console.error('H.I.V.E. UI Ingestion Gateway Exception Error Stack:', err);
      setUploadStatus('ERROR');
      setUploadMessage('Error: Connection to H.I.V.E. gateway dropped.');
    }
  };

  const handleWipeConsole = () => {
    if (window.confirm("Initialize complete conversation thread memory wipe?")) {
      setChatHistory([]);
      localStorage.removeItem('HIVE_SESSION_THREAD');
      clearStream();
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-darker)', fontFamily: 'sans-serif', color: 'var(--text-main)' }}>
      
      {/* SIDEBAR CONTAINER PANEL */}
      <aside style={{ width: '280px', background: 'var(--bg-surface)', borderRight: '1px solid var(--border-glow)', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: isStreaming ? 'var(--neon-cyan)' : 'var(--maroon-glow)', boxShadow: isStreaming ? '0 0 8px var(--neon-cyan)' : 'none' }}></div>
            <h1 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '2px', fontWeight: 800 }}>H.I.V.E.</h1>
          </div>
          
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '10px' }}>System Profile</div>
            <div style={{ background: 'var(--bg-darker)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--maroon-primary)', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Engine:</span> <strong style={{ color: 'var(--neon-purple)' }}>llama3.1 (8B)</strong>
            </div>
          </div>

          {/* REAL-TIME UI KNOWLEDGE INGESTION PANEL (RAG UPLOADER) */}
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '10px' }}>Knowledge Ingestion</div>
            <label style={{ 
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
              padding: '15px 10px', background: 'var(--bg-darker)', border: '1px dashed var(--border-glow)', 
              borderRadius: '6px', cursor: uploadStatus === 'INGESTING' ? 'not-allowed' : 'pointer', textAlign: 'center', transition: 'border-color 0.2s' 
            }}>
              <span style={{ fontSize: '0.8rem', color: uploadStatus === 'ERROR' ? '#fca5a5' : uploadStatus === 'SUCCESS' ? '#10b981' : 'var(--text-main)', fontWeight: 'bold' }}>
                {uploadStatus === 'READY' && '📁 INGEST LOCAL DOCUMENT'}
                {uploadStatus === 'INGESTING' && '⚙️ COMPILING VECTORS...'}
                {uploadStatus === 'SUCCESS' && '✅ INGESTION COMPLETED'}
                {uploadStatus === 'ERROR' && '❌ INGESTION COLLAPSE'}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                {uploadMessage || 'Accepts target structures: PDF, TXT, MD'}
              </span>
              <input 
                type="file" 
                accept=".txt,.md,.pdf" 
                onChange={handleFileUpload} 
                disabled={uploadStatus === 'INGESTING'} 
                style={{ display: 'none' }} 
              />
            </label>
          </div>

          {/* PURGE CONTROLS */}
          <button 
            onClick={handleWipeConsole}
            style={{ width: '100%', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.5px', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          >
            WIPE CONSOLE THREAD
          </button>
        </div>

        {/* ACTIVE HARDWARE MONITOR DISPLAY */}
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
        <header style={{ height: '60px', borderBottom: '1px solid var(--border-glow)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', padding: '0 30px', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Operational Node: <span style={{ color: 'var(--neon-cyan)' }}>127.0.0.1:8000</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-darker)', padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--border-glow)' }}>
            Status: <span style={{ color: '#10b981' }}>ONLINE</span>
          </div>
        </header>

        {/* STREAM CHAT CONSOLE AREA */}
        <section style={{ flex: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {chatHistory.length === 0 && !streamData && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '400px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                H.I.V.E. Core Operational Console Interface initialized. Enter a localized transmission token request below to execute isolated model inference.
              </p>
            </div>
          )}

          {chatHistory.map((msg, idx) => (
            <div key={idx} style={{ padding: '15px 20px', borderRadius: '8px', maxWidth: '85%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', background: msg.role === 'user' ? 'var(--maroon-primary)' : 'var(--bg-surface)', border: msg.role === 'user' ? 'none' : '1px solid var(--border-glow)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {msg.role === 'user' ? 'TRANSMISSION' : 'H.I.V.E CORE RESPONSE'}
              </div>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          ))}

          {streamData && (
            <div style={{ padding: '15px 20px', borderRadius: '8px', maxWidth: '85%', alignSelf: 'flex-start', background: 'var(--bg-surface)', border: '1px solid var(--neon-cyan)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--neon-cyan)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                STREAMING LIVE CHUNKS...
              </div>
              <div>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamData}</ReactMarkdown>
                <span style={{ color: 'var(--neon-cyan)', fontWeight: 'bold' }}>_</span>
              </div>
            </div>
          )}

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
              style={{ flex: 1, background: 'var(--bg-darker)', border: '1px solid var(--border-glow)', borderRadius: '6px', padding: '12px 18px', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none' }}
            />
            <button
              type="submit"
              disabled={isStreaming || !userInput.trim()}
              style={{ background: isStreaming || !userInput.trim() ? '#1e293b' : 'linear-gradient(135deg, var(--maroon-primary), var(--maroon-glow))', color: isStreaming || !userInput.trim() ? 'var(--text-muted)' : 'var(--text-main)', border: 'none', padding: '0 25px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', cursor: isStreaming || !userInput.trim() ? 'not-allowed' : 'pointer', letterSpacing: '1px' }}
            >
              {isStreaming ? 'STREAMING' : 'TRANSMIT'}
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}