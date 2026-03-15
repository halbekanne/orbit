export type TicketStatus = 'In Progress' | 'In Review' | 'To Do' | 'Done';
export type TicketPriority = 'High' | 'Medium' | 'Low';
export type PrStatus = 'Awaiting Review' | 'Changes Requested' | 'Approved';

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
  title: string;
  repo: string;
  branch: string;
  author: string;
  status: PrStatus;
  commentCount: number;
  updatedAt: string;
  url: string;
  description: string;
}

export interface Todo {
  type: 'todo';
  id: string;
  title: string;
  description: string;
  done: boolean;
  createdAt: string;
}

export type WorkItem = JiraTicket | PullRequest | Todo;
