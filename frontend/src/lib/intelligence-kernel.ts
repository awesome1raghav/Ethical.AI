/**
 * @fileOverview Deterministic Intelligence Kernel for NEXUS OS.
 * Translates backend logic into high-performance TypeScript evaluators for Risk and Clarity.
 */

export interface RiskEvaluation {
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  reason: string;
}

export interface ClarityEvaluation {
  score: number;
  rating: string;
}

/**
 * Calculates Shannon Entropy to detect structural randomness (gibberish).
 */
function calculateShannonEntropy(text: string): number {
  if (!text) return 0;
  const length = text.length;
  const frequencies: Record<string, number> = {};
  for (const char of text) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in frequencies) {
    const p = frequencies[char] / length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Deterministic Risk Evaluation Pipeline.
 */
export function evaluateRiskLevel(promptText: string): RiskEvaluation {
  const cleanText = promptText.trim();
  const textLower = cleanText.toLowerCase();
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

  if (wordCount === 0) {
    return { level: 'Low', reason: 'Empty prompt, no operational risk.' };
  }

  // ---- LAYER 1: CRITICAL RISKS (FINANCIAL & SYSTEM BYPASS) ----
  const financialPatterns = [
    /refund/i,
    /transfer\s+fund/i,
    /bank\s+account/i,
    /wire\s+transfer/i,
    /payout/i,
    /withdraw/i,
    /send\s+money/i,
    /payment/i,
    /invoice/i,
    /credit\s+card/i,
  ];

  for (const pattern of financialPatterns) {
    if (pattern.test(textLower)) {
      return {
        level: 'Critical',
        reason: 'Financial flag tripped: Mission requests automated financial transactions, fund transfers, or bank account operations.',
      };
    }
  }

  const systemBypassPatterns = [
    /ignore\s+(?:all\s+)?previous/i,
    /system\s+override/i,
    /act\s+as\s+[\w\s]+admin/i,
    /bypass\s+guardrails/i,
    /reverse\s+engineer/i,
    /exploit/i,
    /sql\s*injection/i,
    /malware/i,
    /phishing/i,
  ];

  for (const pattern of systemBypassPatterns) {
    if (pattern.test(textLower)) {
      return {
        level: 'Critical',
        reason: 'Security flag tripped: Detected unsafe system override pattern or potential jailbreak directive.',
      };
    }
  }

  // ---- LAYER 2: HIGH RISKS (DATA ACCESSIBILITY & MODIFICATION) ----
  const highRiskDataPatterns = [
    /delete\s+(?:data|user|db|database|table|record)/i,
    /wipe\s+(?:data|db|database|system)/i,
    /drop\s+table/i,
    /credential|password|secret|api\s+key|private\s+key|passport|ssn/i,
  ];

  for (const pattern of highRiskDataPatterns) {
    if (pattern.test(textLower)) {
      return {
        level: 'High',
        reason: 'Data Integrity flag tripped: Request seeks modification/destruction of persistent storage or access to credentials.',
      };
    }
  }

  // ---- LAYER 3: ENTROPY & GIBBERISH ANALYSIS (MEDIUM RISK) ----
  const entropy = calculateShannonEntropy(cleanText);

  if (wordCount === 1 && cleanText.length > 5) {
    const hasVowels = /[aeiouy]/i.test(textLower);
    if (entropy > 2.8 || !hasVowels) {
      return {
        level: 'Medium',
        reason: `Input anomaly: Unstructured single-token data string detected (Entropy: ${entropy.toFixed(2)}). Evaluated as potential system fuzzing or spam.`,
      };
    }
  }

  // ---- LAYER 4: CONTEXTUAL RISK BOUNDS (LOW RISK) ----
  const safeOperationalAnchors = ['analyze', 'research', 'build', 'create', 'generate', 'explain', 'audit'];
  const hasSafeAnchor = safeOperationalAnchors.some(anchor => textLower.includes(anchor));

  if (hasSafeAnchor && wordCount >= 3) {
    return {
      level: 'Low',
      reason: 'Prompt conforms to structured operational standard with clean natural language directives.',
    };
  }

  return {
    level: 'Low',
    reason: 'Standard validation passed. Intent cleared for general processing execution.',
  };
}

/**
 * Deterministic Clarity Evaluation Pipeline.
 */
export function calculateClarityScore(promptText: string): ClarityEvaluation {
  const cleanText = promptText.trim();
  const textLower = cleanText.toLowerCase();
  const words = cleanText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount === 0) {
    return { score: 0, rating: 'Unstructured Noise' };
  }

  let score = 0;

  // 1. LEXICAL WEIGHT (Max 40 points)
  score += Math.min(wordCount * 4, 40);

  // 2. ACTION ANCHORS (Max 30 points)
  const actionVerbs = [
    'analyze', 'research', 'compile', 'synthesize', 'audit', 'evaluate',
    'build', 'generate', 'create', 'extract', 'summarize', 'optimize'
  ];
  const foundVerbs = actionVerbs.filter(verb => textLower.includes(verb));
  score += Math.min(foundVerbs.length * 15, 30);

  // 3. PARAMETER DENSITY (Max 30 points)
  const hasTimeframe = /(?:q[1-4]|\d{4}|month|year|week|trend|daily|logs)/i.test(textLower);
  const hasTarget = /(?:market|competit|security|financial|data|strategy|ai)/i.test(textLower);
  if (hasTimeframe) score += 15;
  if (hasTarget) score += 15;

  // 4. SYNTACTIC NOISE PENALTY
  if (wordCount === 1 && cleanText.length > 4) {
    const hasVowels = /[aeiouy]/i.test(textLower);
    if (!hasVowels || /^[a-z0-9]+$/i.test(cleanText)) {
      score = Math.max(score - 85, 5);
    }
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  let rating = 'Unstructured Noise';
  if (finalScore >= 85) rating = 'Excellent';
  else if (finalScore >= 60) rating = 'Good / Actionable';
  else if (finalScore >= 30) rating = 'Vague / Needs Detail';

  return { score: finalScore, rating };
}
