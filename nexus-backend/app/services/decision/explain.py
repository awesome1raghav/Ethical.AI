"""
Per-signal explanations for the Intelligence Panel.

The panel shows five numbers and, until now, no account of where any of them
came from. Each string here answers "why does this row read the way it does"
for the row the user tapped.
"""

from typing import Dict, List

from .estimates import TOKENS_PER_STEP, USD_PER_1K


def build_explanations(record, agents: List[str]) -> Dict[str, str]:
    scores = list(record.intent_scores.items())
    top = scores[0] if scores else ("CHAT", 0.0)
    runner = scores[1] if len(scores) > 1 else None

    intent = (f"Scored {top[1]} for {top[0]} from four weighted signals — "
              f"domain 50%, entity 25%, objective 15%, action 10%.")
    if runner:
        intent += f" Next closest was {runner[0]} at {runner[1]}."

    if runner and runner[1] > 0:
        margin = round(top[1] - runner[1], 4)
        confidence = (f"{record.confidence}% ({record.confidence_tier.value}). Derived from the "
                      f"margin of {margin} between {top[0]} and {runner[0]}, not from the "
                      f"winning score alone — two close candidates would read as uncertain.")
    else:
        confidence = (f"{record.confidence}% ({record.confidence_tier.value}). Only one intent "
                      f"drew signal, so the margin is the whole score.")

    active = {k: v for k, v in record.complexity_factors.items() if v > 0}
    if active:
        parts = ", ".join(f"{k.replace('_', ' ')} {v}" for k, v in active.items())
        complexity = (f"{record.complexity_score}/100 → {record.complexity_band.value}. "
                      f"Contributing factors: {parts}.")
    else:
        complexity = (f"{record.complexity_score}/100 → {record.complexity_band.value}. "
                      f"No complexity factors fired — nothing indicates multi-step work.")

    mode = (f"Routed to {record.execution_mode.value} from complexity "
            f"{record.complexity_band.value} at {record.confidence_tier.value} confidence.")
    if record.requires_hitl:
        mode += " Flagged for human approval before execution."

    steps = record.estimated_steps if record.requires_planning else 1
    cost = (f"Estimated from {steps} planned step(s) × ~{TOKENS_PER_STEP} tokens "
            f"at ${USD_PER_1K}/1K. A coarse estimate, not a quote.")

    duration = (f"Derived from the {record.complexity_band.value} complexity band, "
                f"not from prompt length.")

    if agents:
        agent_text = (f"{len(agents)} agent type(s) drawn from the generated plan's steps: "
                      f"{', '.join(agents)}. Assigned by what each step does, not by intent.")
    else:
        agent_text = "No plan steps were derived, so no agents are required."

    return {
        "intent": intent,
        "confidence": confidence,
        "complexity": complexity,
        "mode": mode,
        "duration": duration,
        "cost": cost,
        "agents": agent_text,
    }
