export type TicketStatus = 'In Progress' | 'In Review' | 'To Do' | 'Done';
export type TicketPriority = 'High' | 'Medium' | 'Low';
export type PrStatus = 'Awaiting Review' | 'Changes Requested' | 'Approved';

export interface JiraTicket {
  type: 'ticket';
  id: string;
  key: string;
  summary: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: string;
  reporter: string;
  description: string;
  dueDate: string | null;
  updatedAt: string;
  url: string;
  overdue: boolean;
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
