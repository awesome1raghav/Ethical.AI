#!/usr/bin/env python3
"""
Planner evaluation harness.

Measures whether a planner plans the actual mission, and whether governance
receives something worth evaluating. Zero dependencies:

    python3 tests/planner_harness.py                 # summary + per-case table
    python3 tests/planner_harness.py --verbose       # full plans
    python3 tests/planner_harness.py --engine new
"""

import argparse
import json
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from tests.planner_adapters import ADAPTERS  # noqa: E402

FIXTURE = os.path.join(HERE, "fixtures", "planner_prompts.json")


def load_cases():
    with open(FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)["cases"]


def governance(plan_raw, prompt):
    """Run HELIX and MATRIX exactly as execution_runtime does."""
    from app.services.helix.helix_service import HelixService
    from app.services.matrix.matrix_service import MatrixService
    from app.services.agent_registry.agent_factory import AgentFactory

    h = HelixService.evaluate(plan_raw)
    m = MatrixService.evaluate(prompt, plan_raw)
    try:
        agents = [a.agent.value for a in AgentFactory.assign(plan_raw)]
    except Exception as exc:
        agents = [f"<error: {exc.__class__.__name__}>"]

    return {
        "helix_risk": getattr(h.risk, "value", str(h.risk)),
        "helix_decision": getattr(h.decision, "value", str(h.decision)),
        "helix_hitl": h.human_in_loop,
        "matrix_status": getattr(m.security_status, "value", str(m.security_status)),
        "matrix_threat": getattr(m.threat_level, "value", str(m.threat_level)),
        "matrix_action": m.recommended_action,
        "agents": agents,
    }


def run(engine_name, verbose):
    engine = ADAPTERS[engine_name]
    cases = load_cases()
    rows = []

    for case in cases:
        try:
            plan = engine(case["prompt"])
        except NotImplementedError as exc:
            print(f"\n  engine '{engine_name}': {exc}\n")
            return None
        gov = governance(plan.raw, case["prompt"])

        actual = len(plan.steps)
        lo, hi = case["expected_min_steps"], case["expected_max_steps"]
        ops = {s.operation for s in plan.steps if s.operation}
        missing_ops = [o for o in case["must_include_ops"] if o not in ops]

        # Risk-surface assertion: what the plan actually touches, regardless of
        # which operation name got it there.
        touched = set()
        raw_steps = getattr(plan.raw, "steps", None)
        if raw_steps:
            for st in raw_steps:
                touched.update(st.risk_surface.active)
        missing_touch = [t for t in case.get("must_touch", []) if t not in touched]

        rows.append({
            "case": case,
            "plan": plan,
            "gov": gov,
            "actual_steps": actual,
            "steps_in_range": lo <= actual <= hi,
            "deviation_from_decision": (actual - plan.estimated_steps)
                if plan.estimated_steps is not None else None,
            "missing_ops": missing_ops,
            "missing_touch": missing_touch,
            "declares_destructive": any(s.destructive for s in plan.steps),
            "declares_approval": any(s.requires_human_approval for s in plan.steps),
        })

    report(engine_name, rows, verbose)
    return rows


def report(engine_name, rows, verbose):
    W = 104
    print(f"\n  PLANNER EVAL  engine={engine_name}  {len(rows)} cases")
    print("  " + "=" * W)

    hdr = (f"  {'case':<18}{'steps':<7}{'want':<8}{'ok':<4}{'dev':<5}"
           f"{'deps':<6}{'risk':<6}{'HELIX':<10}{'MATRIX':<8}fingerprint")
    print(hdr)
    print("  " + "-" * W)

    for r in rows:
        c, p, g = r["case"], r["plan"], r["gov"]
        dev = r["deviation_from_decision"]
        print(f"  {c['id']:<18}{r['actual_steps']:<7}"
              f"{str(c['expected_min_steps'])+'-'+str(c['expected_max_steps']):<8}"
              f"{'Y' if r['steps_in_range'] else 'N':<4}"
              f"{(f'{dev:+d}' if dev is not None else '?'):<5}"
              f"{'Y' if p.supports_dependencies else '-':<6}"
              f"{'Y' if p.supports_risk_surface else '-':<6}"
              f"{g['helix_risk']+'/'+('HITL' if g['helix_hitl'] else 'auto'):<10}"
              f"{g['matrix_status']:<8}{p.fingerprint}")

    # ---- headline metrics -------------------------------------------------
    total = len(rows)
    fps = Counter(r["plan"].fingerprint for r in rows)
    distinct = len(fps)
    in_range = sum(r["steps_in_range"] for r in rows)
    op_ok = sum(1 for r in rows if not r["missing_ops"])
    touch_ok = sum(1 for r in rows if not r["missing_touch"])

    print("\n  " + "=" * W)
    print(f"  {'distinct plans':<34}{distinct}/{total}"
          f"   ({100.0*distinct/total:.0f}% of missions get their own plan)")
    print(f"  {'step count within expected range':<34}{in_range}/{total}")
    print(f"  {'declared operations correct':<34}{op_ok}/{total}")
    print(f"  {'risk surface correct':<34}{touch_ok}/{total}")

    dev_known = [abs(r["deviation_from_decision"]) for r in rows
                 if r["deviation_from_decision"] is not None]
    if dev_known:
        print(f"  {'mean |deviation| vs Decision est.':<34}{sum(dev_known)/len(dev_known):.1f} steps")

    # governance differentiation
    gov_sig = {(r["gov"]["helix_risk"], r["gov"]["helix_decision"],
                r["gov"]["matrix_status"]) for r in rows}
    print(f"  {'distinct governance verdicts':<34}{len(gov_sig)}/{total}")

    destructive = [r for r in rows if r["case"].get("must_be_destructive")]
    if destructive:
        caught = sum(1 for r in destructive
                     if r["declares_destructive"]
                     or r["gov"]["helix_decision"] != "APPROVED"
                     or r["gov"]["matrix_action"] == "STOP")
        print(f"  {'destructive missions flagged':<34}{caught}/{len(destructive)}")

    # the explicit success condition
    trio = [r for r in rows if r["case"].get("killer_trio")]
    trio_fps = {r["plan"].fingerprint for r in trio}
    verdict = "PASS" if len(trio_fps) == len(trio) else "FAIL"
    print(f"\n  KILLER TRIO (typo / REST API / TS migration): "
          f"{len(trio_fps)} distinct plans out of {len(trio)}  -> {verdict}")

    if len(fps) < total:
        print("\n  Missions sharing an identical plan:")
        for fp, n in fps.most_common():
            if n > 1:
                ids = [r["case"]["id"] for r in rows if r["plan"].fingerprint == fp]
                print(f"    {fp}  x{n}  {', '.join(ids)}")

    if verbose:
        print("\n  " + "=" * W)
        for r in rows:
            c, p, g = r["case"], r["plan"], r["gov"]
            print(f"\n  {c['id']}  --  \"{c['prompt']}\"")
            print(f"    capabilities : {p.capabilities}")
            print(f"    decision est : {p.estimated_steps}   actual: {r['actual_steps']}")
            for s in p.steps:
                bits = [f"[{s.step_id}] {s.action}"]
                if s.operation: bits.append(f"op={s.operation}")
                if s.tool: bits.append(f"tool={s.tool}")
                if s.depends_on: bits.append(f"after={s.depends_on}")
                if s.destructive: bits.append("DESTRUCTIVE")
                print("      " + "  ".join(bits))
            print(f"    missing ops  : {r['missing_ops'] or 'none'}")
            print(f"    missing touch: {r['missing_touch'] or 'none'}")
            print(f"    HELIX        : risk={g['helix_risk']} decision={g['helix_decision']} hitl={g['helix_hitl']}")
            print(f"    MATRIX       : {g['matrix_status']} / {g['matrix_threat']} / {g['matrix_action']}")
            print(f"    agents       : {g['agents']}")

    return verdict


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", default="current", choices=sorted(ADAPTERS))
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()
    rows = run(args.engine, args.verbose)
    return 0 if rows else 1


if __name__ == "__main__":
    sys.exit(main())
