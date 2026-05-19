import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Square, Send, RotateCcw, AlertTriangle, Zap, Clock, Hash, ChevronDown } from 'lucide-react';
import { useGrokStream } from '../hooks/useGrokStream';

interface Props { apiKey: string; }
type InputMode = 'text' | 'audio';

const MODELS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Fast)' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
];

export function InferencePlayground({ apiKey }: Props) {
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('grok-3-mini');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant.');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState('');
  const [audioError, setAudioError] = useState('');

  const outputRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const { state, startStream, stopStream, reset } = useGrokStream();
  const { output, status, error, metrics } = state;

  useEffect(() => {
    if (outputRef.current && status === 'streaming') {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, status]);

  const handleSubmit = useCallback(async () => {
    const activePrompt = inputMode === 'audio' ? audioTranscript : prompt;
    if (!activePrompt.trim() || !apiKey.trim()) return;
    if (status === 'streaming') return;
    await startStream(activePrompt, apiKey, model, systemPrompt);
  }, [inputMode, audioTranscript, prompt, apiKey, status, model, systemPrompt, startStream]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (status === 'streaming') stopStream();
        else handleSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [status, handleSubmit, stopStream]);

  const handleReset = () => { reset(); setPrompt(''); setAudioTranscript(''); promptRef.current?.focus(); };

  const startRecording = () => {
    const SpeechRecognitionAPI = (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) { setAudioError('Speech recognition not supported. Try Chrome or Edge.'); return; }
    setAudioError('');
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let finalTranscript = audioTranscript;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t + ' ';
        else interim = t;
      }
      setAudioTranscript(finalTranscript + interim);
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setAudioError(`Mic error: ${event.error}. Check browser permissions.`);
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => { recognitionRef.current?.stop(); setIsRecording(false); };
  const formatTime = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`;

  const isLoading = status === 'streaming';
  const hasOutput = output.length > 0;
  const activePrompt = inputMode === 'audio' ? audioTranscript : prompt;

  return (
    <div className="slide-up" style={{ maxWidth:900, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontFamily:'var(--code)', fontSize:11, color:'var(--muted)', letterSpacing:'0.12em' }}>PART A — INFERENCE PLAYGROUND</span>
          {status==='streaming' && (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div className="live-dot" style={{ position:'relative', width:8, height:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--accent)', position:'relative', zIndex:1 }}/>
              </div>
              <span style={{ fontSize:11, color:'var(--accent)', letterSpacing:'0.1em' }}>LIVE</span>
            </div>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'var(--muted)', letterSpacing:'0.08em' }}>MODEL</span>
          <div style={{ position:'relative' }}>
            <select className="grok-select" value={model} onChange={e=>setModel(e.target.value)} aria-label="Select model" style={{ paddingRight:32, appearance:'none' }}>
              {MODELS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <ChevronDown size={12} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--muted2)' }}/>
          </div>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display:'flex', gap:0, marginBottom:16, border:'1px solid var(--border)', borderRadius:3, overflow:'hidden', width:'fit-content' }}>
        <button className={`tab ${inputMode==='text'?'active':''}`} onClick={()=>setInputMode('text')}
          aria-pressed={inputMode==='text'} role="tab" style={{ borderRadius:0, padding:'8px 20px' }}>
          Text Input
        </button>
        <button className={`tab ${inputMode==='audio'?'active':''}`} onClick={()=>setInputMode('audio')}
          aria-pressed={inputMode==='audio'} role="tab" style={{ borderRadius:0, padding:'8px 20px', borderLeft:'1px solid var(--border)' }}>
          Audio Input
        </button>
      </div>

      {/* System prompt */}
      <div style={{ marginBottom:12 }}>
        <button className="btn" onClick={()=>setShowSystemPrompt(s=>!s)} style={{ padding:'6px 14px', fontSize:11 }} aria-expanded={showSystemPrompt}>
          <ChevronDown size={12} style={{ transform:showSystemPrompt?'rotate(180deg)':'none', transition:'0.2s' }}/>
          System Prompt
        </button>
        {showSystemPrompt && (
          <div style={{ marginTop:8 }}>
            <textarea className="grok-textarea" rows={2} value={systemPrompt} onChange={e=>setSystemPrompt(e.target.value)}
              placeholder="System prompt..." aria-label="System prompt" style={{ fontStyle:'italic', color:'var(--muted2)' }}/>
          </div>
        )}
      </div>

      {/* Text input */}
      {inputMode==='text' && (
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:11, color:'var(--muted)', letterSpacing:'0.08em', marginBottom:6 }} htmlFor="prompt-input">PROMPT</label>
          <textarea id="prompt-input" ref={promptRef} className="grok-textarea" rows={5} value={prompt}
            onChange={e=>setPrompt(e.target.value)} placeholder="Enter your prompt here... (Ctrl+Enter to submit)"
            disabled={isLoading} aria-label="Prompt input" aria-multiline="true"/>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:4, textAlign:'right' }}>{prompt.length} chars</div>
        </div>
      )}

      {/* Audio input */}
      {inputMode==='audio' && (
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:11, color:'var(--muted)', letterSpacing:'0.08em', marginBottom:8 }}>AUDIO INPUT</label>
          <div className="panel" style={{ padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
              <button className={`btn ${isRecording?'btn-danger':''}`} onClick={isRecording?stopRecording:startRecording}
                aria-label={isRecording?'Stop recording':'Start recording'} aria-pressed={isRecording}>
                {isRecording?<MicOff size={14}/>:<Mic size={14}/>}
                {isRecording?'Stop Recording':'Start Recording'}
              </button>
              {isRecording && (
                <div style={{ display:'flex', alignItems:'center', gap:4, height:20 }}>
                  {[1,2,3,4,5].map(i=><div key={i} className="wave-bar"/>)}
                </div>
              )}
            </div>
            {audioError && (
              <div className="error-msg" style={{ color:'var(--error)', fontSize:12, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                <AlertTriangle size={12}/> {audioError}
              </div>
            )}
            <div style={{ marginBottom:8, fontSize:11, color:'var(--muted)', letterSpacing:'0.08em' }}>TRANSCRIPT</div>
            <textarea className="grok-textarea" rows={4} value={audioTranscript} onChange={e=>setAudioTranscript(e.target.value)}
              placeholder={isRecording?'Listening...':'Transcript will appear here, or type manually...'}
              aria-label="Audio transcript" aria-live="polite"/>
            {audioTranscript && (
              <button onClick={()=>setAudioTranscript('')}
                style={{ marginTop:6, fontSize:11, color:'var(--muted)', background:'none', border:'none', cursor:'pointer', padding:0 }}
                aria-label="Clear transcript">Clear transcript</button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display:'flex', gap:10, marginBottom:24, alignItems:'center' }}>
        <button className="btn btn-primary" onClick={isLoading?stopStream:handleSubmit}
          disabled={!activePrompt.trim()||!apiKey.trim()}
          aria-label={isLoading?'Stop generation':'Submit prompt'}
          style={{ opacity:!activePrompt.trim()||!apiKey.trim()?0.4:1 }}>
          {isLoading?<><Square size={13}/> Stop</>:<><Send size={13}/> Run Inference</>}
        </button>
        {hasOutput && <button className="btn" onClick={handleReset} aria-label="Reset session"><RotateCcw size={13}/> Reset</button>}
        {!apiKey.trim() && (
          <span style={{ fontSize:12, color:'var(--warn)', display:'flex', alignItems:'center', gap:6 }}>
            <AlertTriangle size={12}/> Set your Grok API key above
          </span>
        )}
      </div>

      {/* Metrics */}
      {(isLoading||status==='done') && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
          <div className="metric-card" role="status" aria-label="Token count" aria-live="polite">
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
              <Hash size={11} style={{ color:'var(--accent2)' }}/>
              <span style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.1em' }}>TOKENS</span>
            </div>
            <div style={{ fontSize:22, fontFamily:'var(--code)', color:'var(--text)' }}>{metrics.tokenCount.toLocaleString()}</div>
          </div>
          <div className="metric-card" role="status" aria-label="Tokens per second" aria-live="polite">
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
              <Zap size={11} style={{ color:'var(--accent)' }}/>
              <span style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.1em' }}>TOKENS/SEC</span>
            </div>
            <div style={{ fontSize:22, fontFamily:'var(--code)', color:isLoading?'var(--accent)':'var(--text)' }}>{metrics.tokensPerSecond.toFixed(1)}</div>
          </div>
          <div className="metric-card" role="status" aria-label="Elapsed time" aria-live="polite">
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
              <Clock size={11} style={{ color:'var(--warn)' }}/>
              <span style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.1em' }}>ELAPSED</span>
            </div>
            <div style={{ fontSize:22, fontFamily:'var(--code)', color:'var(--text)' }}>{formatTime(metrics.elapsedMs)}</div>
          </div>
        </div>
      )}

      {/* Error — preserves partial output */}
      {error && (
        <div className="error-msg" role="alert" aria-live="assertive"
          style={{ background:'rgba(255,69,113,0.08)', border:'1px solid var(--error)', borderRadius:3, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'flex-start', gap:10 }}>
          <AlertTriangle size={14} style={{ color:'var(--error)', flexShrink:0, marginTop:1 }}/>
          <div>
            <div style={{ color:'var(--error)', fontSize:12, fontWeight:500, marginBottom:4 }}>Stream Error</div>
            <div style={{ color:'var(--muted2)', fontSize:12 }}>{error}</div>
            {hasOutput && <div style={{ color:'var(--muted)', fontSize:11, marginTop:6 }}>↑ Partial output preserved above</div>}
          </div>
        </div>
      )}

      {/* Output */}
      {(hasOutput||isLoading) && (
        <div className="panel" style={{ position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.1em' }}>OUTPUT</span>
              <span className="chip">{model}</span>
            </div>
            {status==='done' && <span style={{ fontSize:11, color:'var(--accent)', letterSpacing:'0.06em' }}>✓ COMPLETE</span>}
          </div>
          <div ref={outputRef} role="region" aria-label="Model output" aria-live="polite" aria-atomic="false"
            style={{ padding:20, maxHeight:400, overflowY:'auto', fontSize:13, lineHeight:1.8, color:'var(--text)', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
            {output}
            {isLoading && <span className="cursor" aria-hidden="true"/>}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasOutput && !isLoading && status==='idle' && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--muted)', border:'1px dashed var(--border2)', borderRadius:4 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⬡</div>
          <div style={{ fontSize:13, letterSpacing:'0.06em' }}>
            Enter a prompt and press <span style={{ color:'var(--accent)' }}>Run Inference</span>
          </div>
          <div style={{ fontSize:11, marginTop:8, color:'var(--muted)' }}>or use Ctrl+Enter</div>
        </div>
      )}
    </div>
  );
}
