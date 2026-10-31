'use server';

/**
 * Helix guardrails bridge: talks to the NeMo Guardrails service in
 * nexus-backend (/api/helix/guardrails). Every function returns null when the
 * backend is unreachable so the UI can show an offline state.
 */

const NEXUS_BACKEND_URL = process.env.NEXUS_BACKEND_URL || 'http://localhost:8001';
const BASE = `${NEXUS_BACKEND_URL}/api/helix/guardrails`;

export interface GuardrailsStats {
  checks: number;
  blocked: number;
  allowed: number;
  avg_latency_ms: number | null;
}

export interface GuardrailsStatus {
  engine: string;
  model: string;
  loaded: boolean;
  error: string | null;
  input_rails: string[];
  output_rails: string[];
  stats: GuardrailsStats;
}

export interface GuardrailEvent {
  id: number;
  timestamp: string;
  kind: 'check' | 'chat' | 'mission';
  excerpt: string;
  blocked: boolean;
  rail: string | null;
  latency_ms: number;
}

export interface GuardrailVerdict {
  allowed: boolean;
  rail: string | null;
  message: string | null;
  latency_ms: number;
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 5000): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function getGuardrailsStatus(): Promise<GuardrailsStatus | null> {
  return request<GuardrailsStatus>('/status');
}

export async function getGuardrailEvents(limit = 20): Promise<GuardrailEvent[] | null> {
  const data = await request<{ events: GuardrailEvent[] }>(`/events?limit=${limit}`);
  return data?.events ?? null;
}

/** Runs the input rail on `text`. The first call loads the model, so allow time. */
export async function checkPrompt(text: string): Promise<GuardrailVerdict | null> {
  return request<GuardrailVerdict>(
    '/check',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    },
    180_000,
  );
}
