import { PullRequest } from '../shared/work-item.model';

const JIRA_KEY_PATTERN = /[A-Z]+-\d+/;

export function extractJiraKey(pr: PullRequest): string | null {
  return (
    JIRA_KEY_PATTERN.exec(pr.fromRef.displayId)?.[0] ?? JIRA_KEY_PATTERN.exec(pr.title)?.[0] ?? null
  );
}
