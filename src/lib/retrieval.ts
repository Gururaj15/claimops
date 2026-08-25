/**
 * Real retrieval, not a lookup table: uploaded policy documents are chunked
 * and scored against a claim's query text using TF-IDF + cosine similarity,
 * computed here in plain TypeScript. No embeddings API, no LLM call — which
 * is what keeps this at $0 — but the ranking is genuinely computed from the
 * uploaded document's own content, not templated per claim type.
 *
 * What this deliberately does NOT do: generate free-text answers. It finds
 * and ranks the most relevant passages. Turning "these are the 3 most
 * relevant clauses" into a fluent paragraph is exactly the step a hosted
 * LLM would add in production — see coverage-assistant.ts for where that
 * plugs in and why it's stubbed instead of live here.
 */

export function chunkText(text: string, chunkSize = 600, overlap = 100): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "in", "and", "or", "is", "are", "for", "on",
  "with", "as", "by", "this", "that", "be", "was", "were", "will", "shall",
  "any", "such", "at", "from", "it", "its", "not", "if", "may", "must",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function termFrequencies(text: string): Record<string, number> {
  const freqs: Record<string, number> = {};
  for (const term of tokenize(text)) freqs[term] = (freqs[term] ?? 0) + 1;
  return freqs;
}

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const key of Object.keys(a)) {
    normA += a[key] ** 2;
    if (b[key]) dot += a[key] * b[key];
  }
  for (const key of Object.keys(b)) normB += b[key] ** 2;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export type ScoredChunk = { content: string; filename: string; score: number };

export function searchChunks(
  query: string,
  chunks: { content: string; termFreqs: Record<string, number>; filename: string }[],
  topK = 3
): ScoredChunk[] {
  const queryFreqs = termFrequencies(query);
  return chunks
    .map((c) => ({
      content: c.content,
      filename: c.filename,
      score: cosineSimilarity(queryFreqs, c.termFreqs),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
