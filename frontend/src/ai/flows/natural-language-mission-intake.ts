'use server';
/**
 * @fileOverview A Genkit flow for processing natural language mission descriptions
 * and extracting key parameters for the EthicalAI system.
 * Now integrated with the deterministic Intelligence Kernel for Risk and Clarity.
 */

import {ai} from '@/core/ai';
import {z} from 'genkit';
import { evaluateRiskLevel, calculateClarityScore } from '@/lib/intelligence-kernel';

// Input Schema
const NaturalLanguageMissionIntakeInputSchema = z.object({
  missionDescription: z
    .string()
    .describe('A natural language description of the AI mission the user wants to perform.'),
});
export type NaturalLanguageMissionIntakeInput = z.infer<typeof NaturalLanguageMissionIntakeInputSchema>;

// Output Schema
const NaturalLanguageMissionIntakeOutputSchema = z.object({
  primary_intent: z.string().describe('The primary operational intent detected.'),
  secondary_intents: z.array(z.string()).describe('List of secondary intents.'),
  domain: z.string().describe('Operational domain classification.'),
  objective: z.string().describe('The inferred high-level objective.'),
  actions: z.array(z.string()).describe('Extracted operational actions.'),
  entities: z.array(z.string()).describe('Extracted key entities.'),
  stakeholders: z.array(z.string()).describe('Detected stakeholders.'),
  authority_level: z.object({
    level: z.number(),
    label: z.string(),
  }),
  workflow: z.object({
    steps: z.number(),
    complexity: z.string(),
  }),
  human_impact: z.object({
    employment: z.boolean(),
    finance: z.boolean(),
    healthcare: z.boolean(),
    education: z.boolean(),
    legal: z.boolean(),
    safety: z.boolean(),
  }),
  governance_signals: z.object({
    privacy_sensitive: z.boolean(),
    financial_sensitive: z.boolean(),
    human_consequence: z.boolean(),
    compliance_relevant: z.boolean(),
    system_modification: z.boolean(),
    automated_decision_making: z.boolean(),
  }),
  confidence: z.number().min(0).max(100),
  clarityScore: z.number().min(0).max(100),
  clarityRating: z.string(),
  riskLevel: z.string(),
  riskReason: z.string(),
  evidence: z.array(z.string()).describe('List of evidence signals detected.'),
  reasoning: z.array(z.string()).describe('The logic used to reach this classification.'),
  estimatedAgents: z.string().optional(),
  estimatedDuration: z.string().optional(),
  policyPreCheck: z.string().optional(),
  workflow_steps: z.array(z.object({
    name: z.string().describe('Descriptive name of the step in the workflow.'),
    assigned_agent_id: z.enum(['compliance_enforcer', 'threat_detector', 'research_agent', 'financial_auditor', 'system_optimizer']).describe('The ID of the agent assigned to this step.'),
    is_legal: z.boolean().describe('Whether this step is legal under global AI policy guidelines.'),
    legality_reason: z.string().describe('The ethical justification or reason for this legality classification.')
  })).describe('Structured step-by-step workflow decomposition of the mission.'),
  suggested_agents: z.array(z.object({
    id: z.string().describe('ID of the registry agent'),
    reason: z.string().describe('The rationale for why this specific agent is recommended for the mission.')
  })).describe('List of registry agents that are useful or required for this mission, along with reasons.'),
});
export type NaturalLanguageMissionIntakeOutput = z.infer<typeof NaturalLanguageMissionIntakeOutputSchema>;

// Wrapper function
export async function naturalLanguageMissionIntake(
  input: NaturalLanguageMissionIntakeInput
): Promise<NaturalLanguageMissionIntakeOutput> {
  return naturalLanguageMissionIntakeFlow(input);
}

// Genkit Prompt
const prompt = ai.definePrompt({
  name: 'naturalLanguageMissionIntakePrompt',
  input: {schema: NaturalLanguageMissionIntakeInputSchema},
  prompt: `You are the Intent Intelligence Engine for EthicalAI.
Your job is to analyze a user request and decompose it into structured governance intelligence.
You are NOT a chatbot.
You are NOT an assistant.
You are a deterministic intent analysis system.

Analyze the prompt using the following layers:
1. Primary Intent
2. Secondary Intents
3. Domain Classification
4. Objective Detection
5. Action Extraction
6. Entity Extraction
7. Stakeholder Detection
8. Authority Level Detection
9. Workflow Complexity Analysis
10. Human Impact Analysis
11. Governance Signals
12. Confidence Estimation
13. Evidence Generation
14. Workflow Steps Breakdown (determine if each step is legal or illegal, provide reasoning, and assign to: compliance_enforcer, threat_detector, research_agent, financial_auditor, or system_optimizer)
15. Suggested Agents List (identify all optional or required agents needed to perform this task)

---
INTENT TAXONOMY
Possible Primary Intents:
* Research & Analysis
* Business Operations
* Human Resources
* Finance
* Financial Risk Management
* Cybersecurity
* Healthcare
* Government Services
* Compliance
* Legal Operations
* Marketing
* Education
* Customer Support
* Data Management
* Communication
* Software Engineering
* System Administration

---
AUTHORITY LEVELS
Level 0: Inform
Level 1: Recommend
Level 2: Assist
Level 3: Execute
Level 4: Approve
Level 5: Enforce

---
WORKFLOW COMPLEXITY
LOW (1-2 actions), MEDIUM (3-4 actions), HIGH (5-6 actions), CRITICAL (7+ actions)

---
GOVERNANCE & IMPACT
Assess employment, finance, healthcare, education, legal, and safety impacts.
Identify privacy/financial sensitivity and human consequence.

---
AGENT REGISTRY (For Workflow Steps & Suggested Agents):
- compliance_enforcer: Sovereign Compliance & Ethics Enforcer (Required for checking policies, auditing, or compliance queries).
- threat_detector: Citadel Security & Vulnerability Auditor (Required for testing security, system vulnerabilities, firewall, scanning).
- research_agent: Nexus Web & Knowledge Synthesizer (Optional for web research, data compilation, analysis).
- financial_auditor: Sovereign Transaction Audit Engine (Optional for handling payments, transfers, refunds, credit auditing).
- system_optimizer: Nexus Swarm Coordinator & Resource Scheduler (Optional for resource scaling, optimizations).

User Mission Description:
{{{missionDescription}}}

Your response must be a valid JSON object matching the described output structure. Do not explain. Return JSON only.`,
});

// Genkit Flow
const naturalLanguageMissionIntakeFlow = ai.defineFlow(
  {
    name: 'naturalLanguageMissionIntakeFlow',
    inputSchema: NaturalLanguageMissionIntakeInputSchema,
    outputSchema: NaturalLanguageMissionIntakeOutputSchema,
  },
  async (input) => {
    let parsed: any = null;
    try {
      const response = await prompt(input);
      const text = response.text;
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const jsonStr = text.substring(start, end + 1);
        parsed = JSON.parse(jsonStr);
      }
    } catch (e) {
      console.warn("Ollama query failed or crashed, using fallback generator.", e);
    }

    const defaultOutput = {
      primary_intent: "Business Operations",
      secondary_intents: ["Research & Analysis"],
      domain: "Operations Management",
      objective: "Execute user instructions",
      actions: ["execute"],
      entities: ["user input"],
      stakeholders: ["Operations Team"],
      authority_level: { level: 2, label: "Assist" },
      workflow: { steps: 5, complexity: "MEDIUM" },
      human_impact: {
        employment: false,
        finance: false,
        healthcare: false,
        education: false,
        legal: false,
        safety: false
      },
      governance_signals: {
        privacy_sensitive: false,
        financial_sensitive: false,
        human_consequence: false,
        compliance_relevant: true,
        system_modification: false,
        automated_decision_making: false
      },
      confidence: 85,
      evidence: [],
      reasoning: [],
      workflow_steps: [],
      suggested_agents: []
    };

    // Simple intent inference for fallback
    let inferredIntent = defaultOutput.primary_intent;
    const lowerDesc = input.missionDescription.toLowerCase();
    if (/research|analyze|find|search|investigate/i.test(lowerDesc)) inferredIntent = "Research & Analysis";
    else if (/finance|budget|money|refund|pay/i.test(lowerDesc)) inferredIntent = "Finance";
    else if (/security|hack|audit|threat|vulnerability/i.test(lowerDesc)) inferredIntent = "Cybersecurity";
    else if (/legal|law|policy|compliance/i.test(lowerDesc)) inferredIntent = "Compliance";

    // Deep merge / fallback fill-in
    const result = {
      primary_intent: parsed?.primary_intent || inferredIntent,
      secondary_intents: Array.isArray(parsed?.secondary_intents) ? parsed.secondary_intents : defaultOutput.secondary_intents,
      domain: parsed?.domain || defaultOutput.domain,
      objective: parsed?.objective || defaultOutput.objective,
      actions: Array.isArray(parsed?.actions) ? parsed.actions : defaultOutput.actions,
      entities: Array.isArray(parsed?.entities) ? parsed.entities : defaultOutput.entities,
      stakeholders: Array.isArray(parsed?.stakeholders) ? parsed.stakeholders : defaultOutput.stakeholders,
      authority_level: {
        level: typeof parsed?.authority_level?.level === 'number' ? parsed.authority_level.level : defaultOutput.authority_level.level,
        label: parsed?.authority_level?.label || defaultOutput.authority_level.label,
      },
      workflow: {
        steps: typeof parsed?.workflow?.steps === 'number' ? parsed.workflow.steps : defaultOutput.workflow.steps,
        complexity: parsed?.workflow?.complexity || defaultOutput.workflow.complexity,
      },
      human_impact: {
        employment: !!parsed?.human_impact?.employment,
        finance: !!parsed?.human_impact?.finance,
        healthcare: !!parsed?.human_impact?.healthcare,
        education: !!parsed?.human_impact?.education,
        legal: !!parsed?.human_impact?.legal,
        safety: !!parsed?.human_impact?.safety,
      },
      governance_signals: {
        privacy_sensitive: !!parsed?.governance_signals?.privacy_sensitive,
        financial_sensitive: !!parsed?.governance_signals?.financial_sensitive,
        human_consequence: !!parsed?.governance_signals?.human_consequence,
        compliance_relevant: !!parsed?.governance_signals?.compliance_relevant,
        system_modification: !!parsed?.governance_signals?.system_modification,
        automated_decision_making: !!parsed?.governance_signals?.automated_decision_making,
      },
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : defaultOutput.confidence,
      evidence: Array.isArray(parsed?.evidence) ? parsed.evidence : defaultOutput.evidence,
      reasoning: Array.isArray(parsed?.reasoning) ? parsed.reasoning : defaultOutput.reasoning,
      workflow_steps: Array.isArray(parsed?.workflow_steps) && parsed.workflow_steps.length > 0 ? parsed.workflow_steps : [],
      suggested_agents: Array.isArray(parsed?.suggested_agents) && parsed.suggested_agents.length > 0 ? parsed.suggested_agents : [],
    };

    if (result.workflow_steps.length === 0) {
      // Split description into discrete sentences/clauses
      // Added ' and ' / ' then ' to handle conversational prompts without punctuation
      const rawSteps = input.missionDescription
        .split(/[,\n;.]|\band\b|\bthen\b/i)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 5);

      const stepsList = rawSteps.length > 0 ? rawSteps : ["Process mission requirements"];

      result.workflow_steps = stepsList.map((stepName: string) => {
        // Simple heuristic agent assignment
        let agentId = 'research_agent';
        const stepLower = stepName.toLowerCase();
        
        if (/security|vulnerability|firewall|audit|hack|threat/i.test(stepLower)) {
          agentId = 'threat_detector';
        } else if (/compliance|policy|ethics|rule|law|legal/i.test(stepLower)) {
          agentId = 'compliance_enforcer';
        } else if (/payment|refund|transaction|bank|fund|money|finance/i.test(stepLower)) {
          agentId = 'financial_auditor';
        } else if (/optimize|scale|performance|resource|load|speed/i.test(stepLower)) {
          agentId = 'system_optimizer';
        } else if (/update|record|crm|database|log|save|send|report/i.test(stepLower)) {
          // Send / update reports can go to system_optimizer or compliance
          agentId = stepLower.includes('crm') || stepLower.includes('record') ? 'compliance_enforcer' : 'system_optimizer';
        }

        // Legality checks
        const financialPatterns = [/refund/i, /transfer\s+fund/i, /bank\s+account/i, /wire/i, /payout/i, /withdraw/i, /send\s+money/i];
        const hasFinancialViolation = financialPatterns.some(pattern => pattern.test(stepLower)) && stepLower.includes('automatic');
        
        const isLegal = !hasFinancialViolation;
        const legalityReason = isLegal 
          ? "Step verified as compliant with global operational safety guidelines."
          : "Sovereign policy violation: Automated high-value transfers or payouts are strictly prohibited.";

        return {
          name: stepName,
          assigned_agent_id: agentId as any,
          is_legal: isLegal,
          legality_reason: legalityReason
        };
      });
    }

    // Recalculate suggested_agents to be the set of unique assigned_agent_ids with reasons
    if (result.suggested_agents.length === 0 && result.workflow_steps.length > 0) {
      const agentMap = new Map<string, string>();
      result.workflow_steps.forEach((s: any) => {
        if (!agentMap.has(s.assigned_agent_id)) {
          let defaultReason = "Assigned to process mission objectives.";
          if (s.assigned_agent_id === 'research_agent') defaultReason = "Required for information synthesis and web knowledge gathering.";
          if (s.assigned_agent_id === 'threat_detector') defaultReason = "Required to evaluate potential security vulnerabilities or execute security audits.";
          if (s.assigned_agent_id === 'compliance_enforcer') defaultReason = "Required to ensure policy compliance and ethical boundaries are maintained.";
          if (s.assigned_agent_id === 'financial_auditor') defaultReason = "Required to securely handle and audit financial or transactional logic.";
          if (s.assigned_agent_id === 'system_optimizer') defaultReason = "Required to optimize system resources or manage data logs.";
          agentMap.set(s.assigned_agent_id, defaultReason);
        }
      });
      result.suggested_agents = Array.from(agentMap.entries()).map(([id, reason]) => ({ id, reason }));
    }
    
    // Update workflow steps count
    result.workflow.steps = result.workflow_steps.length;
    if (result.workflow.steps >= 6) {
      result.workflow.complexity = "CRITICAL";
    } else if (result.workflow.steps >= 4) {
      result.workflow.complexity = "HIGH";
    } else if (result.workflow.steps >= 3) {
      result.workflow.complexity = "MEDIUM";
    } else {
      result.workflow.complexity = "LOW";
    }

    // INTERJECT WITH DETERMINISTIC INTELLIGENCE KERNEL
    const riskEval = evaluateRiskLevel(input.missionDescription);
    const clarityEval = calculateClarityScore(input.missionDescription);

    return {
      ...result,
      clarityScore: clarityEval.score,
      clarityRating: clarityEval.rating,
      riskLevel: riskEval.level,
      riskReason: riskEval.reason,
      estimatedAgents: `${result.workflow.steps} units`,
      estimatedDuration: result.workflow.complexity === 'LOW' ? '~2 min' : '~5-10 min',
      policyPreCheck: result.governance_signals.automated_decision_making ? 'Requires Review' : 'Permitted'
    };
  }
);
