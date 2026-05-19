import { useState, useRef, useCallback } from 'react';

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface StreamMetrics {
  tokenCount: number;
  tokensPerSecond: number;
  elapsedMs: number;
  totalDurationMs: number;
}

export interface StreamState {
  output: string;
  status: StreamStatus;
  error: string | null;
  metrics: StreamMetrics;
}

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

export function useGrokStream() {
  const [state, setState] = useState<StreamState>({
    output: '',
    status: 'idle',
    error: null,
    metrics: { tokenCount: 0, tokensPerSecond: 0, elapsedMs: 0, totalDurationMs: 0 },
  });

  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const startTimeRef = useRef<number>(0);
  const tokenCountRef = useRef<number>(0);
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopMetricsInterval = () => {
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = null;
    }
  };

  const startStream = useCallback(async (
    prompt: string,
    apiKey: string,
    model: string = 'grok-3-mini',
    systemPrompt?: string,
  ) => {
    // Cancel any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    stopMetricsInterval();

    abortControllerRef.current = new AbortController();
    startTimeRef.current = Date.now();
    tokenCountRef.current = 0;

    setState({
      output: '',
      status: 'streaming',
      error: null,
      metrics: { tokenCount: 0, tokensPerSecond: 0, elapsedMs: 0, totalDurationMs: 0 },
    });

    // Start live metrics updater
    metricsIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const tps = elapsed > 0 ? (tokenCountRef.current / elapsed) * 1000 : 0;
      setState(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          tokenCount: tokenCountRef.current,
          tokensPerSecond: Math.round(tps * 10) / 10,
          elapsedMs: elapsed,
        },
      }));
    }, 150);

    try {
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await fetch(GROK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          max_tokens: 2048,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `API Error ${response.status}`;
        try {
          const parsed = JSON.parse(errText);
          errMsg = parsed?.error?.message ?? errMsg;
        } catch {
          errMsg = errText || errMsg;
        }
        throw new Error(errMsg);
      }

      if (!response.body) throw new Error('No response body received');

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';
      let fullOutput = '';

      // Read the stream chunk by chunk
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === ':') continue; // skip keep-alives

          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed?.choices?.[0]?.delta?.content;

              if (delta) {
                fullOutput += delta;
                tokenCountRef.current += 1; // each delta ≈ 1 token from API

                const captured = fullOutput; // closure capture
                setState(prev => ({
                  ...prev,
                  output: captured,
                }));
              }

              // Check for finish reason
              const finishReason = parsed?.choices?.[0]?.finish_reason;
              if (finishReason && finishReason !== 'null') {
                // Stream is done
              }
            } catch {
              // Skip malformed JSON chunks — partial chunk handling
            }
          }
        }
      }

      // Stream complete
      stopMetricsInterval();
      const totalDuration = Date.now() - startTimeRef.current;
      const finalTps = tokenCountRef.current > 0
        ? Math.round((tokenCountRef.current / totalDuration) * 1000 * 10) / 10
        : 0;

      setState(prev => ({
        ...prev,
        status: 'done',
        metrics: {
          tokenCount: tokenCountRef.current,
          tokensPerSecond: finalTps,
          elapsedMs: totalDuration,
          totalDurationMs: totalDuration,
        },
      }));

    } catch (err: unknown) {
      stopMetricsInterval();

      // Ignore abort errors (user cancelled)
      if (err instanceof Error && err.name === 'AbortError') {
        const elapsed = Date.now() - startTimeRef.current;
        setState(prev => ({
          ...prev,
          status: 'done',
          metrics: {
            ...prev.metrics,
            elapsedMs: elapsed,
            totalDurationMs: elapsed,
            tokenCount: tokenCountRef.current,
          },
        }));
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        // Preserve partial output — never reset
        metrics: {
          ...prev.metrics,
          tokenCount: tokenCountRef.current,
          elapsedMs: Date.now() - startTimeRef.current,
        },
      }));
    }
  }, []);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    stopMetricsInterval();
  }, []);

  const reset = useCallback(() => {
    stopStream();
    setState({
      output: '',
      status: 'idle',
      error: null,
      metrics: { tokenCount: 0, tokensPerSecond: 0, elapsedMs: 0, totalDurationMs: 0 },
    });
  }, [stopStream]);

  return { state, startStream, stopStream, reset };
}
