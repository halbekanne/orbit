import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  JiraTicket,
  JiraTicketComment,
  JiraTicketAttachment,
  JiraTicketRelation,
  TicketPriority,
  TicketStatus,
} from '../models/work-item.model';
import { environment } from '../../environments/environment';

interface JiraIssueCommentRaw {
  id: string;
  author: { displayName: string };
  body: string;
  created: string;
}

interface JiraIssueAttachmentRaw {
  id: string;
  filename: string;
  mimeType: string;
  thumbnail?: string;
  content: string;
}

interface JiraLinkedIssue {
  key: string;
  self: string;
  fields: {
    summary?: string;
    status: { name: string };
  };
}

interface JiraIssueLink {
  type: { inward: string; outward: string };
  inwardIssue?: JiraLinkedIssue;
  outwardIssue?: JiraLinkedIssue;
}

interface JiraSubtask {
  key: string;
  self: string;
  fields: {
    summary: string;
    status: { name: string };
  };
}

interface JiraIssueFields {
  summary: string;
  description: string | null;
  status: { name: string; statusCategory: { key: string; name: string } };
  priority: { name: string } | null;
  issuetype: { name: string };
  assignee: { displayName: string; name: string } | null;
  reporter: { displayName: string } | null;
  creator: { displayName: string } | null;
  duedate: string | null;
  created: string;
  updated: string;
  labels: string[];
  project: { key: string; name: string };
  components: { name: string }[];
  comment: JiraIssueCommentRaw[] | { comments: JiraIssueCommentRaw[] } | null;
  attachment: JiraIssueAttachmentRaw[];
  issuelinks: JiraIssueLink[];
  subtasks: JiraSubtask[];
  parent?: { key: string; self: string; fields: { summary?: string; status: { name: string } } };
  customfield_10014?: string | null;
}

interface JiraIssueRaw {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
}

interface JiraSearchResponse {
  issues: JiraIssueRaw[];
}

function mapPriority(name: string | undefined): TicketPriority {
  if (!name) return 'Medium';
  const lower = name.toLowerCase();
  if (['highest', 'high', 'blocker', 'kritisch'].includes(lower)) return 'High';
  if (['lowest', 'low', 'niedrig'].includes(lower)) return 'Low';
  return 'Medium';
}

function mapStatus(name: string, categoryKey: string): TicketStatus {
  if (categoryKey === 'done') return 'Done';
  if (categoryKey === 'new') return 'To Do';
  const lower = name.toLowerCase();
  if (lower.includes('review') || lower.includes('test') || lower.includes('prüf') || lower.includes('abnahme')) {
    return 'In Review';
  }
  return 'In Progress';
}

function extractComments(raw: JiraIssueFields['comment']): JiraIssueCommentRaw[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.comments ?? [];
}

@Injectable({ providedIn: 'root' })
export class JiraService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/rest/api/2`;

  getAssignedActiveTickets(): Observable<JiraTicket[]> {
    const params = new HttpParams()
      .set('jql', 'assignee = currentUser() AND statusCategory = "In Progress"')
      .set('maxResults', '50')
      .set('fields', 'summary,description,status,priority,issuetype,assignee,reporter,creator,duedate,created,updated,labels,project,components,comment,attachment,issuelinks,subtasks,parent,customfield_10014');

    return this.http
      .get<JiraSearchResponse>(`${this.baseUrl}/search`, { params })
      .pipe(map(response => response.issues.map(issue => this.mapIssue(issue))));
  }

  private mapIssue(issue: JiraIssueRaw): JiraTicket {
    const baseUrl = issue.self.split('/rest/')[0];
    const fields = issue.fields;

    const relations: JiraTicketRelation[] = [];

    for (const link of fields.issuelinks ?? []) {
      if (link.inwardIssue) {
        relations.push({
          key: link.inwardIssue.key,
          summary: link.inwardIssue.fields.summary ?? '',
          status: link.inwardIssue.fields.status.name,
          url: `${baseUrl}/browse/${link.inwardIssue.key}`,
          relationLabel: link.type.inward,
        });
      }
      if (link.outwardIssue) {
        relations.push({
          key: link.outwardIssue.key,
          summary: link.outwardIssue.fields.summary ?? '',
          status: link.outwardIssue.fields.status.name,
          url: `${baseUrl}/browse/${link.outwardIssue.key}`,
          relationLabel: link.type.outward,
        });
      }
    }

    for (const subtask of fields.subtasks ?? []) {
      relations.push({
        key: subtask.key,
        summary: subtask.fields.summary,
        status: subtask.fields.status.name,
        url: `${baseUrl}/browse/${subtask.key}`,
        relationLabel: 'Unteraufgabe',
      });
    }

    if (fields.parent) {
      relations.push({
        key: fields.parent.key,
        summary: fields.parent.fields.summary ?? '',
        status: fields.parent.fields.status.name,
        url: `${baseUrl}/browse/${fields.parent.key}`,
        relationLabel: 'Elternelement',
      });
    }

    const comments: JiraTicketComment[] = extractComments(fields.comment).map(c => ({
      id: c.id,
      author: c.author.displayName,
      body: c.body,
      createdAt: c.created,
    }));

    const attachments: JiraTicketAttachment[] = (fields.attachment ?? []).map(a => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      thumbnail: a.thumbnail,
      url: a.content,
    }));

    return {
      type: 'ticket',
      id: issue.id,
      key: issue.key,
      summary: fields.summary,
      issueType: fields.issuetype?.name ?? 'Task',
      status: mapStatus(fields.status.name, fields.status.statusCategory.key),
      priority: mapPriority(fields.priority?.name),
      assignee: fields.assignee?.displayName ?? 'Unbeauftragt',
      reporter: fields.reporter?.displayName ?? '',
      creator: fields.creator?.displayName ?? '',
      description: fields.description ?? '',
      dueDate: fields.duedate ?? null,
      createdAt: fields.created,
      updatedAt: fields.updated,
      url: `${baseUrl}/browse/${issue.key}`,
      labels: fields.labels ?? [],
      project: fields.project ? { key: fields.project.key, name: fields.project.name } : null,
      components: (fields.components ?? []).map(c => c.name),
      comments,
      attachments,
      relations,
      epicLink: fields.customfield_10014 ?? null,
    };
  }
}
