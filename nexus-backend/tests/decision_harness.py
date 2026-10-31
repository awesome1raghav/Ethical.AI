#!/usr/bin/env python3
"""
Decision Engine eval harness.

Scores an engine against tests/fixtures/decision_prompts.json on two axes that
the specification treats as one: which intent was detected, and which execution
mode the request was routed to.

Zero dependencies -- run it directly:

    python3 tests/decision_harness.py                 # failures only
    python3 tests/decision_harness.py --all           # every case
    python3 tests/decision_harness.py --tag ch4.5     # spec's own examples
    python3 tests/decision_harness.py --engine decision

Exit code is 0 when both accuracies meet --threshold (default 90), 1 otherwise,
so this can gate CI once the engine lands.
"""

import argparse
import json
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(HERE)
sys.path.insert(0, BACKEND_ROOT)

from tests.adapters import ADAPTERS  # noqa: E402

FIXTURE = os.path.join(HERE, "fixtures", "decision_prompts.json")

GREEN, RED, DIM, BOLD, RESET = "\033[32m", "\033[31m", "\033[2m", "\033[1m", "\033[0m"


def colour(text, code, enabled):
    return f"{code}{text}{RESET}" if enabled else text


def load_cases(tag=None):
    with open(FIXTURE, encoding="utf-8") as fh:
        cases = json.load(fh)["cases"]
    if tag:
        cases = [c for c in cases if tag in c.get("tags", [])]
    return cases


def run(engine_name, cases, show_all, use_colour):
    engine = ADAPTERS[engine_name]
    rows, errors = [], []

    for case in cases:
        try:
            got = engine(case["prompt"])
        except Exception as exc:  # engine not built yet, or blew up on input
            errors.append((case["prompt"], exc))
            continue

        rows.append({
            "prompt": case["prompt"],
            "want_intent": case["expected_intent"],
            "got_intent": got.intent,
            "intent_ok": got.intent == case["expected_intent"],
            "want_mode": case["expected_mode"],
            "got_mode": got.mode,
            "mode_ok": got.mode == case["expected_mode"],
            "confidence": got.confidence,
            "complexity": got.complexity,
            "tags": case.get("tags", []),
        })

    if errors:
        print(colour(f"\n  engine '{engine_name}' raised on "
                     f"{len(errors)} case(s)", RED, use_colour))
        print(f"  {errors[0][1].__class__.__name__}: {errors[0][1]}")
        if not rows:
            return None

    visible = rows if show_all else [r for r in rows if not (r["intent_ok"] and r["mode_ok"])]

    if visible:
        header = f"  {'prompt':<58} {'intent':<11} {'want':<11} {'mode':<8} {'want':<8}"
        print(f"\n{colour(header, BOLD, use_colour)}")
        print("  " + "-" * 100)
        for r in visible:
            prompt = r["prompt"] if len(r["prompt"]) <= 56 else r["prompt"][:55] + "…"
            i_mark = colour(r["got_intent"], GREEN if r["intent_ok"] else RED, use_colour)
            m_mark = colour(r["got_mode"], GREEN if r["mode_ok"] else RED, use_colour)
            pad_i = " " * max(0, 11 - len(r["got_intent"]))
            pad_m = " " * max(0, 8 - len(r["got_mode"]))
            print(f"  {prompt:<58} {i_mark}{pad_i} {r['want_intent']:<11} "
                  f"{m_mark}{pad_m} {r['want_mode']:<8}")

    total = len(rows)
    intent_hits = sum(r["intent_ok"] for r in rows)
    mode_hits = sum(r["mode_ok"] for r in rows)
    both_hits = sum(r["intent_ok"] and r["mode_ok"] for r in rows)

    intent_pct = 100.0 * intent_hits / total if total else 0.0
    mode_pct = 100.0 * mode_hits / total if total else 0.0
    both_pct = 100.0 * both_hits / total if total else 0.0

    print(f"\n{colour('  RESULTS  engine=' + engine_name, BOLD, use_colour)}")
    print("  " + "-" * 46)
    print(f"  {'intent accuracy':<24} {intent_hits:>3}/{total:<4} {intent_pct:6.1f}%")
    print(f"  {'mode accuracy':<24} {mode_hits:>3}/{total:<4} {mode_pct:6.1f}%")
    print(f"  {'both correct':<24} {both_hits:>3}/{total:<4} {both_pct:6.1f}%")

    # Signal diagnostics -- a constant score is not a score.
    confidences = {r["confidence"] for r in rows if r["confidence"] is not None}
    if not confidences:
        verdict = "not implemented"
    elif len(confidences) == 1:
        verdict = f"CONSTANT at {confidences.pop()} -- carries no information"
    else:
        verdict = f"{len(confidences)} distinct values, range {min(confidences)}-{max(confidences)}"
    print(f"  {'confidence':<24} {verdict}")

    complexities = {r["complexity"] for r in rows if r["complexity"] is not None}
    print(f"  {'complexity':<24} "
          f"{'not implemented' if not complexities else ', '.join(sorted(complexities))}")

    # Where the failures cluster.
    failing_tags = Counter(
        t for r in rows if not (r["intent_ok"] and r["mode_ok"]) for t in r["tags"]
    )
    if failing_tags:
        print(f"\n  {colour('failures by tag', BOLD, use_colour)}")
        for tag, n in failing_tags.most_common():
            total_tag = sum(1 for r in rows if tag in r["tags"])
            print(f"    {tag:<18} {n}/{total_tag}")

    return intent_pct, mode_pct, both_pct


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--engine", default="current", choices=sorted(ADAPTERS))
    ap.add_argument("--all", action="store_true", help="show passing cases too")
    ap.add_argument("--tag", help="only cases carrying this tag")
    ap.add_argument("--threshold", type=float, default=90.0)
    ap.add_argument("--no-colour", action="store_true")
    args = ap.parse_args()

    use_colour = sys.stdout.isatty() and not args.no_colour
    cases = load_cases(args.tag)
    if not cases:
        print(f"no cases matched tag '{args.tag}'")
        return 1

    print(f"\n{colour('  DECISION ENGINE EVAL', BOLD, use_colour)}   "
          f"{len(cases)} case(s)" + (f", tag={args.tag}" if args.tag else ""))

    result = run(args.engine, cases, args.all, use_colour)
    if result is None:
        return 1

    intent_pct, mode_pct, _ = result
    passed = intent_pct >= args.threshold and mode_pct >= args.threshold
    print(f"\n  {'PASS' if passed else 'FAIL'} "
          f"(threshold {args.threshold:.0f}% on intent and mode)\n")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
