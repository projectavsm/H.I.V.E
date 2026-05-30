// C:\Users\LIYANA\Desktop\H.I.V.E\frontend\src\HiveControlDashboard.tsx
import { useState, useEffect, useCallback } from 'react'; 
import { Trash2, Shield, Zap, Database, Clock, RefreshCw, AlertTriangle } from 'lucide-react';

interface Analytics {
  cache_hits: number;
  cache_misses: number;
  vram_seconds_saved: number;
  active_documents: number;
  total_vector_fragments: number;
}

interface HiveControlDashboardProps {
  onClose: () => void;
}

// Global style definition for the full Cyberpunk dashboard wrapper
const dashboardWrapperStyle: React.CSSProperties = {
  padding: '16px', // Standard system contract conversion
  background: '#04070a', // Pure deep space matrix background
  color: 'var(--text-main)',
  minHeight: '100vh',
  width: '100%',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'var(--font-primary)', // Standard geometric typography contract
  textShadow: '0 0 5px rgba(0, 242, 254, 0.4)' // Global neon glow matrix
};

// Global definition of analytics ticker grid structure (now a horizontal flex-array)
const analyticsTickerFlexStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px', // Original margin contract mapping 'gap-3' conversion
  marginBottom: '24px' // Original margin mapping 'mb-6' conversion
};

const filePurgeListStyle: React.CSSProperties = {
  background: '#090d14', // Slightly lighter surface surface mapping 'bg-surface' contract
  border: '1px solid var(--maroon-glow)', // Deep red border constraint contract mapping 'rounded-lg' original
  borderRadius: '4px', // System geometric rounding contract 'rounded-lg' mapping
  padding: '16px', // Standard internal padding contract 'p-5' mapping
  maxHeight: '400px', // Original height restriction matrix
  overflowY: 'auto',
  flex: 1,
  boxShadow: 'inset 0 0 10px rgba(138, 28, 49, 0.2)' // Internal deep red glow matrix
};

const segmentedButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-glow)',
  color: 'var(--text-muted)',
  borderRadius: '2px', // geometric constraint
  cursor: 'pointer',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  transition: 'all 0.1s'
};

export default function HiveControlDashboard({ onClose }: HiveControlDashboardProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({
    cache_hits: 0,
    cache_misses: 0,
    vram_seconds_saved: 0.0,
    active_documents: 0,
    total_vector_fragments: 0
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const syncDashboardData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const filesResponse = await fetch('http://127.0.0.1:8000/api/vault/files');
      const filesData = await filesResponse.json();
      setFiles(filesData.files || []);

      const analyticsResponse = await fetch('http://127.0.0.1:8000/api/vault/analytics');
      const analyticsData = await analyticsResponse.json();
      setAnalytics(analyticsData);
    } catch (error) {
      console.error("❌ Failed to sync dashboard telemetry assets:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const runInitPass = async () => { if (isMounted) { await syncDashboardData(); } };
    runInitPass();
    const interval = setInterval(() => { if (isMounted) { syncDashboardData(); } }, 5000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [syncDashboardData]);

  const handlePurgeDocument = async (filename: string) => {
    if (!confirm(`Are you sure you want to completely drop and un-index ${filename}?`)) return;
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/vault/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      const result = await response.json();
      if (response.ok) { alert(result.detail || "Document successfully evicted."); syncDashboardData(); } 
      else { alert(`Error executing purge cycle: ${result.detail}`); }
    } catch (error) { alert(`API Connection collapse during execution sequence: ${error}`); }
  };

  return (
    <div style={dashboardWrapperStyle}>
      
      {/* ==========================================
          HEADER LAYER & LIVE ANALYTICS TICKER
         ========================================== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px dashed var(--border-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Shield className="animate-pulse" style={{ width: '32px', height: '32px', color: 'var(--maroon-primary)' }} />
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '3px', textTransform: 'uppercase', fontStyle: 'italic', textShadow: '2px 2px #51101d, -2px -2px #00f2fe' }}>
            H.I.V.E. Analytics & Vault Control
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={syncDashboardData} 
            disabled={isRefreshing}
            style={{ ...segmentedButtonStyle, border: 'none', background: 'transparent' }}
          >
            <RefreshCw className={isRefreshing ? 'animate-spin' : ''} style={{ width: '16px', height: '16px', color: isRefreshing ? 'var(--neon-cyan)' : 'var(--text-muted)' }} />
          </button>
          <button 
            onClick={onClose}
            style={segmentedButtonStyle}
            className="hover:border-maroon-glow hover:text-white"
          >
            ✕ CLOSE_CONSOLE
          </button>
        </div>
      </div>

      {/* HARDENED PERFORMANCE TICKER FLEX-ROW */}
      <div style={analyticsTickerFlexStyle}>
        {[
          { icon: Zap, label: "Semantic Cache Hits", value: `${analytics.cache_hits} hits`, color: "var(--neon-cyan)" },
          { icon: Clock, label: "VRAM Latency Saved", value: `${analytics.vram_seconds_saved}s`, color: "var(--maroon-glow)" }, 
          { icon: Database, label: "Active Documents", value: analytics.active_documents, color: "var(--neon-purple)" },
          { icon: Database, label: "Vector Matrix Fragments", value: `${analytics.total_vector_fragments} nodes`, color: "#f59e0b" } 
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 230px', background: 'var(--bg-surface)', border: '1px solid var(--border-glow)', padding: '12px', borderRadius: '4px', borderLeft: `3px solid ${item.color}`, boxShadow: `0 0 10px ${item.color}33` }}>
              <div style={{ padding: '8px', background: 'var(--bg-darker)', color: item.color, borderRadius: '4px' }}>
                <Icon style={{ width: '22px', height: '22px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '2px', fontWeight: 'bold' }}>{item.label}</p>
                <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: item.color, textShadow: `0 0 5px ${item.color}aa` }}>{item.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ==========================================
          SIDEBAR FILE VAULT LIST & PURGE MANAGEMENT
         ========================================== */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', minHeight: '400px' }}>
        <div style={filePurgeListStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-glow)' }}>
            <h2 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '2px', fontWeight: 'bold' }}>
              Knowledge Vault Index
            </h2>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-darker)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {files.length} Files
            </span>
          </div>

          {files.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--maroon-glow)', textAlign: 'center', padding: '32px 0', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle className="animate-pulse" style={{width: '24px', height: '24px'}}/>
              <span>No vectorized matrix structures indexed. Vector stores are empty.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {files.map((filename) => (
                <div 
                  key={filename} 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-darker)', border: '1px solid var(--border-glow)', borderRadius: '4px', transition: 'all 0.1s' }}
                  className="hover:border-maroon-primary hover:background-var(--bg-surface)"
                >
                  <div style={{ minWidth: 0, paddingRight: '12px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textShadow: '0 0 5px rgba(0, 242, 254, 0.2)' }}>
                      {filename}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      Scope: chroma_db.hive_knowledge_base
                    </span>
                  </div>
                  <button
                    onClick={() => handlePurgeDocument(filename)}
                    title={`Evict ${filename} from database`}
                    style={{ padding: '8px', background: 'transparent', border: '1px solid transparent', color: 'var(--maroon-primary)', cursor: 'pointer', borderRadius: '4px', opacity: 0.7, transition: 'all 0.1s' }}
                    className="hover:background-rgba(239, 68, 68, 0.1) hover:opacity-100 hover:text-maroon-glow"
                  >
                    <Trash2 style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Placeholder workspace block (now glitched geometric structure) */}
        <div style={{ flex: '2 1 0%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(9, 13, 20, 0.4)', border: '1px dashed var(--border-glow)', borderRadius: '4px', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--neon-purple)' }}>
            <Zap style={{width: '24px', height: '24px', color: 'var(--neon-purple)'}}/>
            <span style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}>Core Telemetry Matrix Status</span>
          </div>
          <p style={{ margin: 0, lineHeight: '1.5' }}>
            System Core Online. Vector Caching Loop is currently running on Node: <span style={{ color: 'var(--neon-cyan)' }}>127.0.0.1:8000</span>.<br/> 
            ChromaDB Cosine Similarity thresholds are set to <span style={{ color: 'var(--text-accent)' }}>0.92</span>.<br/> 
            Awaiting prompt pipeline dispatch turn query to evaluate strategy.
          </p>
        </div>
      </div>

    </div>
  );
}