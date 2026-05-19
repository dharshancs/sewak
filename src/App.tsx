import { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Terminal } from 'lucide-react';
import { InferencePlayground } from './components/InferencePlayground';
import { DiffView } from './components/DiffView';

type Tab = 'playground' | 'diff';
const STORAGE_KEY = 'grok_api_key';

export default function App() {
  const [tab, setTab] = useState<Tab>('playground');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { setApiKey(saved); setKeyInput(saved); setKeySaved(true); }
  }, []);

  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    setApiKey(trimmed);
    localStorage.setItem(STORAGE_KEY, trimmed);
    setKeySaved(true);
  };

  const handleClearKey = () => {
    setApiKey(''); setKeyInput(''); setKeySaved(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div style={{ minHeight: '100vh' }} className="grid-bg">
      <nav style={{
        position:'sticky', top:0, zIndex:100,
        background:'rgba(7,7,9,0.92)', backdropFilter:'blur(12px)',
        borderBottom:'1px solid var(--border)',
        padding:'0 32px', display:'flex', alignItems:'center', height:56, gap:32,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginRight:8 }}>
          <Terminal size={16} style={{ color:'var(--accent)' }} />
          <span style={{ fontFamily:'var(--code)', fontSize:13, letterSpacing:'0.08em', color:'var(--text)' }}>
            GROK<span style={{ color:'var(--accent)' }}>_</span>LAB
          </span>
        </div>

        <div style={{ display:'flex' }} role="tablist" aria-label="Main navigation">
          <button className={`tab ${tab==='playground'?'active':''}`} onClick={()=>setTab('playground')}
            role="tab" aria-selected={tab==='playground'} aria-controls="playground-panel">
            Playground
          </button>
          <button className={`tab ${tab==='diff'?'active':''}`} onClick={()=>setTab('diff')}
            role="tab" aria-selected={tab==='diff'} aria-controls="diff-panel">
            Diff View
          </button>
        </div>

        <div style={{ flex:1 }} />

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Key size={13} style={{ color:keySaved?'var(--accent)':'var(--muted)' }} />
          <div style={{ position:'relative' }}>
            <input
              className="grok-input"
              type={showKey?'text':'password'}
              value={keyInput}
              onChange={e=>{ setKeyInput(e.target.value); setKeySaved(false); }}
              placeholder="xai-... API key"
              style={{ width:220, paddingRight:32, fontSize:12 }}
              aria-label="Grok API key"
              onKeyDown={e=>{ if(e.key==='Enter') handleSaveKey(); }}
            />
            <button onClick={()=>setShowKey(s=>!s)} aria-label={showKey?'Hide API key':'Show API key'}
              style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:0, display:'flex' }}>
              {showKey?<EyeOff size={12}/>:<Eye size={12}/>}
            </button>
          </div>
          {!keySaved ? (
            <button className="btn btn-primary" onClick={handleSaveKey} style={{ padding:'7px 14px', fontSize:12 }} aria-label="Save API key">Save</button>
          ) : (
            <button className="btn" onClick={handleClearKey} style={{ padding:'7px 14px', fontSize:12, color:'var(--accent)', borderColor:'var(--accent)' }} aria-label="Clear API key">✓ Saved</button>
          )}
        </div>
      </nav>

      <div style={{ background:'linear-gradient(180deg,rgba(79,255,176,0.04) 0%,transparent 100%)', borderBottom:'1px solid var(--border)', padding:'36px 32px 28px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ marginBottom:6 }}>
            <span className="chip">Developer Portal</span>{' '}
            <span className="chip" style={{ borderColor:'var(--accent)', color:'var(--accent)' }}>Beta</span>
          </div>
          <h1 style={{ fontFamily:'var(--display)', fontSize:'clamp(24px,4vw,40px)', fontWeight:800, margin:'12px 0 8px', letterSpacing:'-0.02em', lineHeight:1.1 }}>
            On-Device Inference<br/>
            <span style={{ color:'var(--accent)' }}>Testing Platform</span>
          </h1>
          <p style={{ color:'var(--muted2)', fontSize:13, margin:0, maxWidth:500 }}>
            Stream model outputs in real-time, inspect token-level diffs between model versions,
            and monitor performance metrics live.
          </p>
        </div>
      </div>

      <main style={{ padding:'32px 32px 64px', maxWidth:1300, margin:'0 auto' }}>
        {!apiKey && (
          <div style={{ background:'rgba(255,159,69,0.08)', border:'1px solid rgba(255,159,69,0.3)', borderRadius:3, padding:'12px 16px', marginBottom:24, fontSize:12, color:'var(--warn)', display:'flex', alignItems:'center', gap:8 }} role="alert">
            <Key size={13}/>
            Enter your <strong>xAI Grok API key</strong> in the top-right to use the playground. Get one at{' '}
            <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer" style={{ color:'var(--warn)', textDecoration:'underline' }}>console.x.ai</a>
          </div>
        )}

        <div id="playground-panel" role="tabpanel" aria-label="Playground panel" style={{ display: tab==='playground'?'block':'none' }}>
          <InferencePlayground apiKey={apiKey}/>
        </div>
        <div id="diff-panel" role="tabpanel" aria-label="Diff view panel" style={{ display: tab==='diff'?'block':'none' }}>
          <DiffView apiKey={apiKey}/>
        </div>
      </main>

      <footer style={{ borderTop:'1px solid var(--border)', padding:'16px 32px', display:'flex', alignItems:'center', justifyContent:'space-between', color:'var(--muted)', fontSize:11, letterSpacing:'0.06em' }}>
        <span>GROK_LAB — Frontend Intern Assignment</span>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          ⬡<span>Deploy to Vercel for submission</span>
        </div>
      </footer>
    </div>
  );
}
