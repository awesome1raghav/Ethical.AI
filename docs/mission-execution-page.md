# Mission Execution Page Documentation

## Overview

The Mission Execution Page provides a sophisticated interface for orchestrating, monitoring, and controlling swarm intelligence missions. It features real-time agent status tracking, dynamic execution workflows, and optional agent management.

## Architecture

### Component Structure

```
MissionExecutionPage (Main Container)
├── AgentOrchestrations (Left Sidebar)
│   ├── Core Agents (3 always active)
│   └── Optional Agents (2 with toggles)
├── MissionExecutionTimeline (Main Content)
│   └── ExecutionStepCard (Individual steps)
└── MissionEnhancements (Agent Toggles)
```

### Key Components

#### 1. **AgentOrchestrations** (`AgentOrchestrations.tsx`)

Displays all 5 agents with their current status and progress.

**Features:**
- Core agents (ResearchAgent, SovereignAgent, AnalysisAgent) - always enabled
- Optional agents (CitadelAgent, MemoryAgent) - toggleable
- Real-time status indicators: WAITING, RUNNING, COMPLETED
- Animated progress bars
- Color-coded state feedback

**Props:**
```typescript
interface AgentOrchestrationProps {
  agents: Agent[];
}

interface Agent {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  status: "waiting" | "running" | "completed";
  progress: number;
  enabled: boolean;
  isOptional: boolean;
  onToggle?: () => void;
}
```

#### 2. **MissionExecutionTimeline** (`MissionExecutionTimeline.tsx`)

Dynamic execution flow showing step-by-step mission progress.

**Features:**
- 8-step execution workflow
- Conditional steps based on agent toggles
- Visual timeline connectors
- Step details with animated list items
- Approval workflow for HITL (Human In The Loop) steps
- Dynamic output rendering for completed steps
- Automatic step filtering based on enabled agents

**Props:**
```typescript
interface MissionExecutionTimelineProps {
  steps: ExecutionStep[];
  citadelEnabled: boolean;
  memoryEnabled: boolean;
}

interface ExecutionStep {
  id: string;
  number: number;
  title: string;
  status: "pending" | "running" | "completed" | "skipped";
  details?: string[];
  conditionalOn?: "MemoryAgent" | "CitadelAgent" | null;
  isConditional?: boolean;
  requiresApproval?: boolean;
}
```

#### 3. **MissionEnhancements** (`MissionEnhancements.tsx`)

Toggle switches for optional agents with real-time workflow updates.

**Features:**
- CitadelAgent toggle (Security Verification)
- MemoryAgent toggle (Knowledge Persistence)
- Visual feedback for enabled/disabled states
- Disabled during execution
- Informational text about workflow impact

**Props:**
```typescript
interface MissionEnhancementsProps {
  citadelEnabled: boolean;
  memoryEnabled: boolean;
  onCitadelToggle: () => void;
  onMemoryToggle: () => void;
  isExecutionComplete: boolean;
}
```

## Execution Flow

### Mission Status States

```
idle
  ↓
running (agent execution sequence)
  ↓
completed (ready for deployment)
```

### Step Execution Sequence

1. **LOGIN** - Permission verification
2. **Classification** - Mission intent detection
3. **ResearchAgent** - Information gathering from multiple sources
4. **Memory Sync** (conditional) - Knowledge graph synchronization
5. **SovereignAgent** - Governance and ethics validation
6. **Citadel Verification** (conditional) - Security checks
7. **AnalysisAgent** - Intelligence synthesis
8. **Mission Ready** - Swarm ready for deployment

### Agent Rules

**Core Agents (Always ON):**
- ResearchAgent: Research & Retrieval
- SovereignAgent: Governance Layer
- AnalysisAgent: Intelligence Synthesis

**Optional Agents:**
- CitadelAgent: When ON → Security steps included
- MemoryAgent: When ON → Knowledge sync steps included

## UI/UX Design

### Color Scheme

- **Background**: Pure black (#000000)
- **Text**: Snow white (#F8F9FA) with various opacity levels
- **Active State**: Green (#4ADE80) for running/completed
- **Waiting State**: White/30 opacity
- **Borders**: White/10 opacity with slight glow on interaction

### Animation Principles

- **Entrance**: Smooth fade-in with slight upward motion (0.4s)
- **Progress**: Animated progress bars
- **Status Icons**: Spinning loader for "running" state
- **Timeline Connectors**: Color-coded based on step status
- **Button Interactions**: Scale and color transitions

### Responsive Design

- **Desktop**: 3-column layout (agents, timeline, controls)
- **Tablet**: 2-column layout
- **Mobile**: Single column (stacked vertically)
- Sticky sidebar for agent status

## Integration

### Using the New Execution Page

Replace the existing execution page content:

```typescript
// src/app/execution/page.tsx
import { MissionExecutionPage } from "@/components/MissionExecution";

export default function ExecutionPage() {
  return <MissionExecutionPage />;
}
```

### Customization

#### Adding New Steps

Modify the `steps` state in `MissionExecutionPage.tsx`:

```typescript
{
  id: "unique-id",
  number: 9,
  title: "Step Title",
  status: "pending",
  details: ["Detail 1", "Detail 2"],
  conditionalOn: null, // or "MemoryAgent" | "CitadelAgent"
  isConditional: false,
  requiresApproval: false
}
```

#### Modifying Agent List

Edit the `agents` state initialization:

```typescript
{
  id: "agent-id",
  name: "AgentName",
  role: "Agent Role",
  icon: <IconComponent className="w-5 h-5" />,
  status: "waiting",
  progress: 0,
  enabled: true,
  isOptional: false,
  onToggle: () => setAgentEnabled(!agentEnabled)
}
```

#### Changing Execution Sequence

Modify the `executionSequence` effect to adjust timing, agent triggering, or step ordering.

## State Management

### Local State

```typescript
const [missionStatus, setMissionStatus] = useState<MissionStatus>("idle");
const [citadelEnabled, setCitadelEnabled] = useState(false);
const [memoryEnabled, setMemoryEnabled] = useState(false);
const [agents, setAgents] = useState<AgentType[]>([...]);
const [steps, setSteps] = useState<ExecutionStep[]>([...]);
```

### State Flow

1. User toggles optional agent → state updates
2. Agent state updates reflected in steps (filtering)
3. User clicks "Start Mission" → execution sequence begins
4. Execution sequence updates step and agent statuses
5. Upon completion → Deploy button becomes active

## Advanced Features

### Conditional Execution

Steps are automatically filtered based on optional agent toggles:

```typescript
const visibleSteps = steps.filter((step) => {
  if (step.conditionalOn === "CitadelAgent" && !citadelEnabled) return false;
  if (step.conditionalOn === "MemoryAgent" && !memoryEnabled) return false;
  return true;
});
```

### HITL Approval Workflow

Steps with `requiresApproval: true` display:
- Yellow warning icon
- Approval button
- Mission waits for user confirmation

### Dynamic Output Rendering

Completed steps show context-specific output:
- Sovereign validation → Trust Score & Risk Level
- Citadel verification → Security Confidence
- Analysis synthesis → Confidence Score & Source Count

### Live Timeline Summary

Footer displays real-time mission progress:
- ✓ = Completed
- ⟳ = Running
- ○ = Pending

## Styling

### Tailwind Configuration

Uses existing project theme:
- Custom CSS variables for colors
- Semantic color naming (primary, secondary, destructive, accent)
- Responsive spacing and sizing
- Backdrop blur effects for cards

### Border & Glow Effects

- Base: `border-white/10`
- Hover: `border-white/20 bg-white/[0.03]`
- Active: `border-green-400/30 bg-green-400/[0.03]`

## Performance Considerations

- Components use React.memo for optimization (can be added)
- AnimatePresence for efficient animation handling
- Sticky sidebar reduces reflows
- Lazy step details rendering

## Future Enhancements

- [ ] WebSocket real-time updates from backend
- [ ] Persistent mission history
- [ ] Multi-mission parallel tracking
- [ ] Custom step templates
- [ ] Export execution reports
- [ ] Mission replay functionality
- [ ] Advanced filtering and search
- [ ] Agent health monitoring dashboard
