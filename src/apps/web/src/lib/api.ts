const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const API = `${BASE}/api`;

export interface FactCheckResult {
  verdict: "TRUE" | "FALSE" | "DISPUTED";
  explanation: string;
  claim: string;
  sourceUrl: string;
  audioBase64: string | null;
  mimeType: string;
}

export interface TrendingResult {
  topics: string[];
}

export async function fetchFactCheck(claim: string, topic: string): Promise<FactCheckResult> {
  const res = await fetch(`${API}/debate/factcheck`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claim, topic }),
  });
  if (!res.ok) throw new Error("Fact-check request failed");
  return res.json() as Promise<FactCheckResult>;
}

export async function fetchTrendingTopics(): Promise<TrendingResult> {
  const res = await fetch(`${API}/debate/trending`);
  if (!res.ok) throw new Error("Trending topics request failed");
  return res.json() as Promise<TrendingResult>;
}

export interface LiveNewsItem {
  title: string;
  snippet: string;
  source: string;
  category: string;
  debateTopic: string;
}

export interface LiveNewsResult {
  news: LiveNewsItem[];
  hasMore: boolean;
  total: number;
}

export async function fetchLiveNews(page = 1, country = "global"): Promise<LiveNewsResult> {
  const res = await fetch(`${API}/debate/news?page=${page}&country=${encodeURIComponent(country)}`);
  if (!res.ok) throw new Error("Live news request failed");
  return res.json() as Promise<LiveNewsResult>;
}

export interface VerdictClaim {
  speaker: string;
  claimText: string;
  verdict: "TRUE" | "MISLEADING" | "FALSE";
  explanation: string;
}

export interface DebateVerdictResult {
  claims: VerdictClaim[];
  summary: string;
}

export async function fetchDebateVerdict(
  topic: string,
  rounds: Array<{ agent1: string; agent2: string; roundName: string }>
): Promise<DebateVerdictResult> {
  const res = await fetch(`${API}/debate/verdict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, rounds }),
  });
  if (!res.ok) throw new Error("Verdict request failed");
  return res.json() as Promise<DebateVerdictResult>;
}
