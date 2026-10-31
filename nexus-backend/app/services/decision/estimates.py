"""
Duration and cost estimates for the Intelligence Panel.

These replace the frontend's previous heuristics, which derived both from word
count -- a longer prompt implied a longer, costlier mission regardless of what
it asked for. Both now derive from the complexity signal, so they move with the
work rather than the typing.

Cost stays coarse and the arithmetic is deliberately visible: tokens are
estimated from the plan size, then priced at a single documented rate. It is an
estimate, not a quote, and TOKENS_PER_STEP / USD_PER_1K are the two numbers to
correct when real usage data exists.
"""

from .models import ComplexityBand, DecisionRecord

# Wall-clock ranges per band, in minutes.
DURATION_BY_BAND = {
    ComplexityBand.TRIVIAL: (0, 1),
    ComplexityBand.SIMPLE: (1, 2),
    ComplexityBand.MODERATE: (2, 5),
    ComplexityBand.COMPLEX: (5, 12),
    ComplexityBand.MULTI_PHASE: (12, 30),
}

TOKENS_PER_STEP = 1200      # prompt + completion for one plan step
USD_PER_1K = 0.0006         # blended rate; correct once real usage is tracked


def estimate_duration(record: DecisionRecord) -> str:
    low, high = DURATION_BY_BAND.get(record.complexity_band, (1, 3))
    if high <= 1:
        return "<1 min"
    if low == 0:
        return f"<{high} min"
    return f"{low}-{high} min"


def estimate_cost(record: DecisionRecord) -> str:
    # A chat turn is one exchange; a mission pays per planned step.
    steps = record.estimated_steps if record.requires_planning else 1
    usd = (steps * TOKENS_PER_STEP / 1000.0) * USD_PER_1K
    return f"${usd:.3f}" if usd < 1 else f"${usd:.2f}"
