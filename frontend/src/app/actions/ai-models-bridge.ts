'use server';

/**
 * AI Models Bridge
 * Single local model: Gemma 4 12B on Ollama.
 * Chat goes through the Helix guardrails service (NeMo Guardrails in
 * nexus-backend). If that service is down, chat falls back to calling Gemma
 * directly and labels the reply as unguarded.
 */

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const GEMMA_MODEL = process.env.MODEL_NAME || 'gemma4:12b';
const NEXUS_BACKEND_URL = process.env.NEXUS_BACKEND_URL || 'http://localhost:8001';

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ModelGenerationResult {
  text: string;
  agent: string;
  usage?: TokenUsage;
  latency_ms?: number;
  guardrails?: { blocked: boolean; rail?: string | null; guarded: boolean };
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function estimateUsage(prompt: string, text: string): TokenUsage {
  const prompt_tokens = Math.max(1, Math.round(prompt.length / 4));
  const completion_tokens = Math.max(1, Math.round(text.length / 4));
  return { prompt_tokens, completion_tokens, total_tokens: prompt_tokens + completion_tokens };
}

/** One non-streaming chat call to local Gemma. Returns null on failure. */
async function ollamaChat(
  messages: ChatHistoryMessage[],
  opts: { json?: boolean; temperature?: number; timeoutMs?: number } = {}
): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GEMMA_MODEL,
        messages,
        stream: false,
        ...(opts.json ? { format: 'json' } : {}),
        options: { temperature: opts.temperature ?? 0.7 },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.message?.content ?? null;
  } catch (err) {
    console.error('Gemma (Ollama) error:', err);
    return null;
  }
}

export async function generateCompletion(
  prompt: string,
  _modelId: string,
  modelName: string,
  _provider: string,
  history?: ChatHistoryMessage[]
): Promise<ModelGenerationResult> {
  const startTime = Date.now();
  const messages: ChatHistoryMessage[] = [
    ...(history || []).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: prompt },
  ];

  // 1. Guarded path: Helix / NeMo Guardrails wraps the Gemma call.
  try {
    const res = await fetch(`${NEXUS_BACKEND_URL}/api/helix/guardrails/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(300000),
    });
    if (res.ok) {
      const data = await res.json();
      const text: string = data.content || '';
      return {
        text,
        agent: data.blocked ? `Helix Guardrails (${data.rail || 'policy'})` : `Gemma 4 12B · Helix guarded`,
        usage: estimateUsage(prompt, text),
        latency_ms: Date.now() - startTime,
        guardrails: { blocked: !!data.blocked, rail: data.rail ?? null, guarded: true },
      };
    }
    console.warn('Helix guardrails returned', res.status);
  } catch (err) {
    console.warn('Helix guardrails unreachable, using Gemma directly:', err);
  }

  // 2. Fallback: direct Gemma call, clearly marked unguarded.
  const text = await ollamaChat(messages);
  if (text) {
    return {
      text,
      agent: `Gemma 4 12B (unguarded: Helix offline)`,
      usage: estimateUsage(prompt, text),
      latency_ms: Date.now() - startTime,
      guardrails: { blocked: false, guarded: false },
    };
  }

  const errText = `Gemma 4 12B is not reachable. Make sure Ollama is running on ${OLLAMA_URL} and run \`ollama run ${GEMMA_MODEL}\`.`;
  return {
    text: errText,
    agent: `Gemma 4 12B (offline)`,
    usage: estimateUsage(prompt, errText),
    latency_ms: Date.now() - startTime,
  };
}

export interface ContextResolutionResult {
  intent: string;
  execution_mode: string;
  state: 'CLARIFICATION_REQUIRED' | 'RESOLVED';
  missing_context?: string | null;
  resolved_topic?: string | null;
  message?: string;
}

export async function resolveResearchContext(
  prompt: string,
  chatHistoryText?: string
): Promise<ContextResolutionResult> {

  const systemPrompt = `You are a strict Context Resolution Engine for an AI research system.
Your job is to determine if the user's research request contains demonstrative references (like "this", "that", "it", "these") that CANNOT be resolved from the preceding conversation history.

If the subject is missing or unresolvable, return a JSON object requesting clarification:
{
  "intent": "RESEARCH",
  "execution_mode": "MISSION",
  "state": "CLARIFICATION_REQUIRED",
  "missing_context": "research_subject",
  "message": "I can start the research, but I need to know what 'this' refers to."
}

If the subject is clearly stated in the prompt, or can be unambiguously resolved from the conversation history, return:
{
  "intent": "RESEARCH",
  "execution_mode": "MISSION",
  "state": "RESOLVED",
  "resolved_topic": "<the concrete topic to research>"
}

Do NOT guess. Do NOT hallucinate a topic. Return ONLY valid JSON.`;

  const userContent = `User Prompt: ${prompt}\n\nPreceding Conversation Context:\n${chatHistoryText || 'No prior context.'}`;

  const jsonText = await ollamaChat(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
    { json: true, temperature: 0.1 }
  );
  if (jsonText) {
    try { return JSON.parse(jsonText); } catch (e) { console.error('Gemma context resolution JSON error:', e); }
  }

  // Fallback heuristic if no API or API failed
  const lowerPrompt = prompt.toLowerCase();
  const hasDemonstrative = /\\b(this|that|it|these|those)\\b/.test(lowerPrompt);
  const isShort = prompt.length < 50;
  const noContext = !chatHistoryText || chatHistoryText.trim().length === 0;
  
  if (hasDemonstrative && isShort && noContext) {
    return {
      intent: 'RESEARCH',
      execution_mode: 'MISSION',
      state: 'CLARIFICATION_REQUIRED',
      missing_context: 'research_subject',
      message: 'Sure — what topic would you like me to research?',
    };
  }

  return {
    intent: 'RESEARCH',
    execution_mode: 'MISSION',
    state: 'RESOLVED',
    resolved_topic: prompt,
  };
}

export async function synthesizeResearchBrief(
  prompt: string,
  chatHistoryText?: string
): Promise<string> {

  const systemPrompt = `You are the Lead AI Research Architect for EthicalAI.
Your task is to take a user's research request and the preceding chat conversation, and synthesize a highly professional, structured Executive Research Brief & Mission Specification for autonomous agentic execution.

IMPORTANT: You are in the PLANNING stage. Do NOT invent or claim "Initial Findings", "Evidence", or "Conclusions". You are writing a RESEARCH PLAN, not the results.

Structure the output as follows:
# EXECUTIVE RESEARCH BRIEF & MISSION SPECIFICATION

## 1. PROJECT OBJECTIVE
[Concise executive summary of what the research aims to achieve]

## 2. RESEARCH SCOPE & CONTEXT
[Synthesized context from conversation history and defined scope for the research]

## 3. CORE RESEARCH QUESTIONS & HYPOTHESES
- Key Research Question 1
- Key Research Question 2
- Key Research Question 3

## 4. AGENT EXECUTION SCOPE & DELIVERABLES
- **Research Agent**: Multi-source web & academic intelligence gathering
- **Analysis Agent**: Comparative synthesis, benchmarking, and quantitative evaluation
- **Code & Data Agent**: Verification, data modeling, and structured artifact generation

Keep the tone professional, authoritative, and clear.`;

  const userContent = `User Prompt: ${prompt}\n\nPreceding Conversation Context:\n${chatHistoryText || 'No prior context.'}`;

  const brief = await ollamaChat(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
    { temperature: 0.5 }
  );
  if (brief) return brief;

  return `# EXECUTIVE RESEARCH BRIEF & MISSION SPECIFICATION

## 1. PROJECT OBJECTIVE
Conduct an in-depth, multi-source investigation and comparative analysis for: "${prompt}".

## 2. RESEARCH SCOPE & CONTEXT
Initiated from NEXUS Chat Mode. Preliminary analysis indicates a comprehensive research scope requiring agentic orchestration across web intelligence, data processing, and analytical modeling.

## 3. CORE RESEARCH QUESTIONS
- What are the core architectural mechanisms, technical trade-offs, and performance benchmarks?
- What are the strategic industry implications, cost profiles, and scalability constraints?
- What actionable recommendations and synthesized insights can be extracted?

## 4. AGENT EXECUTION SCOPE & DELIVERABLES
- **Research Agent**: Deep web scraping, academic papers, and technical specification extraction
- **Analysis Agent**: Synthesized comparison tables, trend analysis, and strategic risk assessment
- **Code & Data Agent**: Verification scripts, structured JSON/Markdown reports, and data visualization`;
}
