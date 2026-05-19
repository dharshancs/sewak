# Grok Lab — Frontend Intern Assignment

A developer portal for on-device inference testing built with React + TypeScript + Grok API.

## Features

### Part A — Inference Playground
- **Multi-modal input**: Toggle between Text and Audio (Web Speech API → Grok)
- **Token-by-token streaming** via `fetch` + `ReadableStream` (SSE parsing)
- **Live metrics**: token count, tokens/sec, elapsed time — updating every 150ms
- **Error handling**: mid-stream failures preserve partial output, never blank screen
- **Accessibility**: WCAG AA — keyboard nav, ARIA roles, focus management, `aria-live`

### Part B — Model Output Diff View
- Side-by-side comparison of two model outputs on the same prompt
- **Custom token-level diffing** — Wagner-Fischer LCS DP, no external diff libraries
- Similarity score, add/remove token counts
- Manual paste mode + live API mode with configurable temperature & system prompts

## Stack
- React 19 + TypeScript (Vite)
- Tailwind CSS v4
- xAI Grok API (OpenAI-compatible streaming)
- lucide-react (icons only)

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173, enter your Grok API key (`xai-...`) in the top-right.

Get a key at: https://console.x.ai

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or: push to GitHub → import at vercel.com → it auto-detects Vite → Deploy.

## Diffing Algorithm

**Algorithm**: Wagner-Fischer LCS (Longest Common Subsequence)  
**Tokenization**: `text.match(/\S+|\s+/g)` — word + whitespace tokens  
**Time complexity**: O(N × M) — N, M = token counts  
**Space complexity**: O(N × M) for DP table + O(N + M) for edit script  

Why over alternatives:
- **Myers diff** — optimal edit script but O((N+M)D), more complex, designed for line-level
- **Patience diff** — great for unique-line code diffs; prose tokens repeat too much
- **LCS** — predictable, clean, perfect for 200-500 token model outputs
