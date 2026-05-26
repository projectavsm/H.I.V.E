import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-bash';

import { useOllamaStream } from './hooks/useOllamaStream';
import type { Message, Citation } from './hooks/useOllamaStream';

export default function App() {
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 1024);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      const mobileView = window.innerWidth < 1024;
      setIsMobile(mobileView);
      if (!mobileView) setMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { 
    streamData, 
    isStreaming, 
    streamError, 
    telemetryData, 
    statusUpdate, 
    executeStream, 
    clearStream 
  } = useOllamaStream();
  
  const [userInput, setUserInput] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<string>('READY');
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [vaultFiles, setVaultFiles] = useState<string[]>([]);
  const [ragMode, setRagMode] = useState<'global' | 'strict' | 'off'>('global');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [incomingCitations, setIncomingCitations] = useState<Citation[]>([]);

  const [chatHistory, setChatHistory] = useState<Message[]>(() => {
    const cachedMemory = localStorage.getItem('HIVE_SESSION_THREAD');
    return cachedMemory ? JSON.parse(cachedMemory) : [];
  });
  
  useEffect(() => {
    localStorage.setItem('HIVE_SESSION_THREAD', JSON.stringify(chatHistory));
    Prism.highlightAll();
  }, [chatHistory, streamData]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/vault/files')
      .then(res => res.json())
      .then(data => { if (data.files) setVaultFiles(data.files); })
      .catch(err => console.error("Vault error:", err));
  }, [uploadStatus]);

  const SYSTEM_PROMPT = "You are H.I.V.E., a hardened local AI orchestration assistant.";

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isStreaming) return;

    const newUserMessage: Message = { role: 'user', content: userInput };
    const updatedHistory = [...chatHistory, newUserMessage];
    setChatHistory(updatedHistory);
    setUserInput('');
    clearStream();
    setIncomingCitations([]);

    const finalAssistantResponse = await executeStream(
      updatedHistory, 
      { systemPrompt: SYSTEM_PROMPT, rag_mode: ragMode, target_file: ragMode === 'strict' ? selectedFile : null, temperature: 0.4, model: 'llama3.1' },
      (citations) => { setIncomingCitations(citations); }
    );
    
    if (finalAssistantResponse) {
      setChatHistory((prev) => [...prev, { role: 'assistant', content: finalAssistantResponse, citations: incomingCitations }]);
      clearStream();
    }
  };

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
        setTimeout(() => { setUploadStatus('READY'); setUploadMessage(''); }, 4000);
      } else {
        setUploadStatus('ERROR');
        setUploadMessage(`Error: ${data.detail || 'Upload pipeline failed.'}`);
      }
    } catch (err) {
      console.error('H.I.V.E. UI Ingestion Exception:', err);
      setUploadStatus('ERROR');
      setUploadMessage('Error: Connection to H.I.V.E. gateway dropped.');
    }
  };

  const handleWipeConsole = () => {
    if (window.confirm("Initialize complete conversation thread memory wipe?")) {
      setChatHistory([]);
      localStorage.removeItem('HIVE_SESSION_THREAD');
      clearStream();
      setIncomingCitations([]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100vw', background: 'var(--bg-darker)', color: 'var(--text-main)', overflow: 'hidden' }}>
      
      {/* SIDEBAR PANEL */}
      <aside style={{ 
        width: '320px', minWidth: '320px', height: '100%', background: 'var(--bg-surface)', borderRight: '1px solid var(--border-glow)', padding: '20px', 
        display: isMobile && !menuOpen ? 'none' : 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', overflowY: 'auto',
        position: isMobile ? 'fixed' : 'relative', left: 0, top: 0, zIndex: 100, boxShadow: isMobile ? '5px 0 25px rgba(0,0,0,0.5)' : 'none'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isMobile && (
            <button type="button" onClick={() => setMenuOpen(false)} style={{ background: 'transparent', border: '1px solid var(--border-glow)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', alignSelf: 'flex-end' }}>
              ✕ CLOSE MATRIX
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: isStreaming ? 'var(--neon-cyan)' : 'var(--maroon-glow)' }}></div>
            <h1 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '2px', fontWeight: 800 }}>H.I.V.E.</h1>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '10px' }}>System Profile</div>
            <div style={{ background: 'var(--bg-darker)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--maroon-primary)', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Engine:</span> <strong style={{ color: 'var(--neon-purple)' }}>llama3.1 (8B)</strong>
            </div>
          </div>

          {/* KNOWLEDGE INGESTION PANEL */}
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '10px' }}>Knowledge Ingestion</div>
            <label style={{ 
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
              padding: '15px 10px', background: 'var(--bg-darker)', border: '1px dashed var(--border-glow)', 
              borderRadius: '6px', cursor: uploadStatus === 'INGESTING' ? 'not-allowed' : 'pointer', textAlign: 'center', transition: 'border-color 0.2s', marginBottom: '10px'
            }}>
              <span style={{ fontSize: '0.8rem', color: uploadStatus === 'ERROR' ? '#fca5a5' : uploadStatus === 'SUCCESS' ? '#10b981' : 'var(--text-main)', fontWeight: 'bold' }}>
                {uploadStatus === 'READY' && '📁 INGEST LOCAL DOCUMENT'}
                {uploadStatus === 'INGESTING' && '⚙️ COMPILING VECTORS...'}
                {uploadStatus === 'SUCCESS' && '✅ INGESTION COMPLETED'}
                {uploadStatus === 'ERROR' && '❌ INGESTION COLLAPSE'}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                {uploadMessage || 'Accepts target structures: PDF, TXT, MD, DOCX'}
              </span>
              <input type="file" accept=".txt,.md,.pdf,.docx" onChange={handleFileUpload} disabled={uploadStatus === 'INGESTING'} style={{ display: 'none' }} />
            </label>

            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '6px', marginTop: '14px' }}>Vectorized Vault Manifest</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '120px', overflowY: 'auto', background: 'var(--bg-darker)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-glow)' }}>
              {vaultFiles.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>No localized matrices indexed.</div>
              ) : (
                vaultFiles.map(file => (
                  <div 
                    key={file}
                    onClick={() => { setSelectedFile(file); setRagMode('strict'); if (isMobile) setMenuOpen(false); }}
                    style={{
                      padding: '6px 8px', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
                      background: selectedFile === file && ragMode === 'strict' ? 'rgba(0, 242, 254, 0.1)' : 'transparent',
                      border: selectedFile === file && ragMode === 'strict' ? '1px solid var(--neon-cyan)' : '1px solid transparent',
                      color: selectedFile === file && ragMode === 'strict' ? 'var(--neon-cyan)' : 'var(--text-main)'
                    }}
                  >
                    📄 {file.length > 28 ? `${file.substring(0, 25)}...` : file}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RAG SEARCH STRATEGIES */}
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '10px' }}>RAG Search Strategy</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
              <button type="button" onClick={() => { setRagMode('global'); if(isMobile) setMenuOpen(false); }} style={{ width: '100%', padding: '8px 12px', textAlign: 'left', borderRadius: '50px', cursor: 'pointer', border: '1px solid var(--border-glow)', background: ragMode === 'global' ? 'var(--maroon-primary)' : 'var(--bg-darker)', color: 'var(--text-main)', fontWeight: ragMode === 'global' ? 'bold' : 'normal' }}>
                🌐 Global Matrix (All Files)
              </button>
              <button type="button" onClick={() => { if(selectedFile) { setRagMode('strict'); if(isMobile) setMenuOpen(false); } }} disabled={!selectedFile} style={{ width: '100%', padding: '8px 12px', textAlign: 'left', borderRadius: '50px', border: '1px solid var(--border-glow)', background: ragMode === 'strict' ? 'var(--neon-cyan)' : 'var(--bg-darker)', color: ragMode === 'strict' ? 'var(--bg-darker)' : 'var(--text-main)', fontWeight: ragMode === 'strict' ? 'bold' : 'normal', opacity: !selectedFile ? 0.3 : 1, cursor: !selectedFile ? 'not-allowed' : 'pointer' }}>
                🎯 Strict Isolated Target Mode
              </button>
              <button type="button" onClick={() => { setRagMode('off'); if(isMobile) setMenuOpen(false); }} style={{ width: '100%', padding: '8px 12px', textAlign: 'left', borderRadius: '50px', cursor: 'pointer', border: '1px solid var(--border-glow)', background: ragMode === 'off' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-darker)', color: ragMode === 'off' ? '#fca5a5' : 'var(--text-main)', fontWeight: ragMode === 'off' ? 'bold' : 'normal' }}>
                ❌ Bypass Injected Context Stores
              </button>
            </div>
          </div>

          <button type="button" onClick={handleWipeConsole} style={{ width: '100%', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
            WIPE CONSOLE THREAD
          </button>

          {/* TELEMETRY */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '10px' }}>Live Telemetry</div>
            <div style={{ background: 'var(--bg-darker)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-glow)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '100px', justifyContent: 'center' }}>
              {!telemetryData ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic', fontSize: '0.75rem' }}>
                  {isStreaming ? 'Intercepting logs...' : 'Awaiting dispatch...'}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Semantic RAG:</span>
                    <span style={{ color: telemetryData.rag_matched ? '#10b981' : 'var(--text-muted)', fontWeight: 'bold' }}>{telemetryData.rag_matched ? `🟢 HIT (${telemetryData.rag_blocks_found} Blk)` : '⚪ BYPASS'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Web Scraper:</span>
                    <span style={{ color: telemetryData.web_triggered ? 'var(--neon-cyan)' : 'var(--text-muted)', fontWeight: 'bold' }}>{telemetryData.web_triggered ? `🌐 ACTIVE (${telemetryData.web_fragments_ingested} Frag)` : '⚪ IDLE'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>FIFO Pruning:</span>
                    <span style={{ color: telemetryData.history_pruned ? '#ef4444' : 'var(--text-muted)', fontWeight: 'bold' }}>{telemetryData.history_pruned ? `⚠️ CLIPPED (-${telemetryData.pruned_count})` : '🟢 STABLE'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ACTIVE HARDWARE MONITOR */}
        <div style={{ background: 'var(--bg-darker)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-glow)', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '5px' }}>
            <span style={{ color: 'var(--text-muted)' }}>GPU VRAM allocation</span>
            <span style={{ color: 'var(--maroon-glow)' }}>~6.5GB Cap</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: '72%', height: '100%', background: 'linear-gradient(90deg, var(--maroon-primary), var(--maroon-glow))' }}></div>
          </div>
        </div>
      </aside>

      {/* MOBILE OVERLAY */}
      {isMobile && menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0, 0, 0, 0.6)', zIndex: 90 }} />}

      {/* CORE CHAT WINDOW CONSOLE */}
      <main style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <header style={{ height: '60px', borderBottom: '1px solid var(--border-glow)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isMobile && <button type="button" onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-glow)', color: 'var(--text-main)', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>☰ MATRIX</button>}
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Node: <span style={{ color: 'var(--neon-cyan)' }}>127.0.0.1:8000</span></div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-darker)', padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--border-glow)' }}>Status: <span style={{ color: '#10b981' }}>ONLINE</span></div>
        </header>

        {/* UNIFIED CHAT CONTAINER SCROLLER */}
        <section style={{ 
          flex: 1, 
          padding: isMobile ? '15px' : '30px', 
          overflowY: 'auto',        // This remains the only vertical scroller across the interface
          display: 'flex', 
          flexDirection: 'column', 
          gap: '24px' 
        }}>
          {chatHistory.length === 0 && !streamData && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '400px', color: 'var(--text-muted)' }}>
              H.I.V.E. Core Operational Console Interface initialized. Enter a localized transmission token request below.
            </div>
          )}

          {chatHistory.map((msg, idx) => (
            <div 
              key={idx} 
              style={{ 
                padding: '18px 22px', 
                borderRadius: '8px', 
                width: '100%',
                maxWidth: msg.role === 'user' ? (isMobile ? '90%' : '75%') : '100%', 
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', 
                background: msg.role === 'user' ? 'var(--maroon-primary)' : 'var(--bg-surface)', 
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-glow)', 
                fontSize: '0.95rem', 
                lineHeight: '1.6',
                wordBreak: 'break-word',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {msg.role === 'user' ? '📡 TRANSMISSION' : '🤖 H.I.V.E CORE RESPONSE'}
              </div>
              
              {/* Markdown contents container allows blocks to grow naturally without inner scrolling boxes */}
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>

              {msg.citations && msg.citations.length > 0 && (
                <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed var(--border-glow)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {msg.citations.map((cite, cIdx) => (
                    <span key={cIdx} style={{ fontSize: '0.65rem', background: 'var(--bg-darker)', border: '1px solid var(--border-glow)', color: 'var(--neon-cyan)', padding: '2px 8px', borderRadius: '4px' }}>
                      📌 {cite.source} ({Math.round(cite.score * 100)}%)
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* STREAMING RESPONSE BLOCK */}
          {isStreaming && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignSelf: 'flex-start', width: '100%' }}>
              {incomingCitations.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {incomingCitations.map((cite, cIdx) => (
                    <div key={cIdx} style={{ fontSize: '0.65rem', background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.4)', color: 'var(--neon-cyan)', padding: '3px 8px', borderRadius: '4px' }}>
                      📌 Linked Source: {cite.source}
                    </div>
                  ))}
                </div>
              )}

              {statusUpdate && (
                <div style={{ padding: '8px 14px', background: 'var(--bg-darker)', border: '1px solid rgba(217, 119, 6, 0.5)', color: '#d97706', borderRadius: '6px', fontSize: '0.75rem' }}>
                  <strong>// Operation:</strong> {statusUpdate}
                </div>
              )}

              {streamData && (
                <div style={{ padding: '18px 22px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--neon-cyan)', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--neon-cyan)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>STREAMING LIVE CHUNKS...</div>
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamData}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {streamError && (
            <div style={{ padding: '15px 20px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '0.9rem' }}>
              <strong>System Halt Exception:</strong> {streamError}
            </div>
          )}
        </section>

        {/* INPUT TRANSMISSION FOOTE BLOCK */}
        <footer style={{ padding: isMobile ? '15px' : '20px 30px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-glow)' }}>
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: '15px' }}>
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={isStreaming ? "Awaiting engine loop..." : "Transmit prompt payload..."}
              disabled={isStreaming}
              style={{ flex: 1, background: 'var(--bg-darker)', border: '1px solid var(--border-glow)', borderRadius: '6px', padding: '14px 18px', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none' }}
            />
            <button type="submit" disabled={isStreaming || !userInput.trim()} style={{ background: isStreaming || !userInput.trim() ? '#1e293b' : 'linear-gradient(135deg, var(--maroon-primary), var(--maroon-glow))', color: 'var(--text-main)', border: 'none', padding: '0 25px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              TRANSMIT
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}