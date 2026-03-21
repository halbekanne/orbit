export interface ReviewFinding {
  severity: 'critical' | 'important' | 'minor';
  category: string;
  wcagCriterion?: string;
  title: string;
  file: string;
  line: number;
  detail: string;
  suggestion: string;
  codeSnippet?: string;
}

export interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
  warnings: string[];
  reviewedAt: string;
}

export interface AgentStep {
  agent: string;
  label: string;
  temperature: number;
  thinkingBudget?: number;
  status: 'running' | 'done' | 'error';
  duration?: number;
  findingCount?: number;
  summary?: string;
  thoughts?: string;
  rawResponse?: unknown;
  error?: string;
}

export interface ConsolidatorDecision {
  action: 'kept' | 'removed' | 'merged' | 'severity-changed';
  reason: string;
  finding: string;
  oldSeverity?: string;
  newSeverity?: string;
}

export interface ConsolidatorStep {
  status: 'pending' | 'running' | 'done' | 'error';
  temperature?: number;
  thinkingBudget?: number;
  error?: string;
  duration?: number;
  decisions?: ConsolidatorDecision[];
  summary?: string;
  thoughts?: string;
  rawResponse?: unknown;
}

export interface PipelineState {
  agents: AgentStep[];
  consolidator: ConsolidatorStep;
  warnings: string[];
  totalDuration?: number;
}

export type ReviewState =
  | 'idle'
  | { status: 'running'; pipeline: PipelineState }
  | { status: 'result'; pipeline: PipelineState; data: ReviewResult }
  | { status: 'error'; pipeline: PipelineState; message: string };

export function createInitialPipeline(): PipelineState {
  return { agents: [], consolidator: { status: 'pending' }, warnings: [] };
}

export function isReviewRunning(state: ReviewState): boolean {
  return typeof state === 'object' && state.status === 'running';
}
