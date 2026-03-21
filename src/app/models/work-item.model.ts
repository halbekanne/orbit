import { SubTask } from './sub-task.model';

export type TicketStatus = 'In Progress' | 'In Review' | 'To Do' | 'Done';
export type TicketPriority = 'High' | 'Medium' | 'Low';
export type PrStatus = 'Awaiting Review' | 'Changes Requested' | 'Needs Re-review' | 'Approved' | 'Approved by Others' | 'In Review' | 'Ready to Merge';

export interface BuildStatusSummary {
  successful: number;
  failed: number;
  inProgress: number;
}
export type PrState = 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';

export interface PrUser {
  id: number;
  name: string;
  displayName: string;
  emailAddress: string;
  slug: string;
  active: boolean;
  type: string;
  profileUrl: string;
}

export interface PrRepository {
  id: number;
  slug: string;
  name: string;
  projectKey: string;
  projectName: string;
  browseUrl: string;
}

export interface PrRef {
  id: string;
  displayId: string;
  latestCommit: string;
  repository: PrRepository;
}

export interface PrParticipant {
  user: PrUser;
  role: 'AUTHOR' | 'REVIEWER' | 'PARTICIPANT';
  approved: boolean;
  status: 'APPROVED' | 'UNAPPROVED' | 'NEEDS_WORK';
}

export interface JiraTicketComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface JiraTicketAttachment {
  id: string;
  filename: string;
  mimeType: string;
  thumbnail?: string;
  url: string;
}

export interface JiraTicketRelation {
  key: string;
  summary: string;
  status: string;
  url: string;
  relationLabel: string;
}

export interface JiraTicket {
  type: 'ticket';
  id: string;
  key: string;
  summary: string;
  issueType: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: string;
  reporter: string;
  creator: string;
  description: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  url: string;
  labels: string[];
  project: { key: string; name: string } | null;
  components: string[];
  comments: JiraTicketComment[];
  attachments: JiraTicketAttachment[];
  relations: JiraTicketRelation[];
  epicLink: string | null;
}

export interface PullRequest {
  type: 'pr';
  id: string;
  prNumber: number;
  title: string;
  description: string;
  state: PrState;
  open: boolean;
  closed: boolean;
  locked: boolean;
  isDraft: boolean;
  createdDate: number;
  updatedDate: number;
  fromRef: PrRef;
  toRef: PrRef;
  author: PrParticipant;
  reviewers: PrParticipant[];
  participants: PrParticipant[];
  commentCount: number;
  openTaskCount: number;
  url: string;
  myReviewStatus: PrStatus;
  isAuthoredByMe: boolean;
  buildStatus?: BuildStatusSummary;
}

export interface Todo {
  type: 'todo';
  id: string;
  title: string;
  description: string;
  status: 'open' | 'done' | 'wont-do';
  urgent: boolean;
  createdAt: string;
  completedAt: string | null;
  subtasks?: SubTask[];
}

export interface Idea {
  type: 'idea';
  id: string;
  title: string;
  description: string;
  status: 'active' | 'wont-do';
  createdAt: string;
  subtasks?: SubTask[];
}

export type WorkItem = JiraTicket | PullRequest | Todo | Idea;
