import { useState, useCallback } from 'react';
import { RotateCcw, GitCompare, Info } from 'lucide-react';
import { computeDiff, getDiffStats } from '../utils/tokenDiff';
import type { DiffToken } from '../utils/tokenDiff';

interface Props { apiKey: string; }

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

async function fetchGrokCompletion(
  prompt: string, apiKey: string, model: string,
  systemPrompt: string, temperature: number,
): Promise<string> {
  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, messages: [{ role:'system', content:systemPrompt }, { role:'user', content:prompt }],
      stream: false, max_tokens: 1024, temperature,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    let msg = `API Error ${response.status}`;
    try { msg = JSON.parse(errText)?.error?.message ?? msg; } catch {}
    throw new Error(msg);
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

function DiffPanel({ tokens, side, label, model, loading, error }: {
  tokens: DiffToken[]; side: 'left'|'right'; label: string;
  model: string; loading: boolean; error: string;
}) {
  const showType = side === 'left'
    ? (t: DiffToken) => t.type === 'equal' || t.type === 'delete'
    : (t: DiffToken) => t.type === 'equal' || t.type === 'insert';

  const getClass = (t: DiffToken) => {
    if (t.type === 'equal') return '';
    if (t.type === 'delete') return 'diff-delete';
    if (t.type === 'insert') return 'diff-insert';
    return '';
  };

  return (
    <div className="panel" style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.1em' }}>{label}</span>
        <span className="chip">{model}</span>
      </div>
      <div role="region" aria-label={`${label} output`}
        style={{ padding:20, minHeight:200, maxHeight:450, overflowY:'auto', fontSize:13, lineHeight:1.9, flex:1 }}>
        {loading && <div style={{ color:'var(--muted)', fontSize:12 }}>Generating...</div>}
        {error && <div style={{ color:'var(--error)', fontSize:12 }}>{error}</div>}
        {!loading && !error && tokens.length === 0 && (
          <div style={{ color:'var(--muted)', fontSize:12 }}>Output will appear here after running</div>
        )}
        {tokens.filter(showType).map((token, i) => (
          <span key={i} className={getClass(token)}>{token.value}</span>
        ))}
      </div>
    </div>
  );
}

export function DiffView({ apiKey }: Props) {
  const [prompt, setPrompt] = useState('');
  const [systemA, setSystemA] = useState('You are a formal assistant. Be concise and professional.');
  const [systemB, setSystemB] = useState('You are a casual assistant. Be friendly and conversational.');
  const [modelA, setModelA] = useState('grok-3-mini');
  const [modelB, setModelB] = useState('grok-3-mini');
  const [tempA, setTempA] = useState(0.3);
  const [tempB, setTempB] = useState(0.9);
  const [outputA, setOutputA] = useState('');
  const [outputB, setOutputB] = useState('');
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState('');
  const [errorB, setErrorB] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [showAlgoInfo, setShowAlgoInfo] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualA, setManualA] = useState('');
  const [manualB, setManualB] = useState('');

  const diff = computeDiff(manualMode ? manualA : outputA, manualMode ? manualB : outputB);
  const stats = getDiffStats(diff);
  const hasDiff = diff.length > 0;
  const MODELS = ['grok-3-mini', 'grok-3', 'grok-2-1212'];
  const isLoading = loadingA || loadingB;

  const handleRun = useCallback(async () => {
    if (!prompt.trim() || !apiKey.trim()) return;
    setOutputA(''); setOutputB(''); setErrorA(''); setErrorB('');
    setLoadingA(true); setLoadingB(true);
    const [resA, resB] = await Promise.allSettled([
      fetchGrokCompletion(prompt, apiKey, modelA, systemA, tempA),
      fetchGrokCompletion(prompt, apiKey, modelB, systemB, tempB),
    ]);
    setLoadingA(false); setLoadingB(false);
    if (resA.status==='fulfilled') setOutputA(resA.value);
    else setErrorA((resA as PromiseRejectedResult).reason?.message ?? 'Error');
    if (resB.status==='fulfilled') setOutputB(resB.value);
    else setErrorB((resB as PromiseRejectedResult).reason?.message ?? 'Error');
  }, [prompt, apiKey, modelA, modelB, systemA, systemB, tempA, tempB]);

  const handleReset = () => { setOutputA(''); setOutputB(''); setErrorA(''); setErrorB(''); setPrompt(''); setManualA(''); setManualB(''); };

  return (
    <div className="slide-up" style={{ maxWidth:1200, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <span style={{ fontFamily:'var(--code)', fontSize:11, color:'var(--muted)', letterSpacing:'0.12em' }}>
          PART B — MODEL OUTPUT DIFF VIEW
        </span>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={()=>setManualMode(m=>!m)}
            style={{ padding:'6px 14px', fontSize:11, color:manualMode?'var(--accent)':undefined }}>
            {manualMode?'Manual Mode ✓':'Manual Mode'}
          </button>
          <button className="btn" onClick={()=>setShowAlgoInfo(s=>!s)} style={{ padding:'6px 14px', fontSize:11 }} aria-label="Algorithm info">
            <Info size={12}/> Algorithm
          </button>
        </div>
      </div>

      {showAlgoInfo && (
        <div className="panel slide-up" style={{ padding:20, marginBottom:20, borderColor:'var(--accent)', background:'rgba(79,255,176,0.03)' }}>
          <div style={{ fontFamily:'var(--display)', fontSize:14, fontWeight:600, color:'var(--accent)', marginBottom:12 }}>
            Diffing Algorithm: Wagner-Fischer LCS
          </div>
          <div style={{ fontSize:12, lineHeight:1.8, color:'var(--muted2)' }}>
            <p style={{ margin:'0 0 10px' }}>
              <strong style={{ color:'var(--text)' }}>Algorithm:</strong> Longest Common Subsequence (LCS) via Wagner-Fischer DP table.
              Text is split into word + whitespace tokens, enabling true word-level diffs — not line-level.
            </p>
            <p style={{ margin:'0 0 10px' }}>
              <strong style={{ color:'var(--text)' }}>Time Complexity:</strong> O(N × M) where N and M are token counts of the two inputs.
              For typical model outputs (~200-500 tokens), resolves in under 2ms.
            </p>
            <p style={{ margin:'0 0 10px' }}>
              <strong style={{ color:'var(--text)' }}>Why not Myers diff?</strong> Myers is optimal for line-level diffs (O((N+M)D)) but needs more complex
              implementation. For dense token-level changes in prose, LCS gives cleaner, more predictable output.
            </p>
            <p style={{ margin:0 }}>
              <strong style={{ color:'var(--text)' }}>Why not Patience diff?</strong> Patience diff excels at matching unique anchors in source code.
              For model-generated prose where tokens repeat frequently, Wagner-Fischer LCS is the cleaner choice.
            </p>
          </div>
        </div>
      )}

      {manualMode ? (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:'0.08em', marginBottom:10 }}>PASTE TWO OUTPUTS TO DIFF THEM</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ fontSize:11, color:'var(--muted2)', marginBottom:6 }}>OUTPUT A</div>
              <textarea className="grok-textarea" rows={8} value={manualA} onChange={e=>setManualA(e.target.value)} placeholder="Paste model A output..." aria-label="Manual output A"/>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--muted2)', marginBottom:6 }}>OUTPUT B</div>
              <textarea className="grok-textarea" rows={8} value={manualB} onChange={e=>setManualB(e.target.value)} placeholder="Paste model B output..." aria-label="Manual output B"/>
            </div>
          </div>
          <div style={{ marginTop:12 }}>
            <button className="btn" onClick={handleReset} aria-label="Reset"><RotateCcw size={13}/> Reset</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom:14 }}>
            <button className="btn" onClick={()=>setShowConfig(s=>!s)} style={{ padding:'6px 14px', fontSize:11 }} aria-expanded={showConfig}>
              ⚙ Model Config
            </button>
          </div>

          {showConfig && (
            <div className="panel slide-up" style={{ padding:16, marginBottom:16 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                <div>
                  <div style={{ fontSize:11, color:'var(--accent2)', letterSpacing:'0.1em', marginBottom:10 }}>MODEL A — REFERENCE</div>
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Model</div>
                    <select className="grok-select" value={modelA} onChange={e=>setModelA(e.target.value)} style={{ width:'100%' }}>
                      {MODELS.map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Temperature: {tempA}</div>
                    <input type="range" min={0} max={2} step={0.1} value={tempA} onChange={e=>setTempA(+e.target.value)} style={{ width:'100%', accentColor:'var(--accent2)' }} aria-label="Model A temperature"/>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>System Prompt</div>
                    <textarea className="grok-textarea" rows={3} value={systemA} onChange={e=>setSystemA(e.target.value)} aria-label="Model A system prompt"/>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'var(--warn)', letterSpacing:'0.1em', marginBottom:10 }}>MODEL B — CANDIDATE</div>
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Model</div>
                    <select className="grok-select" value={modelB} onChange={e=>setModelB(e.target.value)} style={{ width:'100%' }}>
                      {MODELS.map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Temperature: {tempB}</div>
                    <input type="range" min={0} max={2} step={0.1} value={tempB} onChange={e=>setTempB(+e.target.value)} style={{ width:'100%', accentColor:'var(--warn)' }} aria-label="Model B temperature"/>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>System Prompt</div>
                    <textarea className="grok-textarea" rows={3} value={systemB} onChange={e=>setSystemB(e.target.value)} aria-label="Model B system prompt"/>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:11, color:'var(--muted)', letterSpacing:'0.08em', marginBottom:6 }} htmlFor="diff-prompt">SHARED PROMPT</label>
            <textarea id="diff-prompt" className="grok-textarea" rows={4} value={prompt} onChange={e=>setPrompt(e.target.value)}
              placeholder="Enter a prompt to send to both models..." disabled={isLoading} aria-label="Shared prompt for both models"/>
          </div>

          <div style={{ display:'flex', gap:10, marginBottom:20 }}>
            <button className="btn btn-primary" onClick={handleRun}
              disabled={isLoading||!prompt.trim()||!apiKey.trim()}
              aria-label="Run both models"
              style={{ opacity:isLoading||!prompt.trim()||!apiKey.trim()?0.4:1 }}>
              <GitCompare size={13}/>
              {isLoading?'Running...':'Compare Outputs'}
            </button>
            {(outputA||outputB) && (
              <button className="btn" onClick={handleReset} aria-label="Reset diff view"><RotateCcw size={13}/> Reset</button>
            )}
          </div>
        </>
      )}

      {hasDiff && (
        <div style={{ display:'flex', gap:20, padding:'10px 16px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:3, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}
          role="status" aria-label="Diff statistics">
          <span style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.1em' }}>DIFF STATS</span>
          <span style={{ fontSize:12, color:'var(--accent)' }}>+{stats.added} added</span>
          <span style={{ fontSize:12, color:'var(--error)' }}>-{stats.removed} removed</span>
          <span style={{ fontSize:12, color:'var(--muted2)' }}>{stats.unchanged} unchanged</span>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, color:'var(--muted)' }}>Similarity</span>
            <div style={{ width:80, height:4, background:'var(--border2)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ width:`${stats.similarity}%`, height:'100%', background:stats.similarity>70?'var(--accent)':stats.similarity>40?'var(--warn)':'var(--error)', borderRadius:2 }}/>
            </div>
            <span style={{ fontSize:12, color:'var(--text)', fontFamily:'var(--code)' }}>{stats.similarity}%</span>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <DiffPanel tokens={diff} side="left" label={manualMode?'OUTPUT A':'MODEL A — REFERENCE'} model={manualMode?'A':modelA} loading={loadingA} error={errorA}/>
        <DiffPanel tokens={diff} side="right" label={manualMode?'OUTPUT B':'MODEL B — CANDIDATE'} model={manualMode?'B':modelB} loading={loadingB} error={errorB}/>
      </div>

      {hasDiff && (
        <div style={{ display:'flex', gap:16, marginTop:12, fontSize:11, color:'var(--muted)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span className="diff-delete" style={{ fontSize:11, padding:'1px 6px' }}>removed</span>
            <span>only in A (deleted in B)</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span className="diff-insert" style={{ fontSize:11, padding:'1px 6px' }}>added</span>
            <span>only in B (inserted in B)</span>
          </div>
        </div>
      )}
    </div>
  );
}
