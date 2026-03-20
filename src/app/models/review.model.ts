export interface ReviewFinding {
  severity: 'critical' | 'important' | 'minor';
  category: 'ak-abgleich' | 'code-quality';
  title: string;
  file: string;
  line: number;
  detail: string;
  suggestion: string;
}

export interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
  warnings: string[];
  reviewedAt: string;
}

export type ReviewState =
  | 'idle'
  | 'loading'
  | { status: 'result'; data: ReviewResult }
  | { status: 'error'; message: string };
