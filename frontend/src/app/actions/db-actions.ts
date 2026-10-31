'use server';

import { db } from '@/lib/db';

/** Context window of Gemma 4 12B, the only model in use. */
const GEMMA_CONTEXT_TOKENS = 32768;

/**
 * Signals produced by the Intelligence Panel. Optional so the three existing
 * 7-argument callers keep working while they are migrated.
 */
export interface MissionIntelligence {
  confidence?: number;      // 0-100
  complexity?: string;      // Low | Moderate | High
  riskReason?: string;
  decisionId?: string;      // set once POST /api/decision lands
}

export interface MissionRecord {
  id: string;
  description: string;
  primary_intent: string;
  risk_level: string;
  clarity_score: number;
  status: string;
  created_at: string;
  confidence?: number;
  complexity?: string;
  risk_reason?: string;
  decision_id?: string;
  step_count?: number;
  completed_steps?: number;
  stored_tokens?: number;
  remaining_tokens?: number;
  max_context_tokens?: number;
  used_percentage?: number;
}

export async function saveMission(
  id: string,
  description: string,
  primaryIntent: string,
  riskLevel: string,
  clarityScore: number,
  steps: { name: string; assigned_agent_id: string; is_legal: boolean; legality_reason: string }[],
  agents: { id: string; enabled: boolean }[],
  intelligence: MissionIntelligence = {}
) {
  // Insert mission
  const insertMission = db.prepare(`
    INSERT INTO missions (
      id, description, primary_intent, risk_level, clarity_score, status, created_at,
      confidence, complexity, risk_reason, decision_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMission.run(
    id,
    description,
    primaryIntent,
    riskLevel,
    clarityScore,
    'running',
    new Date().toISOString(),
    intelligence.confidence ?? null,
    intelligence.complexity ?? null,
    intelligence.riskReason ?? null,
    intelligence.decisionId ?? null
  );

  // Insert steps
  const insertStep = db.prepare(`
    INSERT INTO steps (id, mission_id, step_index, name, is_legal, legality_reason, assigned_agent_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  steps.forEach((step, index) => {
    insertStep.run(
      `${id}-step-${index}`,
      id,
      index,
      step.name || '',
      step.is_legal ? 1 : 0,
      step.legality_reason || '',
      step.assigned_agent_id || 'research_agent',
      'pending'
    );
  });

  // Update agents settings (enabled/disabled and reset status to idle)
  if (agents && agents.length > 0) {
    const updateAgent = db.prepare(`
      UPDATE agents_registry
      SET enabled = ?, status = 'idle'
      WHERE id = ?
    `);
    agents.forEach((agent) => {
      updateAgent.run(agent.enabled ? 1 : 0, agent.id);
    });
  }
}


export async function getLatestMission(missionId?: string | null) {
  let targetMission: any = null;

  if (missionId) {
    targetMission = db.prepare(`
      SELECT * FROM missions WHERE id = ?
    `).get(missionId) as any;
  }

  if (!targetMission) {
    // Two different pieces of frontend code write client-fabricated ids into
    // this same table -- Chat Mode's `M-CHAT-<n>` (saveChatTurn) and the
    // legacy /intake page's `M-<n>` (its own local mission generator, never
    // sent to the backend). Both looked newer than a real mission at various
    // points and got picked as "the latest mission," so the execution/output
    // pages asked the backend for a mission_id it had never seen, got a 404,
    // and were left stuck or empty with no visible error. Excluding fake-id
    // patterns one at a time only ever catches the ones already discovered --
    // positively matching the backend's own id format (mission_<8 hex chars>,
    // see nexus-backend/app/utils/ids.py:generate_mission_id) is the only
    // selection that can't be fooled by the next fake scheme either page adds.
    targetMission = db.prepare(`
      SELECT * FROM missions WHERE id LIKE 'mission_%' AND length(id) = 16 ORDER BY created_at DESC LIMIT 1
    `).get() as any;
  }

  if (!targetMission) return null;

  const steps = db.prepare(`
    SELECT * FROM steps WHERE mission_id = ? ORDER BY step_index ASC
  `).all(targetMission.id) as any[];

  const agents = db.prepare(`
    SELECT * FROM agents_registry
  `).all() as any[];

  return JSON.parse(JSON.stringify({
    mission: targetMission,
    steps: steps.map((s: any) => ({
      ...s,
      is_legal: s.is_legal === 1
    })),
    agents
  }));
}

export async function getMissionsHistory(): Promise<any[]> {
  const data = db.prepare(`
    SELECT 
      m.*,
      COUNT(DISTINCT s.id) as step_count,
      SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) as completed_steps,
      SUM(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END) as failed_steps,
      SUM(CASE WHEN s.status = 'running' THEN 1 ELSE 0 END) as running_steps,
      COALESCE(SUM(LENGTH(ch.message)), 0) as total_chars,
      COUNT(DISTINCT ch.id) as chat_turn_count
    FROM missions m
    LEFT JOIN steps s ON m.id = s.mission_id
    LEFT JOIN chat_history ch ON m.id = ch.mission_id
    GROUP BY m.id
    ORDER BY m.created_at DESC
  `).all() as any[];

  const updatedData = data.map((m: any) => {
    let computedStatus = m.status;
    if (m.failed_steps > 0) {
      computedStatus = 'failed';
    } else if (m.step_count > 0 && m.completed_steps === m.step_count) {
      computedStatus = 'completed';
    } else if (m.running_steps > 0) {
      computedStatus = 'running';
    }

    // Context window of the stored model limit, else Gemma 4 12B's.
    const maxContextTokens = m.clarity_score && m.clarity_score > 1000 ? m.clarity_score : GEMMA_CONTEXT_TOKENS;

    const storedTokens = Math.max(m.chat_turn_count * 15, Math.round((m.total_chars || 0) / 3.8));
    const remainingTokens = Math.max(0, maxContextTokens - storedTokens);
    const usedPercentage = Number(((storedTokens / maxContextTokens) * 100).toFixed(2));

    return {
      ...m,
      status: computedStatus,
      stored_tokens: storedTokens,
      remaining_tokens: remainingTokens,
      max_context_tokens: maxContextTokens,
      used_percentage: usedPercentage
    };
  });

  return JSON.parse(JSON.stringify(updatedData));
}

export async function getMissionById(missionId: string) {
  const targetMission = db.prepare(`
    SELECT * FROM missions WHERE id = ?
  `).get(missionId) as any;
  
  if (!targetMission) return null;
  
  const maxContextTokens =
    targetMission.clarity_score && targetMission.clarity_score > 1000
      ? targetMission.clarity_score
      : GEMMA_CONTEXT_TOKENS;

  const stats = db.prepare(`
    SELECT 
      COALESCE(SUM(LENGTH(message)), 0) as total_chars,
      COUNT(*) as chat_turn_count
    FROM chat_history 
    WHERE mission_id = ?
  `).get(missionId) as any;

  const storedTokens = Math.max(stats.chat_turn_count * 15, Math.round((stats.total_chars || 0) / 3.8));
  const remainingTokens = Math.max(0, maxContextTokens - storedTokens);
  const usedPercentage = Number(((storedTokens / maxContextTokens) * 100).toFixed(2));

  const firstUserMsg = db.prepare(`SELECT message FROM chat_history WHERE mission_id = ? AND sender = 'user' ORDER BY created_at ASC LIMIT 1`).get(missionId) as any;

  return JSON.parse(JSON.stringify({
    ...targetMission,
    first_user_message: firstUserMsg?.message || null,
    stored_tokens: storedTokens,
    remaining_tokens: remainingTokens,
    max_context_tokens: maxContextTokens,
    used_percentage: usedPercentage
  }));
}

export async function updateMissionStatusAction(missionId: string, status: string) {
  db.prepare(`
    UPDATE missions SET status = ? WHERE id = ?
  `).run(status, missionId);
}

export async function deleteMission(missionId: string) {
  db.prepare(`DELETE FROM steps WHERE mission_id = ?`).run(missionId);
  db.prepare(`DELETE FROM chat_history WHERE mission_id = ?`).run(missionId);
  db.prepare(`DELETE FROM missions WHERE id = ?`).run(missionId);

}

export async function clearAllMissions() {
  db.prepare(`DELETE FROM steps`).run();
  db.prepare(`DELETE FROM chat_history WHERE mission_id != 'global-chat'`).run();
  db.prepare(`DELETE FROM missions WHERE id != 'global-chat'`).run();

}

export async function updateStepStatusAction(stepId: string, status: string) {
  db.prepare(`
    UPDATE steps SET status = ? WHERE id = ?
  `).run(status, stepId);
}

export async function updateAgentStatusAction(agentId: string, status: string) {
  db.prepare(`
    UPDATE agents_registry SET status = ? WHERE id = ?
  `).run(status, agentId);
}

function ensureMissionExists(missionId: string, initialPrompt?: string, modelName?: string, maxContext?: number) {
  try {
    const existing = db.prepare(`SELECT id, description FROM missions WHERE id = ?`).get(missionId) as any;
    const modelTag = modelName ? `CHAT (${modelName})` : 'CHAT CONVERSATION';
    const contextLimit = maxContext || 128000;
    const desc = initialPrompt ? `Chat [${modelName || 'LLM'}]: ${initialPrompt.slice(0, 60)}` : `Chat Mission (${missionId})`;
    const now = new Date().toISOString();

    if (!existing) {
      db.prepare(`
        INSERT INTO missions (id, description, primary_intent, risk_level, clarity_score, status, created_at)
        VALUES (?, ?, ?, 'Low', ?, 'completed', ?)
      `).run(missionId, desc, modelTag, contextLimit, now);

    } else if (initialPrompt && (existing.description.startsWith('Chat Mission (') || existing.description === 'Global Chat Session')) {
      db.prepare(`UPDATE missions SET description = ?, primary_intent = ?, clarity_score = ? WHERE id = ?`).run(desc, modelTag, contextLimit, missionId);
    }
  } catch (err) {
    console.error("ensureMissionExists warning:", err);
  }
}

export async function insertChatMessage(
  missionId: string,
  sender: string,
  agentName: string | null,
  message: string
) {
  ensureMissionExists(missionId, message);
  const id = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  db.prepare(`
    INSERT INTO chat_history (id, mission_id, sender, agent_name, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, missionId, sender, agentName, message, new Date().toISOString());
}

export async function saveChatTurn(
  missionId: string,
  userMessage: string,
  aiResponse: string,
  agentName: string = 'NEXUS Copilot',
  modelName?: string,
  maxContext?: number
) {
  ensureMissionExists(missionId, userMessage, modelName, maxContext);
  const now = new Date().toISOString();
  
  // Save user message
  const userId = `chat-user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  db.prepare(`
    INSERT INTO chat_history (id, mission_id, sender, agent_name, message, created_at)
    VALUES (?, ?, 'user', NULL, ?, ?)
  `).run(userId, missionId, userMessage, now);

  // Save AI response
  const aiId = `chat-ai-${Date.now() + 1}-${Math.random().toString(36).substr(2, 5)}`;
  db.prepare(`
    INSERT INTO chat_history (id, mission_id, sender, agent_name, message, created_at)
    VALUES (?, ?, 'assistant', ?, ?, ?)
  `).run(aiId, missionId, agentName, aiResponse, new Date().toISOString());
}

export async function getChatHistory(missionId: string) {
  ensureMissionExists(missionId);
  const data = db.prepare(`
    SELECT * FROM chat_history WHERE mission_id = ? ORDER BY created_at ASC
  `).all(missionId) as any[];
  return JSON.parse(JSON.stringify(data));
}

export async function clearChatHistory(missionId: string) {
  ensureMissionExists(missionId);
  db.prepare(`DELETE FROM chat_history WHERE mission_id = ?`).run(missionId);
}
