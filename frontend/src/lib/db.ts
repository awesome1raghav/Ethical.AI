// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

// Local SQLite store for chat history and mission records (frontend/data/).
const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = path.join(DB_DIR, 'database.db');

declare global {
  // @ts-ignore
  var sqliteDb: DatabaseSync | undefined;
}

export const db = globalThis.sqliteDb || new DatabaseSync(DB_PATH);

if (process.env.NODE_ENV !== 'production') {
  globalThis.sqliteDb = db;
}

/**
 * Additive column migration for the missions table.
 *
 * The Intelligence Panel computes confidence, complexity and a risk reason, but
 * the original schema had nowhere to put them, so they were dropped at launch.
 * CREATE TABLE IF NOT EXISTS will not add columns to a table that already
 * exists, so widen it explicitly here.
 */
function migrateMissionsTable() {
  const existing = db.prepare('PRAGMA table_info(missions)').all() as { name: string }[];
  const present = new Set(existing.map((c) => c.name));

  const additions: Record<string, string> = {
    confidence: 'INTEGER',
    complexity: 'TEXT',
    risk_reason: 'TEXT',
    decision_id: 'TEXT',
  };

  for (const [column, type] of Object.entries(additions)) {
    if (!present.has(column)) {
      db.exec(`ALTER TABLE missions ADD COLUMN ${column} ${type}`);
    }
  }
}

// Function to initialize tables
export function initDb() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents_registry (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      primary_intent TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      clarity_score INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_legal INTEGER NOT NULL,
      legality_reason TEXT NOT NULL,
      assigned_agent_id TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (mission_id) REFERENCES missions(id)
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      agent_name TEXT,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (mission_id) REFERENCES missions(id)
    );
  `);

  migrateMissionsTable();

  // Seed default agents if registry is empty
  const checkAgents = db.prepare('SELECT COUNT(*) as count FROM agents_registry').get() as { count: number };
  if (checkAgents.count === 0) {
    const defaultAgents = [
      {
        id: 'research_agent',
        name: 'Research Agent',
        role: 'Nexus Web & Knowledge Synthesizer',
        description: 'Understand objective, gather contextual information, and build mission understanding.',
        type: 'required',
        enabled: 1,
        status: 'idle'
      },
      {
        id: 'knowledge_agent',
        name: 'Knowledge Agent',
        role: 'Enterprise Knowledge Retrieval',
        description: 'Retrieve relevant enterprise knowledge, index documents, and organizational context.',
        type: 'required',
        enabled: 1,
        status: 'idle'
      },
      {
        id: 'execution_agent',
        name: 'Execution Agent',
        role: 'Workflow Execution & Processing',
        description: 'Execute the approved workflow, process documents, perform browser operations.',
        type: 'required',
        enabled: 1,
        status: 'idle'
      },
      {
        id: 'validation_agent',
        name: 'Validation Agent',
        role: 'Trust & Output Validation',
        description: 'Verify execution quality, validate consistency, and generate Trusted Response.',
        type: 'required',
        enabled: 1,
        status: 'idle'
      }
    ];

    const insertAgent = db.prepare(`
      INSERT INTO agents_registry (id, name, role, description, type, enabled, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const agent of defaultAgents) {
      insertAgent.run(
        agent.id,
        agent.name,
        agent.role,
        agent.description,
        agent.type,
        agent.enabled,
        agent.status
      );
    }
  }
}

// Auto-init on load
initDb();
