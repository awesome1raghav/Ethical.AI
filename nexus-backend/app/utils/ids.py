import uuid


def generate_mission_id():
    return f"mission_{uuid.uuid4().hex[:8]}"


def generate_trace_id():
    return f"trace_{uuid.uuid4().hex[:8]}"

def generate_decision_id():
    return f"decision_{uuid.uuid4().hex[:8]}"
