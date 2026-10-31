'use server';

/**
 * Nexus Backend Bridge
 * Communicates with the NEXUS OS FastAPI Backend.
 *
 * The backend binds port 8001 (see nexus-backend/main.py). Override with
 * NEXUS_BACKEND_URL if you run it elsewhere.
 */

const NEXUS_BACKEND_URL = process.env.NEXUS_BACKEND_URL || 'http://localhost:8001';

/**
 * Every failure path logs. A silently-null bridge is indistinguishable from a
 * frontend-only design, which is how the 8000/8001 port mismatch stayed hidden.
 */
function reportBridgeFailure(operation: string, detail: unknown): void {
  console.error(
    `[nexus-bridge] ${operation} failed against ${NEXUS_BACKEND_URL} — ` +
    `backend unreachable or returned an error. Detail:`,
    detail
  );
}

export interface NexusBackendHealth {
  online: boolean;
  service?: string;
  message?: string;
}

export interface NexusIntentResponse {
  intent: string;
  confidence: number;
}

export interface NexusDecision {
  decision_id: string;
  intent: string;
  intent_label: string;
  intent_scores: Record<string, number>;
  domain: string;
  entities: string[];
  actions: string[];
  confidence: number;
  confidence_tier: string;
  complexity_score: number;
  complexity_band: string;
  complexity_factors: Record<string, number>;
  estimated_steps: number;
  execution_mode: string;
  mode_source: string;
  requires_planning: boolean;
  requires_hitl: boolean;
  clarifying_question: string | null;
  estimated_duration: string;
  estimated_cost: string;
  classifier_tier: number;
  latency_ms: number;
  reasoning: string[];
  explanations: Record<string, string>;
  estimated_agents: string[];
  agent_breakdown: { agent: string; steps: string; does: string }[];
}

export interface NexusPlanStep {
  step_id: string;
  action: string;
  description: string;
  purpose: string;
  operation: string;
  agent: string;
  depends_on: string[];
  destructive: boolean;
  reversible: boolean;
  requires_human_approval: boolean;
  validation: string | null;
  // Real execution outcome -- "pending" until AgentExecutor actually reaches
  // this step, "running" for exactly as long as it's the one actively being
  // worked on. Never fabricated.
  status: 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_approval';
  output: string | null;
  error: string | null;
}

export interface NexusMissionResponse {
  mission_id: string;
  trace_id: string;
  status: string;
  decision_id?: string | null;
  intent?: string | null;
  confidence?: number | null;
  complexity_band?: string | null;
  execution_mode?: string | null;
  clarifying_question?: string | null;
  status_reason?: string | null;
  plan_id?: string | null;
  execution_strategy?: string | null;
  steps: NexusPlanStep[];
  requires_human_approval: boolean;
  pending_step_id?: string | null;
  running_step_id?: string | null;
  risk_level?: string | null;
  risk_reason?: string | null;
  // True only when CodingAgent actually wrote real files to this mission's
  // workspace/apps/{mission_id}/ directory.
  has_app_files?: boolean;
}

/**
 * Check health status of NEXUS OS backend
 */
export async function checkNexusBackendHealth(): Promise<NexusBackendHealth> {
  try {
    const res = await fetch(`${NEXUS_BACKEND_URL}/`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      reportBridgeFailure('health check', `HTTP ${res.status}`);
      return { online: false };
    }
    const data = await res.json();
    return {
      online: true,
      service: data.service,
      message: data.message,
    };
  } catch (err) {
    reportBridgeFailure('health check', err);
    return { online: false };
  }
}

/**
 * Send prompt to NEXUS OS backend for intent detection
 */
export async function detectNexusIntent(prompt: string): Promise<NexusIntentResponse | null> {
  try {
    const res = await fetch(`${NEXUS_BACKEND_URL}/api/intent/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      reportBridgeFailure('intent detection', `HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    reportBridgeFailure('intent detection', err);
    return null;
  }
}

/**
 * Dispatch a mission to NEXUS OS backend.
 *
 * `decisionId` lets the backend reuse an existing DecisionRecord instead of
 * re-deriving intent from scratch. Optional until POST /api/decision lands.
 */
export async function createNexusMission(
  prompt: string,
  decisionId?: string
): Promise<NexusMissionResponse | null> {
  try {
    const res = await fetch(`${NEXUS_BACKEND_URL}/api/mission/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        decisionId ? { prompt, decision_id: decisionId } : { prompt }
      ),
      cache: 'no-store',
      // Missions with live browsing can run for several minutes.
      signal: AbortSignal.timeout(900000),
    });
    if (!res.ok) {
      reportBridgeFailure('mission creation', `HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    reportBridgeFailure('mission creation', err);
    return null;
  }
}

export interface AgentRecommendation {
  agent: string;
  steps: string[];
  rationale: string;
  confidence: string;
}

export interface AgentAdvice {
  prompt: string;
  plan_id: string;
  steps: number;
  helix: { decision: string; risk: string; reason: string; human_in_loop: boolean };
  matrix: { status: string; threat: string; action: string; warnings: string[] };
  agents: {
    recommendations: AgentRecommendation[];
    gaps: string[];
    summary: string;
    source: string;
  };
}

/**
 * User-initiated agent recommendation. Runs the full chain server-side
 * (decision -> plan -> HELIX -> MATRIX -> agents), then asks the model to
 * review the result. Falls back to the deterministic assignment when the
 * model is unreachable, so the button always returns something.
 */
export async function recommendAgents(prompt: string): Promise<AgentAdvice | null> {
  try {
    const res = await fetch(`${NEXUS_BACKEND_URL}/api/agents/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      cache: 'no-store',
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
      reportBridgeFailure('agent recommendation', `HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    reportBridgeFailure('agent recommendation', err);
    return null;
  }
}

/**
 * Real, current mission state from the backend -- steps, their actual status
 * (pending/completed/failed/awaiting_approval) and actual output/error. This
 * replaces the frontend's own local step simulation: the backend is the only
 * thing that actually ran anything, so it is the only valid source for what
 * happened.
 */
export async function getMissionState(missionId: string): Promise<NexusMissionResponse | null> {
  try {
    const res = await fetch(`${NEXUS_BACKEND_URL}/api/mission/${missionId}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      reportBridgeFailure('mission state fetch', `HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    reportBridgeFailure('mission state fetch', err);
    return null;
  }
}

/**
 * Grant approval for whatever step the mission is currently paused on and
 * resume real execution. The backend re-runs AgentExecutor from exactly where
 * it stopped -- already-completed steps are not re-run, and if a later step
 * also needs approval, this call returns awaiting_approval again rather than
 * silently skipping it.
 */
export async function approveMission(
  missionId: string,
  stepId?: string
): Promise<NexusMissionResponse | null> {
  try {
    const res = await fetch(`${NEXUS_BACKEND_URL}/api/mission/${missionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stepId ? { step_id: stepId } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      reportBridgeFailure('mission approve', `HTTP ${res.status} ${detail}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    reportBridgeFailure('mission approve', err);
    return null;
  }
}

/**
 * Requests cancellation of a running mission. The backend checks the flag
 * between steps, so a step already in progress finishes first.
 * See nexus-backend app/api/mission.py, cancel_mission.
 */
export async function cancelMission(missionId: string): Promise<NexusMissionResponse | null> {
  try {
    const res = await fetch(`${NEXUS_BACKEND_URL}/api/mission/${missionId}/cancel`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      reportBridgeFailure('mission cancel', `HTTP ${res.status} ${detail}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    reportBridgeFailure('mission cancel', err);
    return null;
  }
}

/**
 * Classify a prompt with the backend Decision Engine.
 *
 * This is the engine of record for routing: intent, confidence, complexity and
 * execution mode. Pass the returned decision_id to createNexusMission so the
 * backend reuses this classification rather than deriving a second one.
 */
export async function createDecision(
  prompt: string,
  modeOverride?: string
): Promise<NexusDecision | null> {
  try {
    const res = await fetch(`${NEXUS_BACKEND_URL}/api/decision/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, mode_override: modeOverride ?? null }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      reportBridgeFailure('decision', `HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    reportBridgeFailure('decision', err);
    return null;
  }
}

/**
 * Helper to retrieve WebSocket streaming URL for client components
 */
export async function getNexusWsUrl(missionId: string): Promise<string> {
  const baseUrl = NEXUS_BACKEND_URL.replace(/^http/, 'ws');
  return `${baseUrl}/ws/mission/${missionId}`;
}
