/**
 * Custom Token-Level Diff Algorithm
 * ====================================
 * Algorithm: Wagner-Fischer LCS (Longest Common Subsequence) DP
 *
 * Why this over alternatives?
 * - Myers diff: optimal for line-level diffs; produces minimal edit scripts but
 *   has O((N+M)*D) complexity that degrades for dense token-level changes.
 * - LCS (this): O(N*M) time, O(N*M) space. Predictable, easy to explain,
 *   correct for token-granularity comparisons. For paragraph-length outputs
 *   (N,M ~ few hundred tokens), this is perfectly fast.
 * - Patience diff: great for code with unique lines; unnecessary complexity here.
 *
 * Time Complexity: O(N * M) — N = tokens in A, M = tokens in B
 * Space Complexity: O(N * M) for the DP table + O(N + M) for the edit script
 *
 * Tokenization: Split on word boundaries while preserving whitespace as tokens.
 * This gives true token-level diffs (individual words/symbols highlighted).
 */

export type DiffType = 'equal' | 'delete' | 'insert';

export interface DiffToken {
  type: DiffType;
  value: string;
}

/**
 * Tokenize text into words and whitespace segments.
 * Preserves whitespace so the rendered output looks natural.
 */
export function tokenize(text: string): string[] {
  // Split into word tokens and whitespace tokens
  const tokens = text.match(/\S+|\s+/g) ?? [];
  return tokens;
}

/**
 * Build the LCS DP table.
 * dp[i][j] = length of LCS of a[0..i-1] and b[0..j-1]
 */
function buildLCSTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  // Use Uint32Array for memory efficiency
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

/**
 * Backtrack the DP table to produce a flat diff sequence.
 * Returns operations from perspective of a unified diff:
 *   equal  → token present in both A and B
 *   delete → token only in A (removed in B)
 *   insert → token only in B (added in B)
 */
function backtrack(dp: number[][], a: string[], b: string[]): DiffToken[] {
  const ops: DiffToken[] = [];
  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      // Tokens match — equal
      ops.push({ type: 'equal', value: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // Advance in B — insertion
      ops.push({ type: 'insert', value: b[j - 1] });
      j--;
    } else {
      // Advance in A — deletion
      ops.push({ type: 'delete', value: a[i - 1] });
      i--;
    }
  }

  ops.reverse();
  return ops;
}

/**
 * Main diff function.
 * Returns a unified diff sequence of DiffTokens.
 * 
 * Callers render this as:
 *   Left panel (A):  show 'equal' and 'delete', hide 'insert'
 *   Right panel (B): show 'equal' and 'insert', hide 'delete'
 */
export function computeDiff(textA: string, textB: string): DiffToken[] {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.length === 0 && tokensB.length === 0) return [];

  const dp = buildLCSTable(tokensA, tokensB);
  return backtrack(dp, tokensA, tokensB);
}

/** Stats helper */
export interface DiffStats {
  total: number;
  added: number;
  removed: number;
  unchanged: number;
  similarity: number; // 0-100
}

export function getDiffStats(diff: DiffToken[]): DiffStats {
  const added = diff.filter(d => d.type === 'insert' && d.value.trim()).length;
  const removed = diff.filter(d => d.type === 'delete' && d.value.trim()).length;
  const unchanged = diff.filter(d => d.type === 'equal' && d.value.trim()).length;
  const total = added + removed + unchanged;
  const similarity = total === 0 ? 100 : Math.round((unchanged / total) * 100);
  return { total, added, removed, unchanged, similarity };
}
