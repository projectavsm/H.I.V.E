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
  // NEW: Extracted statusUpdate, telemetryData safely from our modernized custom stream hook
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
  
  // UI Ingestion Status States
  const [uploadStatus, setUploadStatus] = useState<string>('READY');
  const [uploadMessage, setUploadMessage] = useState<string>('');

  // NEW: RAG Ingestion & Document Target States
  const [vaultFiles, setVaultFiles] = useState<string[]>([]);
  const [ragMode, setRagMode] = useState<'global' | 'strict' | 'off'>('global');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [incomingCitations, setIncomingCitations] = useState<Citation[]>([]);

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

  // NEW: Fetch verified filenames in collection on mount
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/vault/files')
      .then(res => res.json())
      .then(data => { if (data.files) setVaultFiles(data.files); })
      .catch(err => console.error("Vault fetching drop exception code stack:", err));
  }, [uploadStatus]);

  const SYSTEM_PROMPT = "You are H.I.V.E., a hardened local AI orchestration assistant. Provide precise, professional, and accurate technical solutions.";

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isStreaming) return;

    const newUserMessage: Message = { role: 'user', content: userInput };
    const updatedHistory = [...chatHistory, newUserMessage];
    setChatHistory(updatedHistory);
    setUserInput('');
    clearStream();
    setIncomingCitations([]);

    // Execute stream passing along strategy options constraints matching schemas
    const finalAssistantResponse = await executeStream(
      updatedHistory, 
      { 
        systemPrompt: SYSTEM_PROMPT,
        rag_mode: ragMode,
        target_file: ragMode === 'strict' ? selectedFile : null,
        temperature: 0.4,
        model: 'llama3.1'
      },
      (citations) => {
        setIncomingCitations(citations);
      }
    );
    
    if (finalAssistantResponse) {
      setChatHistory((prev) => [...prev, { 
        role: 'assistant', 
        content: finalAssistantResponse,
        citations: incomingCitations 
      }]);
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
        setTimeout(() => { setUploadStatus('READY'); setUploadMessage(''); }, 4000);
      } else {
        setUploadStatus('ERROR');
        setUploadMessage(`Error: ${data.detail || 'Upload pipeline failed.'}`);
      }
    } catch (err) {
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
      setIncomingCitations([]);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-darker)', fontFamily: 'sans-serif', color: 'var(--text-main)', overflow: 'hidden' }}>
      
      {/* SIDEBAR CONTAINER PANEL */}
      <aside style={{ width: '320px', background: 'var(--bg-surface)', borderRight: '1px solid var(--border-glow)', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', overflowY: 'auto' }}>
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
              <input 
                type="file" 
                accept=".txt,.md,.pdf,.docx" 
                onChange={handleFileUpload} 
                disabled={uploadStatus === 'INGESTING'} 
                style={{ display: 'none' }} 
              />
            </label>

            {/* NEW: REFACTOR MATRIX - ACTIVE VAULT FILE TRACKER DISPLAY CARD */}
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '6px', marginTop: '14px' }}>Vectorized Vault Manifest</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '120px', overflowY: 'auto', background: 'var(--bg-darker)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-glow)' }}>
              {vaultFiles.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>No localized matrices indexed.</div>
              ) : (
                vaultFiles.map(file => (
                  <div 
                    key={file}
                    onClick={() => {
                      setSelectedFile(file);
                      setRagMode('strict');
                    }}
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

          {/* NEW: RAG STRATEGY ROUTING SWITCHERS */}
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '10px' }}>RAG Search Strategy</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
              <button 
                onClick={() => setRagMode('global')}
                style={{ width: '100%', padding: '8px 12px', textAlign: 'left', borderRadius: '50px', cursor: 'pointer', border: '1px solid var(--border-glow)', background: ragMode === 'global' ? 'var(--maroon-primary)' : 'var(--bg-darker)', color: 'var(--text-main)', fontWeight: ragMode === 'global' ? 'bold' : 'normal' }}
              >
                🌐 Global Knowledge Matrix (All Files)
              </button>
              <button 
                onClick={() => { if(selectedFile) setRagMode('strict'); }}
                disabled={!selectedFile}
                style={{ width: '100%', padding: '8px 12px', textAlign: 'left', borderRadius: '50px', border: '1px solid var(--border-glow)', background: ragMode === 'strict' ? 'var(--neon-cyan)' : 'var(--bg-darker)', color: ragMode === 'strict' ? 'var(--bg-darker)' : 'var(--text-main)', fontWeight: ragMode === 'strict' ? 'bold' : 'normal', opacity: !selectedFile ? 0.3 : 1, cursor: !selectedFile ? 'not-allowed' : 'pointer' }}
              >
                🎯 Strict Isolated Target Mode
              </button>
              <button 
                onClick={() => setRagMode('off')}
                style={{ width: '100%', padding: '8px 12px', textAlign: 'left', borderRadius: '50px', cursor: 'pointer', border: '1px solid var(--border-glow)', background: ragMode === 'off' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-darker)', color: ragMode === 'off' ? '#fca5a5' : 'var(--text-main)', fontWeight: ragMode === 'off' ? 'bold' : 'normal' }}
              >
                ❌ Bypass Injected Context Stores
              </button>
            </div>
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

          {/* LIVE MIDDLEWARE INSTRUMENTATION TELEMETRY WINDOW */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '10px' }}>Live Telemetry</div>
            <div style={{ background: 'var(--bg-darker)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-glow)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '100px', justifyContent: 'center' }}>
              {!telemetryData ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic', fontSize: '0.75rem' }}>
                  {isStreaming ? 'Intercepting transaction logs...' : 'Awaiting prompt pipeline dispatch...'}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Semantic RAG:</span>
                    <span style={{ color: telemetryData.rag_matched ? '#10b981' : 'var(--text-muted)', fontWeight: 'bold' }}>
                      {telemetryData.rag_matched ? `🟢 HIT (${telemetryData.rag_blocks_found} Blk)` : '⚪ BYPASS'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Web Scraper:</span>
                    <span style={{ color: telemetryData.web_triggered ? 'var(--neon-cyan)' : 'var(--text-muted)', fontWeight: 'bold' }}>
                      {telemetryData.web_triggered ? `🌐 ACTIVE (${telemetryData.web_fragments_ingested} Frag)` : '⚪ IDLE'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>FIFO Pruning:</span>
                    <span style={{ color: telemetryData.history_pruned ? '#ef4444' : 'var(--text-muted)', fontWeight: 'bold' }}>
                      {telemetryData.history_pruned ? `⚠️ CLIPPED (-${telemetryData.pruned_count})` : '🟢 STABLE'}
                    </span>
                  </div>
                  <div style={{ borderTop: '1px dashed #334155', marginTop: '4px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Injected Payload:</span>
                    <span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{telemetryData.total_payload_chars.toLocaleString()} Chars</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ACTIVE HARDWARE MONITOR DISPLAY */}
        <div style={{ background: 'var(--bg-darker)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-glow)', marginTop: '20px' }}>
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

              {/* NEW: HISTORIC DATA DYNAMIC SOURCE CITATION CHIPS */}
              {msg.citations && msg.citations.length > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed var(--border-glow)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {msg.citations.map((cite, cIdx) => (
                    <span key={cIdx} style={{ fontSize: '0.65rem', background: 'var(--bg-darker)', border: '1px solid var(--border-glow)', color: 'var(--neon-cyan)', padding: '2px 8px', borderRadius: '4px' }}>
                      📌 {cite.source} (Match: {Math.round(cite.score * 100)}%)
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* STREAMING CHUNK METADATA WITH AGENT UPDATE GRAPH BAR */}
          {isStreaming && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignSelf: 'flex-start', maxWidth: '85%' }}>
              
              {/* NEW: DYNAMIC LIVE CITATION CARD PREVIEWS */}
              {incomingCitations.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {incomingCitations.map((cite, cIdx) => (
                    <div key={cIdx} style={{ fontSize: '0.65rem', background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.4)', color: 'var(--neon-cyan)', padding: '3px 8px', borderRadius: '4px', animation: 'pulse 2s infinite' }}>
                      📌 Linked Matrix Source: {cite.source}
                    </div>
                  ))}
                </div>
              )}

              {/* NEW: ANIMATED AGENT TELEMETRY RUNTIME BANNER */}
              {statusUpdate && (
                <div style={{ padding: '8px 14px', background: 'var(--bg-darker)', border: '1px solid rgba(217, 119, 6, 0.5)', color: '#d97706', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#d97706', animation: 'ping 1.5s infinite' }}></span>
                  <div>
                    <span style={{ fontWeight: 'bold', display: 'block', fontSize: '0.6rem', textTransform: 'uppercase', opacity: 0.8 }}>// Agent Operation Step:</span>
                    {statusUpdate}
                  </div>
                </div>
              )}

              {streamData && (
                <div style={{ padding: '15px 20px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--neon-cyan)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                  <div style={{ fontSize: '0.7', color: 'var(--neon-cyan)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    STREAMING LIVE CHUNKS...
                  </div>
                  <div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamData}</ReactMarkdown>
                    <span style={{ color: 'var(--neon-cyan)', fontWeight: 'bold' }}>_</span>
                  </div>
                </div>
              )}
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