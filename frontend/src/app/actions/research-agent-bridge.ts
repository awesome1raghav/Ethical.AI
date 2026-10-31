'use server';

/**
 * Research Agent Bridge
 * Calls the local Python research agent server (port 8765)
 * when a "research_agent" step appears in NEXUS OS execution pipeline.
 */

const RESEARCH_AGENT_URL = process.env.RESEARCH_AGENT_URL || 'http://localhost:8765';

export interface ResearchResult {
  topic: string;
  summary: string;
  status: 'completed' | 'error' | 'offline';
}

/**
 * Check if the research agent server is running
 */
export async function checkResearchAgentHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${RESEARCH_AGENT_URL}/health`, {
      signal: AbortSignal.timeout(3000), // 3s timeout
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Run the research agent on a given topic.
 * Called automatically when a step with assigned_agent_id === 'research_agent' executes.
 * 
 * @param topic - The research topic from the mission step name
 * @param maxLoops - Number of search + reflection loops (default: 2 for speed)
 */
export async function runResearchAgent(
  topic: string,
  maxLoops: number = 2
): Promise<ResearchResult> {
  // First check if the agent is online
  const isOnline = await checkResearchAgentHealth();
  if (!isOnline) {
    return {
      topic,
      summary: `[Research Agent Offline] The local research agent server is not running. Start it with: python3 server.py inside the research_agent directory.`,
      status: 'offline',
    };
  }

  try {
    const res = await fetch(`${RESEARCH_AGENT_URL}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        max_loops: maxLoops,
        ollama_model: 'gemma4:12b',
        ollama_base_url: 'http://localhost:11434/',
      }),
      signal: AbortSignal.timeout(900_000), // 15 min timeout for deep research
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Research agent HTTP ${res.status}: ${err}`);
    }

    const data = await res.json();
    return {
      topic: data.topic,
      summary: data.summary,
      status: 'completed',
    };
  } catch (err: any) {
    return {
      topic,
      summary: `[Research Agent Error] ${err.message}`,
      status: 'error',
    };
  }
}
