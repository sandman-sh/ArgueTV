// @ts-nocheck
import { Router, type IRouter } from "express";
import { StartDebateBody, GenerateAudioBody } from "../../../../packages/api-zod/src/generated/api.js";
import { openai } from "../../../../packages/integrations/openai-server/src/client.js";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();

const connectors = new ReplitConnectors();
const DEFAULT_OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini";
const FALLBACK_OPENROUTER_MODELS = [
  DEFAULT_OPENROUTER_MODEL,
  "openrouter/free",
].filter((value, index, array) => Boolean(value) && array.indexOf(value) === index);

// ─── In-memory cache ──────────────────────────────────────────────────────────
type CacheEntry<T> = { data: T; expiresAt: number };
function makeCache<T>(ttlMs: number) {
  let entry: CacheEntry<T> | null = null;
  return {
    get: (): T | null => (entry && Date.now() < entry.expiresAt ? entry.data : null),
    set: (data: T) => { entry = { data, expiresAt: Date.now() + ttlMs }; },
  };
}
const trendingCache = makeCache<object>(10 * 60 * 1000); // 10 min

const ELEVENLABS_VOICE_IDS: Record<string, string> = {
  agent1: "pNInz6obpgDQGcFmaJgB",
  agent2: "N2lVS1w4EtoT3dr4eOWO",
  factchecker: "EXAVITQu4vr4xnSDxMaL",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

type NewsHighlight = { title: string; snippet: string; url: string };
type DebateRoundDraft = { roundName: string; agent1: string; agent2: string };

const DEBATE_ROUNDS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rounds: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          roundName: { type: "string" },
          agent1: { type: "string" },
          agent2: { type: "string" },
        },
        required: ["roundName", "agent1", "agent2"],
      },
    },
  },
  required: ["rounds"],
};

async function fetchWebContextFull(
  topic: string
): Promise<{ summaries: string[]; sources: string[]; highlights: NewsHighlight[] }> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) {
    return { summaries: [`Context about: ${topic}`], sources: [], highlights: [] };
  }

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: topic, limit: 3 }), // no markdown scrape — title+description only, much faster
      signal: AbortSignal.timeout(5000), // never wait more than 5s
    });

    if (!response.ok) {
      return { summaries: [], sources: [], highlights: [] };
    }

    const data = (await response.json()) as {
      data?: Array<{ url?: string; title?: string; description?: string }>;
    };
    const results = data?.data ?? [];

    const summaries = results
      .map((r) => `${r.title ?? ""}: ${r.description ?? ""}`.trim())
      .filter(Boolean);

    const sources = results.map((r) => r.url ?? "").filter(Boolean);

    const highlights: NewsHighlight[] = results.map((r) => ({
      title: r.title ?? "News Article",
      snippet: (r.description ?? "").slice(0, 160).trim(),
      url: r.url ?? "",
    })).filter((h) => h.url);

    return { summaries, sources, highlights };
  } catch {
    return { summaries: [], sources: [], highlights: [] };
  }
}

function extractJsonCandidate(raw: string): string | null {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }

  return null;
}

function normalizeDebateRoundsPayload(payload: unknown): DebateRoundDraft[] | null {
  if (!payload || typeof payload !== "object") return null;

  const roundsValue =
    (payload as { rounds?: unknown }).rounds ??
    (payload as { debateRounds?: unknown }).debateRounds;

  if (!Array.isArray(roundsValue) || roundsValue.length !== 3) {
    return null;
  }

  const rounds = roundsValue
    .map((round) => {
      if (!round || typeof round !== "object") return null;

      const draft = round as Record<string, unknown>;
      if (
        typeof draft.roundName !== "string" ||
        typeof draft.agent1 !== "string" ||
        typeof draft.agent2 !== "string"
      ) {
        return null;
      }

      return {
        roundName: draft.roundName.trim(),
        agent1: draft.agent1.trim(),
        agent2: draft.agent2.trim(),
      };
    })
    .filter(Boolean) as DebateRoundDraft[];

  if (
    rounds.length !== 3 ||
    rounds.some((round) => !round.roundName || !round.agent1 || !round.agent2)
  ) {
    return null;
  }

  return rounds;
}

function parseDebateRounds(raw: string): DebateRoundDraft[] | null {
  const candidate = extractJsonCandidate(raw) ?? raw.trim();
  if (!candidate) return null;

  try {
    return normalizeDebateRoundsPayload(JSON.parse(candidate));
  } catch {
    return null;
  }
}

function getMessageTextContent(message: { content?: unknown } | null | undefined): string {
  const content = message?.content;
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";

        const record = part as Record<string, unknown>;
        if (typeof record.text === "string") return record.text;
        if (
          record.type === "text" &&
          record.text &&
          typeof record.text === "object" &&
          typeof (record.text as Record<string, unknown>).value === "string"
        ) {
          return (record.text as Record<string, string>).value;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

async function createChatTextCompletion(
  messages: Array<{ role: "system" | "user"; content: string }>,
  maxCompletionTokens: number,
  options: { responseFormat?: Record<string, unknown> } = {},
): Promise<{ raw: string; model: string }> {
  let lastError: unknown = null;

  for (const model of FALLBACK_OPENROUTER_MODELS) {
    try {
      const request: Record<string, unknown> = {
        model,
        max_completion_tokens: maxCompletionTokens,
        messages,
      };

      if (options.responseFormat) {
        request.response_format = options.responseFormat;
      }

      if (model === "openrouter/free") {
        request.reasoning = { max_tokens: 0 };
      }

      const response = await openai.chat.completions.create(request);

      const raw = getMessageTextContent(response.choices[0]?.message);
      if (raw) {
        return { raw, model };
      }

      lastError = new Error(`Model ${model} returned an empty response body.`);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return { raw: "", model: FALLBACK_OPENROUTER_MODELS[0] ?? DEFAULT_OPENROUTER_MODEL };
}

async function repairDebateRounds(
  raw: string,
  topic: string,
  language: string,
): Promise<DebateRoundDraft[] | null> {
  try {
    const { raw: repairedRaw } = await createChatTextCompletion(
      [
        {
          role: "system",
          content: `You repair malformed debate output into strict JSON.

Return ONLY valid JSON with exactly this shape:
{"rounds":[{"roundName":"Opening Statement","agent1":"...","agent2":"..."},{"roundName":"Rebuttal","agent1":"...","agent2":"..."},{"roundName":"Final Statement","agent1":"...","agent2":"..."}]}

Rules:
- Keep every speaker response concise and natural
- Each response must be 1-2 short sentences
- Preserve the original meaning when possible
- If the source text is truncated, complete the missing ending coherently
- Output language must be ${language}`,
        },
        {
          role: "user",
          content: `Topic: "${topic}"\n\nMalformed model output:\n${raw}`,
        },
      ],
      400,
      {
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "repaired_debate_rounds",
            strict: true,
            schema: DEBATE_ROUNDS_SCHEMA,
          },
        },
      },
    );
    return parseDebateRounds(repairedRaw);
  } catch {
    return null;
  }
}

function createEmergencyDebateRounds(topic: string): Array<{
  round: number;
  roundName: string;
  agent1: string;
  agent2: string;
}> {
  const subject = topic.trim().replace(/\s+/g, " ") || "this issue";

  return [
    {
      round: 1,
      roundName: "Opening Statement",
      agent1: `Backing ${subject} could create real benefits. The upside deserves a serious chance.`,
      agent2: `Backing ${subject} could create real risks. The downsides deserve close scrutiny.`,
    },
    {
      round: 2,
      roundName: "Rebuttal",
      agent1: `Those risks can be managed with clear guardrails. Avoiding action could cost even more.`,
      agent2: `Guardrails often sound better than they work. Moving too fast can lock in damage.`,
    },
    {
      round: 3,
      roundName: "Final Statement",
      agent1: `The stronger path is to improve ${subject}, not fear it. Progress should be shaped, not stalled.`,
      agent2: `The wiser path is caution before commitment. Good intentions do not erase long-term consequences.`,
    },
  ];
}

/** Generate all 3 rounds for both anchors in a single GPT call */
async function generateFullDebate(
  topic: string,
  context: string,
  language = "English"
): Promise<Array<{ round: number; roundName: string; agent1: string; agent2: string }>> {
  const langInstruction = language !== "English"
    ? `IMPORTANT: Every argument MUST be written entirely in ${language}. Do not use English at all.`
    : "";

  const systemPrompt = `You are a live TV debate show writer. Generate a full 3-round debate between two AI news anchors.

Anchor One (Alex Mercer): confident, persuasive, argues IN FAVOR of the topic. Sharp and assertive.
Anchor Two (Jordan Blake): calm, analytical, argues AGAINST the topic. Measured and logical.

Rules:
- Each argument: exactly 2 short spoken sentences, no bullet points, no markdown
- Keep each speaker under 35 words total
- Arguments must reference and rebut each other in later rounds — make it feel like a real live debate
- Round 2 must directly respond to Round 1 arguments
- Round 3 must be a strong closing that builds on the full debate
${langInstruction}

Respond ONLY with valid JSON, no markdown fences:
{"rounds":[{"roundName":"Opening Statement","agent1":"...","agent2":"..."},{"roundName":"Rebuttal","agent1":"...","agent2":"..."},{"roundName":"Final Statement","agent1":"...","agent2":"..."}]}`;

  const userPrompt = `Debate topic: "${topic}"

Live web research context:
${context || "Use your general knowledge about this topic."}

Generate the full 3-round debate now${language !== "English" ? ` in ${language}` : ""}.`;

  const { raw, model } = await createChatTextCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    500,
    {
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "debate_rounds",
          strict: true,
          schema: DEBATE_ROUNDS_SCHEMA,
        },
      },
    },
  );
  const parsedRounds = parseDebateRounds(raw);
  if (parsedRounds) {
    return parsedRounds.map((r, i) => ({
      round: i + 1,
      roundName: r.roundName,
      agent1: r.agent1,
      agent2: r.agent2,
    }));
  }

  const repairedRounds = await repairDebateRounds(raw, topic, language);
  if (repairedRounds) {
    return repairedRounds.map((r, i) => ({
      round: i + 1,
      roundName: r.roundName,
      agent1: r.agent1,
      agent2: r.agent2,
    }));
  }

  console.warn(`Failed to parse debate output from model ${model}:`, raw.slice(0, 500));

  return createEmergencyDebateRounds(topic);
}

async function synthesizeAudio(
  text: string,
  voiceKey: string,
  language = "English"
): Promise<{ audioBase64: string; mimeType: string } | null> {
  const voiceId = ELEVENLABS_VOICE_IDS[voiceKey] ?? ELEVENLABS_VOICE_IDS.agent1;
  const modelId = language !== "English" ? "eleven_multilingual_v2" : "eleven_turbo_v2";

  const ttsBody = JSON.stringify({
    text,
    model_id: modelId,
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  });

  // Try env var first (fastest path)
  const envKey = process.env.ELEVENLABS_API_KEY;
  if (envKey) {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": envKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: ttsBody,
      });
      if (response.ok) {
        const ab = await response.arrayBuffer();
        return { audioBase64: Buffer.from(ab).toString("base64"), mimeType: "audio/mpeg" };
      }
      const errText = await response.text().catch(() => "(unreadable)");
      console.error(`ElevenLabs direct API error: ${response.status} ${response.statusText} — ${errText.slice(0, 300)}`);
    } catch (err) {
      console.error("ElevenLabs direct API exception:", err);
      // fall through to proxy
    }
  }

  // Fallback: Replit connector proxy
  try {
    const response = await connectors.proxy("elevenlabs", `/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: ttsBody,
    });
    if (!response.ok) return null;
    const ab = await response.arrayBuffer();
    return { audioBase64: Buffer.from(ab).toString("base64"), mimeType: "audio/mpeg" };
  } catch {
    return null;
  }
}

// ─── POST /debate ─────────────────────────────────────────────────────────────

router.post("/debate", async (req, res) => {
  const parsed = StartDebateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { topic } = parsed.data;
  const language = typeof (req.body as Record<string, unknown>).language === "string"
    ? (req.body as Record<string, string>).language
    : "English";

  try {
    // Run Firecrawl research AND debate generation fully in parallel
    // GPT uses its own knowledge for the debate; Firecrawl supplies the sources panel
    const [debateRounds, { sources, highlights }] = await Promise.all([
      generateFullDebate(topic, "", language),
      fetchWebContextFull(topic).then(({ sources, highlights }) => ({ sources, highlights })),
    ]);

    res.json({ topic, rounds: debateRounds, sources, newsHighlights: highlights });
  } catch (err) {
    req.log.error({ err }, "Debate generation failed");
    res.status(500).json({ error: "Failed to generate debate" });
  }
});

// ─── POST /debate/audio ───────────────────────────────────────────────────────

router.post("/debate/audio", async (req, res) => {
  const parsed = GenerateAudioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { text, voice } = parsed.data;
  const language = typeof (req.body as Record<string, unknown>).language === "string"
    ? (req.body as Record<string, string>).language
    : "English";

  try {
    const result = await synthesizeAudio(text, voice, language);
    if (!result) {
      req.log.error({ status: 'failed' }, "ElevenLabs TTS failed");
      res.status(500).json({ error: "Audio synthesis failed" });
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Audio generation error");
    res.status(500).json({ error: "Failed to generate audio" });
  }
});

// ─── POST /debate/factcheck ───────────────────────────────────────────────────

router.post("/debate/factcheck", async (req, res) => {
  const { claim, topic } = req.body as { claim?: string; topic?: string };
  if (!claim || !topic) {
    res.status(400).json({ error: "claim and topic are required" });
    return;
  }

  try {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    let searchContext = "";
    let sourceUrl = "";

    if (firecrawlKey) {
      try {
        const fcRes = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `fact check: ${claim}`,
            limit: 3,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });

        if (fcRes.ok) {
          const data = (await fcRes.json()) as {
            data?: Array<{ url?: string; markdown?: string; title?: string }>;
          };
          const results = data?.data ?? [];
          searchContext = results
            .slice(0, 3)
            .map((r) => (r.markdown ?? r.title ?? "").slice(0, 400))
            .join("\n\n");
          sourceUrl = results[0]?.url ?? "";
        }
      } catch {
        searchContext = "";
      }
    }

    const verdictRes = await openai.chat.completions.create({
      model: DEFAULT_OPENROUTER_MODEL,
      max_completion_tokens: 120,
      messages: [
        {
          role: "system",
          content: `You are a live TV fact-checker. Given a claim and web evidence, determine if the claim is TRUE, FALSE, or DISPUTED.
Respond with exactly this JSON format (no markdown):
{"verdict":"TRUE"|"FALSE"|"DISPUTED","explanation":"One sentence explanation."}`,
        },
        {
          role: "user",
          content: `Claim: "${claim}"\n\nWeb evidence:\n${searchContext || "No specific evidence found, use general knowledge."}`,
        },
      ],
    });

    let verdict: "TRUE" | "FALSE" | "DISPUTED" = "DISPUTED";
    let explanation = "The evidence is inconclusive on this claim.";

    try {
      const raw = verdictRes.choices[0]?.message?.content?.trim() ?? "{}";
      const parsed = JSON.parse(raw) as { verdict?: string; explanation?: string };
      if (parsed.verdict === "TRUE" || parsed.verdict === "FALSE" || parsed.verdict === "DISPUTED") {
        verdict = parsed.verdict;
      }
      if (parsed.explanation) explanation = parsed.explanation;
    } catch {
      /* use defaults */
    }

    const announcementText = `Fact check! The claim that ${claim.slice(0, 80)} is ${verdict}. ${explanation}`;
    const audio = await synthesizeAudio(announcementText, "factchecker");

    res.json({
      verdict,
      explanation,
      claim,
      sourceUrl,
      audioBase64: audio?.audioBase64 ?? null,
      mimeType: audio?.mimeType ?? "audio/mpeg",
    });
  } catch (err) {
    req.log.error({ err }, "Fact-check failed");
    res.status(500).json({ error: "Fact-check failed" });
  }
});

// ─── POST /debate/verdict ─────────────────────────────────────────────────────

router.post("/debate/verdict", async (req, res) => {
  try {
    const { topic, rounds } = req.body as {
      topic: string;
      rounds: Array<{ agent1: string; agent2: string; roundName: string }>;
    };

    const agent1Text = rounds.map((r) => r.agent1).filter(Boolean).join(" ");
    const agent2Text = rounds.map((r) => r.agent2).filter(Boolean).join(" ");

    // Firecrawl: search for fact-check context about the topic
    let factContext = "";
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (firecrawlKey) {
      try {
        const fcRes = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `fact check ${topic} evidence statistics`,
            limit: 5,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });
        if (fcRes.ok) {
          const data = (await fcRes.json()) as {
            data?: Array<{ url?: string; markdown?: string; title?: string; description?: string }>;
          };
          factContext = (data?.data ?? [])
            .slice(0, 5)
            .map((r) => (r.markdown ?? r.description ?? r.title ?? "").slice(0, 400))
            .filter(Boolean)
            .join("\n\n");
        }
      } catch {
        factContext = "";
      }
    }

    const verdictRes = await openai.chat.completions.create({
      model: DEFAULT_OPENROUTER_MODEL,
      max_completion_tokens: 700,
      messages: [
        {
          role: "system",
          content: `You are an AI debate fact-checker for a live TV show. 
Extract exactly 3 key factual claims from EACH debater (6 total) and classify each as TRUE, MISLEADING, or FALSE based on the web research context and your knowledge.
TRUE = verifiably accurate. MISLEADING = partially true but lacks context or cherry-picks data. FALSE = factually incorrect.

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "claims": [
    {
      "speaker": "Alex Mercer",
      "claimText": "short quote or paraphrase of the claim (max 15 words)",
      "verdict": "TRUE",
      "explanation": "One concise sentence explaining why."
    }
  ],
  "summary": "2-3 sentence neutral assessment of which side had stronger factual grounding and why."
}`,
        },
        {
          role: "user",
          content: `Debate topic: "${topic}"

Alex Mercer (In Favor) argued:
${agent1Text}

Jordan Blake (Against) argued:
${agent2Text}

Web research & fact-check context:
${factContext || "No specific context available — use your best knowledge."}

Extract and classify 3 claims from each debater (6 total).`,
        },
      ],
    });

    let claims: Array<{
      speaker: string;
      claimText: string;
      verdict: "TRUE" | "MISLEADING" | "FALSE";
      explanation: string;
    }> = [];
    let summary = "The debate covered complex issues where both sides presented a mix of accurate and nuanced claims.";

    try {
      const raw = verdictRes.choices[0]?.message?.content?.trim() ?? "{}";
      const parsed = JSON.parse(raw) as { claims?: unknown; summary?: string };
      if (Array.isArray(parsed.claims)) {
        claims = (parsed.claims as Array<Record<string, unknown>>)
          .filter(
            (c) =>
              typeof c.speaker === "string" &&
              typeof c.claimText === "string" &&
              (c.verdict === "TRUE" || c.verdict === "MISLEADING" || c.verdict === "FALSE")
          )
          .map((c) => ({
            speaker: c.speaker as string,
            claimText: c.claimText as string,
            verdict: c.verdict as "TRUE" | "MISLEADING" | "FALSE",
            explanation: typeof c.explanation === "string" ? c.explanation : "",
          }))
          .slice(0, 6);
      }
      if (typeof parsed.summary === "string" && parsed.summary.length > 0) {
        summary = parsed.summary;
      }
    } catch {
      /* use defaults */
    }

    res.json({ claims, summary });
  } catch (err) {
    req.log.error({ err }, "Verdict generation failed");
    res.status(500).json({ error: "Verdict generation failed" });
  }
});

// ─── GET /debate/trending ─────────────────────────────────────────────────────

router.get("/debate/trending", async (_req, res) => {
  try {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    let context = "";

    if (firecrawlKey) {
      try {
        const fcRes = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: "most controversial news topics political social debate 2025",
            limit: 5,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });

        if (fcRes.ok) {
          const data = (await fcRes.json()) as {
            data?: Array<{ url?: string; markdown?: string; title?: string }>;
          };
          const results = data?.data ?? [];
          context = results
            .slice(0, 5)
            .map((r) => (r.markdown ?? r.title ?? "").slice(0, 300))
            .join("\n\n");
        }
      } catch {
        context = "";
      }
    }

    const topicsRes = await openai.chat.completions.create({
      model: DEFAULT_OPENROUTER_MODEL,
      max_completion_tokens: 150,
      messages: [
        {
          role: "system",
          content: `You generate debate topics for a live TV debate show. Based on current events, return exactly 6 short, punchy, debate-worthy topics.
Respond with exactly this JSON format (no markdown, no extra text):
{"topics":["topic1","topic2","topic3","topic4","topic5","topic6"]}
Each topic should be 3-7 words, controversial, specific, and great for debate.`,
        },
        {
          role: "user",
          content: context
            ? `Here are some current news headlines:\n${context}\n\nGenerate 6 trending debate topics.`
            : "Generate 6 trending debate topics based on current events.",
        },
      ],
    });

    let topics: string[] = [
      "AI is replacing creative jobs",
      "Social media harms democracy",
      "Universal Basic Income works",
      "Remote work kills culture",
      "Nuclear energy is the future",
      "Crypto will replace cash",
    ];

    try {
      const raw = topicsRes.choices[0]?.message?.content?.trim() ?? "{}";
      const parsed = JSON.parse(raw) as { topics?: unknown };
      if (Array.isArray(parsed.topics) && parsed.topics.length > 0) {
        topics = (parsed.topics as unknown[])
          .filter((t): t is string => typeof t === "string")
          .slice(0, 6);
      }
    } catch {
      /* use defaults */
    }

    res.json({ topics });
  } catch (err) {
    _req.log?.error({ err }, "Trending topics failed");
    res.json({
      topics: [
        "AI is replacing creative jobs",
        "Social media harms democracy",
        "Universal Basic Income works",
        "Remote work kills culture",
        "Nuclear energy is the future",
        "Crypto will replace cash",
      ],
    });
  }
});

// ─── RSS helpers ─────────────────────────────────────────────────────────────

type RSSItem = { title: string; link: string; description: string; source: string };

/** Pull text out of a tag, stripping CDATA wrappers and HTML entities */
function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return "";
  return m[1]
    .replace(/<[^>]+>/g, " ")      // strip HTML tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fetch one RSS feed and return parsed items */
async function fetchRSSFeed(url: string, sourceName: string): Promise<RSSItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ArgueTV-NewsBot/1.0", Accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: RSSItem[] = [];
    const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml)) !== null) {
      const block = m[1];
      const title = extractTag(block, "title");
      // BBC feeds use <link> as a text node between two tags — also try <guid>
      let link = extractTag(block, "link");
      if (!link || link.startsWith("http") === false) {
        link = extractTag(block, "guid");
      }
      const description = extractTag(block, "description");
      if (title && link?.startsWith("http")) {
        items.push({ title, link, description, source: sourceName });
      }
    }
    return items;
  } catch {
    return [];
  }
}

// RSS feeds by country — free, no API key, updated constantly
type FeedDef = { url: string; source: string; category: string };

const COUNTRY_FEEDS: Record<string, FeedDef[]> = {
  global: [
    { url: "https://feeds.bbci.co.uk/news/politics/rss.xml",                source: "BBC News",          category: "Politics"    },
    { url: "https://feeds.bbci.co.uk/news/technology/rss.xml",              source: "BBC News",          category: "Technology"  },
    { url: "https://feeds.bbci.co.uk/news/business/rss.xml",                source: "BBC News",          category: "Business"    },
    { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", source: "BBC News",          category: "Science"     },
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml",                   source: "BBC News",          category: "World"       },
    { url: "https://feeds.bbci.co.uk/news/health/rss.xml",                  source: "BBC News",          category: "Society"     },
    { url: "https://feeds.npr.org/1001/rss.xml",                            source: "NPR",               category: "Politics"    },
    { url: "https://feeds.npr.org/1019/rss.xml",                            source: "NPR",               category: "World"       },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",   source: "NY Times",          category: "Technology"  },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",     source: "NY Times",          category: "Business"    },
  ],
  us: [
    { url: "https://feeds.npr.org/1001/rss.xml",                            source: "NPR",               category: "Politics"    },
    { url: "https://feeds.npr.org/1003/rss.xml",                            source: "NPR",               category: "Science"     },
    { url: "https://feeds.npr.org/1019/rss.xml",                            source: "NPR",               category: "World"       },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/US.xml",           source: "NY Times",          category: "Politics"    },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",   source: "NY Times",          category: "Technology"  },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",     source: "NY Times",          category: "Business"    },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml",       source: "NY Times",          category: "Society"     },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",      source: "NY Times",          category: "Science"     },
  ],
  uk: [
    { url: "https://feeds.bbci.co.uk/news/politics/rss.xml",                source: "BBC News",          category: "Politics"    },
    { url: "https://feeds.bbci.co.uk/news/uk/rss.xml",                      source: "BBC News",          category: "World"       },
    { url: "https://feeds.bbci.co.uk/news/technology/rss.xml",              source: "BBC News",          category: "Technology"  },
    { url: "https://feeds.bbci.co.uk/news/business/rss.xml",                source: "BBC News",          category: "Business"    },
    { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", source: "BBC News",          category: "Science"     },
    { url: "https://feeds.bbci.co.uk/news/health/rss.xml",                  source: "BBC News",          category: "Society"     },
    { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",  source: "BBC News",          category: "Society"     },
    { url: "https://feeds.bbci.co.uk/news/england/rss.xml",                 source: "BBC News",          category: "Politics"    },
  ],
  india: [
    { url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",    source: "Times of India",    category: "Politics"    },
    { url: "https://timesofindia.indiatimes.com/rssfeeds/2886704.cms",      source: "Times of India",    category: "Business"    },
    { url: "https://timesofindia.indiatimes.com/rssfeeds/1221656.cms",      source: "Times of India",    category: "Technology"  },
    { url: "https://timesofindia.indiatimes.com/rssfeeds/4719148.cms",      source: "Times of India",    category: "Science"     },
    { url: "https://www.thehindu.com/news/national/feeder/default.rss",     source: "The Hindu",         category: "Politics"    },
    { url: "https://www.thehindu.com/business/feeder/default.rss",          source: "The Hindu",         category: "Business"    },
    { url: "https://www.thehindu.com/sci-tech/feeder/default.rss",          source: "The Hindu",         category: "Technology"  },
    { url: "https://www.thehindu.com/sport/feeder/default.rss",             source: "The Hindu",         category: "Society"     },
  ],
  germany: [
    { url: "https://rss.dw.com/rdf/rss-en-top",                             source: "Deutsche Welle",    category: "Politics"    },
    { url: "https://rss.dw.com/rdf/rss-en-all",                             source: "Deutsche Welle",    category: "World"       },
    { url: "https://www.spiegel.de/international/index.rss",                source: "Der Spiegel",       category: "Politics"    },
    { url: "https://rss.euronews.com/en/rss.xml",                           source: "Euronews",          category: "World"       },
  ],
  france: [
    { url: "https://www.france24.com/en/rss",                               source: "France 24",         category: "World"       },
    { url: "https://rss.euronews.com/en/rss.xml",                           source: "Euronews",          category: "World"       },
    { url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml",            source: "BBC News",          category: "Politics"    },
  ],
  australia: [
    { url: "https://www.abc.net.au/news/feed/51120/rss.xml",                source: "ABC Australia",     category: "World"       },
    { url: "https://www.abc.net.au/news/feed/45910/rss.xml",                source: "ABC Australia",     category: "Business"    },
    { url: "https://www.abc.net.au/news/feed/45924/rss.xml",                source: "ABC Australia",     category: "Politics"    },
    { url: "https://www.abc.net.au/news/feed/1534/rss.xml",                 source: "ABC Australia",     category: "Science"     },
    { url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml",              source: "BBC News",          category: "World"       },
  ],
  canada: [
    { url: "https://www.cbc.ca/cmlink/rss-topstories",                      source: "CBC",               category: "Politics"    },
    { url: "https://www.cbc.ca/cmlink/rss-world",                           source: "CBC",               category: "World"       },
    { url: "https://www.cbc.ca/cmlink/rss-canada",                          source: "CBC",               category: "Politics"    },
    { url: "https://www.cbc.ca/cmlink/rss-business",                        source: "CBC",               category: "Business"    },
    { url: "https://www.cbc.ca/cmlink/rss-technology",                      source: "CBC",               category: "Technology"  },
    { url: "https://www.cbc.ca/cmlink/rss-health",                          source: "CBC",               category: "Society"     },
  ],
  japan: [
    { url: "https://www.japantimes.co.jp/feed/",                            source: "Japan Times",       category: "World"       },
    { url: "https://www.aljazeera.com/xml/rss/all.xml",                     source: "Al Jazeera",        category: "World"       },
    { url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml",              source: "BBC News",          category: "World"       },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",        source: "NY Times",          category: "World"       },
  ],
};

// Global feeds alias used by the ticker (always global)
const RSS_FEEDS = COUNTRY_FEEDS.global;

// ─── GET /debate/ticker ───────────────────────────────────────────────────────
const tickerCache = makeCache<object>(2 * 60 * 1000); // 2 min

router.get("/debate/ticker", async (_req, res) => {
  const cached = tickerCache.get();
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    type Article = { title: string; url: string; source: string; category: string };

    const settled = await Promise.allSettled(
      RSS_FEEDS.map(async ({ url, source, category }) => {
        const items = await fetchRSSFeed(url, source);
        return items.slice(0, 3).map((it): Article => ({
          title: it.title,
          url: it.link,
          source,
          category,
        }));
      })
    );

    const articles: Article[] = settled
      .filter((r): r is PromiseFulfilledResult<Article[]> => r.status === "fulfilled")
      .flatMap((r) => r.value)
      .filter((a) => a.title && a.url);

    const payload = articles.length >= 4 ? { articles } : {
      articles: [
        { title: "OpenAI releases new reasoning model capabilities",       url: "https://openai.com/news",             source: "OpenAI",  category: "Technology" },
        { title: "Global markets mixed amid central bank uncertainty",     url: "https://reuters.com/business",        source: "Reuters", category: "Business"   },
        { title: "Climate scientists warn of record temperatures ahead",   url: "https://bbc.com/news/science",        source: "BBC",     category: "Science"    },
        { title: "World leaders meet for emergency AI regulation summit",  url: "https://theguardian.com",             source: "Guardian",category: "World"      },
        { title: "Social media platforms face new content rules",          url: "https://techcrunch.com",              source: "TechCrunch", category: "Technology" },
        { title: "Central banks signal potential rate cuts this year",     url: "https://ft.com",                      source: "FT",      category: "Business"   },
      ],
    };

    tickerCache.set(payload);
    res.json(payload);
  } catch (err) {
    _req.log?.error({ err }, "Ticker RSS failed");
    tickerCache.set({ articles: [] });
    res.json({ articles: [] });
  }
});

// ─── GET /debate/news ─────────────────────────────────────────────────────────
// Returns paginated RSS news cards. No GPT — direct from feeds, very fast.

type NewsCard = { title: string; snippet: string; source: string; category: string; debateTopic: string };

function headlineToDebateTopic(title: string): string {
  const t = title.trim().replace(/\.$/, "");
  if (/^(should|is|are|will|can|does|do|has|have|was|were|did)\b/i.test(t)) return t + "?";
  if (/^(why|how|what|when|where)\b/i.test(t)) return `Should we care about: ${t}?`;
  return `Should this be debated: ${t}?`;
}

const NEWS_PER_PAGE = 9;
// Per-country cache — each country gets its own 5-min cache
const newsCacheMap = new Map<string, ReturnType<typeof makeCache<{ all: NewsCard[] }>>>();
function getNewsCache(country: string) {
  if (!newsCacheMap.has(country)) newsCacheMap.set(country, makeCache<{ all: NewsCard[] }>(5 * 60 * 1000));
  return newsCacheMap.get(country)!;
}

const NEWS_FALLBACK: NewsCard[] = [
  { title: "AI threatens millions of jobs",          snippet: "Automation is outpacing job creation globally",       source: "BBC News", category: "Technology", debateTopic: "Should AI development be regulated to protect jobs?" },
  { title: "Central banks raise rates again",        snippet: "Economists split on recession risk",                 source: "NPR",      category: "Business",   debateTopic: "Are interest rate hikes hurting working people?" },
  { title: "Climate summit ends in stalemate",       snippet: "Nations failed on binding emissions targets",        source: "BBC News", category: "Science",    debateTopic: "Should wealthy nations pay climate reparations?" },
  { title: "Social media age ban proposed",          snippet: "Lawmakers push to ban teens from platforms",         source: "BBC News", category: "Society",    debateTopic: "Should social media be banned for under-16s?" },
  { title: "Crypto market hits new record",          snippet: "Bitcoin surges on institutional buying",             source: "NY Times", category: "Business",   debateTopic: "Will cryptocurrency replace traditional banking?" },
  { title: "Immigration sparks street protests",     snippet: "New border rules draw mass demonstrations",          source: "NPR",      category: "Politics",   debateTopic: "Should countries have stricter immigration policies?" },
  { title: "Nuclear energy investments surge",       snippet: "Nations revisit nuclear as fossil fuel alternative", source: "BBC News", category: "Science",    debateTopic: "Should nuclear energy replace fossil fuels?" },
  { title: "Universal basic income trials begin",    snippet: "Early results show mixed economic outcomes",         source: "NPR",      category: "Politics",   debateTopic: "Should governments implement universal basic income?" },
  { title: "Space tourism takes off commercially",   snippet: "Billionaires race to commercialise the cosmos",      source: "BBC News", category: "Technology", debateTopic: "Is space tourism a waste of resources?" },
];

router.get("/debate/news", async (req, res) => {
  const q = req.query as Record<string, string>;
  const page    = Math.max(1, parseInt(q.page ?? "1", 10));
  const country = (q.country ?? "global").toLowerCase().replace(/[^a-z]/g, "");
  const feeds   = COUNTRY_FEEDS[country] ?? COUNTRY_FEEDS.global;
  const cache   = getNewsCache(country);

  // Return from per-country cache if available — just slice the page
  const cached = cache.get();
  if (cached) {
    const slice = cached.all.slice((page - 1) * NEWS_PER_PAGE, page * NEWS_PER_PAGE);
    const hasMore = cached.all.length > page * NEWS_PER_PAGE;
    return res.json({ news: slice, hasMore, total: cached.all.length });
  }

  try {
    // Fetch all RSS feeds for this country in parallel — no GPT, very fast
    const settled = await Promise.allSettled(
      feeds.map(({ url, source, category }) =>
        fetchRSSFeed(url, source).then((items) =>
          items.map((it): NewsCard => ({
            title:       it.title.trim().slice(0, 120),
            snippet:     it.description.trim().slice(0, 200),
            source,
            category,
            debateTopic: headlineToDebateTopic(it.title),
          }))
        )
      )
    );

    // Interleave results so we get variety (1 from each feed per round-robin pass)
    const buckets = settled
      .filter((r): r is PromiseFulfilledResult<NewsCard[]> => r.status === "fulfilled")
      .map((r) => r.value);

    const all: NewsCard[] = [];
    const maxLen = Math.max(...buckets.map((b) => b.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const bucket of buckets) {
        if (bucket[i]) all.push(bucket[i]);
      }
    }

    const payload = all.length >= 3 ? { all } : { all: NEWS_FALLBACK };
    cache.set(payload);
    const slice = payload.all.slice(0, NEWS_PER_PAGE);
    const hasMore = payload.all.length > NEWS_PER_PAGE;
    return res.json({ news: slice, hasMore, total: payload.all.length });
  } catch (err) {
    req.log?.error({ err }, "Live news RSS failed");
    cache.set({ all: NEWS_FALLBACK });
    return res.json({ news: NEWS_FALLBACK.slice(0, NEWS_PER_PAGE), hasMore: false, total: NEWS_FALLBACK.length });
  }
});

export default router;

