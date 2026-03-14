import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { JiraTicket, TicketPriority, TicketStatus } from '../models/work-item.model';
import { environment } from '../../environments/environment';

interface JiraIssueFields {
  summary: string;
  description: string | null;
  status: { name: string; statusCategory: { key: string; name: string } };
  priority: { name: string } | null;
  assignee: { displayName: string; name: string } | null;
  reporter: { displayName: string } | null;
  duedate: string | null;
  updated: string;
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
  if (name === 'Highest' || name === 'High') return 'High';
  if (name === 'Lowest' || name === 'Low') return 'Low';
  return 'Medium';
}

@Injectable({ providedIn: 'root' })
export class JiraService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/rest/api/2`;

  getAssignedActiveTickets(): Observable<JiraTicket[]> {
    const params = new HttpParams()
      .set('jql', 'assignee = currentUser() AND statusCategory = "In Progress"')
      .set('maxResults', '50');

    return this.http
      .get<JiraSearchResponse>(`${this.baseUrl}/search`, { params })
      .pipe(map(response => response.issues.map(issue => this.mapIssue(issue))));
  }

  private mapIssue(issue: JiraIssueRaw): JiraTicket {
    const baseUrl = issue.self.split('/rest/')[0];
    return {
      type: 'ticket',
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name as TicketStatus,
      priority: mapPriority(issue.fields.priority?.name),
      assignee: issue.fields.assignee?.displayName ?? 'Unbeauftragt',
      reporter: issue.fields.reporter?.displayName ?? '',
      description: issue.fields.description ?? '',
      dueDate: issue.fields.duedate ?? null,
      updatedAt: issue.fields.updated,
      url: `${baseUrl}/browse/${issue.key}`,
    };
  }
}
