import { extractJiraKey } from './pr-jira-key';
import { PullRequest } from '../models/work-item.model';

function makePr(branch: string, title: string): PullRequest {
  return {
    type: 'pr', id: '1', prNumber: 1,
    title,
    description: '',
    state: 'OPEN', open: true, closed: false, locked: false, isDraft: false,
    createdDate: 0, updatedDate: 0,
    fromRef: {
      id: `refs/heads/${branch}`, displayId: branch,
      latestCommit: 'abc', repository: {
        id: 1, slug: 'repo', name: 'repo',
        projectKey: 'PROJ', projectName: 'Project', browseUrl: '',
      },
    },
    toRef: {
      id: 'refs/heads/main', displayId: 'main',
      latestCommit: 'def', repository: {
        id: 1, slug: 'repo', name: 'repo',
        projectKey: 'PROJ', projectName: 'Project', browseUrl: '',
      },
    },
    author: { user: { id: 1, name: 'u', displayName: 'U', emailAddress: '', slug: 'u', active: true, type: 'NORMAL', profileUrl: '' }, role: 'AUTHOR', approved: false, status: 'UNAPPROVED' },
    reviewers: [], participants: [],
    commentCount: 0, openTaskCount: 0,
    url: '', myReviewStatus: 'Awaiting Review',
    isAuthoredByMe: false,
  };
}

describe('extractJiraKey', () => {
  it('extracts key from feature/ABCD-1234-words branch', () => {
    expect(extractJiraKey(makePr('feature/VERS-842-fix-timeout', 'some title'))).toBe('VERS-842');
  });

  it('extracts key from bare ABCD-1234-words branch', () => {
    expect(extractJiraKey(makePr('VERS-842-fix-timeout', 'some title'))).toBe('VERS-842');
  });

  it('extracts key from PR title when branch has none', () => {
    expect(extractJiraKey(makePr('fix-timeout', 'VERS-842: Fix the timeout'))).toBe('VERS-842');
  });

  it('prefers branch key over title key', () => {
    expect(extractJiraKey(makePr('feature/VERS-842-fix', 'OTHER-99: something'))).toBe('VERS-842');
  });

  it('returns null when neither branch nor title contains a key', () => {
    expect(extractJiraKey(makePr('fix-timeout', 'Fix the timeout'))).toBeNull();
  });

  it('handles multi-segment branch paths', () => {
    expect(extractJiraKey(makePr('bugfix/team/VERS-99-something', 'no key in title'))).toBe('VERS-99');
  });
});
