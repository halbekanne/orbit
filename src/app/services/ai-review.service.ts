import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { JiraTicket } from '../models/work-item.model';
import {
  AgentStep,
  createInitialPipeline,
  PipelineState,
  ReviewResult,
  ReviewState,
} from '../models/review.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AiReviewService {
  private readonly baseUrl = `${environment.proxyUrl}/api/ai/review`;
  private readonly reviewRequestedSubject = new Subject<void>();
  private abortController?: AbortController;

  readonly reviewState = signal<ReviewState>('idle');
  readonly canReview = signal(false);
  readonly reviewRequested$ = this.reviewRequestedSubject.asObservable();

  triggerReview(): void {
    this.reviewRequestedSubject.next();
  }

  async requestReview(diff: string, jiraTicket: JiraTicket | null): Promise<void> {
    this.abortController?.abort();
    this.abortController = new AbortController();

    const pipeline = createInitialPipeline();
    this.reviewState.set({ status: 'running', pipeline });

    const body = {
      diff,
      jiraTicket: jiraTicket
        ? { key: jiraTicket.key, summary: jiraTicket.summary, description: jiraTicket.description }
        : null,
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        this.reviewState.set({ status: 'error', pipeline, message: `HTTP ${response.status}` });
        return;
      }

      let reviewResult: ReviewResult | null = null;
      reviewResult = await this.consumeStream(response, pipeline);

      if (reviewResult) {
        this.reviewState.set({ status: 'result', pipeline: { ...pipeline }, data: reviewResult });
      } else {
        this.reviewState.set({
          status: 'result',
          pipeline: { ...pipeline },
          data: { findings: [], summary: '', warnings: pipeline.warnings, reviewedAt: '' },
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      this.reviewState.set({
        status: 'error',
        pipeline,
        message: err instanceof Error ? err.message : 'Review fehlgeschlagen',
      });
    }
  }

  reset(): void {
    this.abortController?.abort();
    this.reviewState.set('idle');
  }

  private async consumeStream(response: Response, pipeline: PipelineState): Promise<ReviewResult | null> {
    if (!response.body) throw new Error('Response has no body');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reviewResult: ReviewResult | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop()!;

      for (const block of blocks) {
        if (!block.trim()) continue;
        const parsed = this.parseSSEBlock(block);
        if (parsed) {
          const result = this.handleEvent(parsed.event, parsed.data, pipeline);
          if (result) reviewResult = result;
          this.reviewState.set({ status: 'running', pipeline: { ...pipeline } });
        }
      }
    }

    if (buffer.trim()) {
      const parsed = this.parseSSEBlock(buffer);
      if (parsed) {
        const result = this.handleEvent(parsed.event, parsed.data, pipeline);
        if (result) reviewResult = result;
      }
    }

    return reviewResult;
  }

  private parseSSEBlock(block: string): { event: string; data: string } | null {
    let event = '';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7);
      else if (line.startsWith('data: ')) data = line.slice(6);
    }
    return event ? { event, data } : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleEvent(event: string, rawData: string, pipeline: PipelineState): ReviewResult | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: Record<string, any>;
    try {
      data = JSON.parse(rawData);
    } catch {
      return null;
    }

    switch (event) {
      case 'agent:start':
        pipeline.agents.push({
          agent: data['agent'],
          label: data['label'],
          temperature: data['temperature'],
          thinkingBudget: data['thinkingBudget'],
          status: 'running',
        } as AgentStep);
        break;

      case 'agent:done': {
        const agent = pipeline.agents.find(a => a.agent === data['agent']);
        if (agent) {
          agent.status = 'done';
          agent.duration = data['duration'];
          agent.findingCount = data['findingCount'];
          agent.summary = data['summary'];
          agent.thoughts = data['thoughts'];
          agent.rawResponse = data['rawResponse'];
        }
        break;
      }

      case 'agent:error': {
        const errAgent = pipeline.agents.find(a => a.agent === data['agent']);
        if (errAgent) {
          errAgent.status = 'error';
          errAgent.error = data['error'];
        }
        break;
      }

      case 'consolidator:start':
        pipeline.consolidator = {
          status: 'running',
          temperature: data['temperature'],
          thinkingBudget: data['thinkingBudget'],
        };
        break;

      case 'consolidator:done':
        pipeline.consolidator = {
          status: 'done',
          temperature: pipeline.consolidator.temperature,
          thinkingBudget: pipeline.consolidator.thinkingBudget,
          duration: data['duration'],
          decisions: data['decisions'],
          summary: data['summary'],
          thoughts: data['thoughts'],
          rawResponse: data['rawResponse'],
        };
        return data['result'] as ReviewResult;

      case 'warning':
        pipeline.warnings.push(data['message']);
        break;

      case 'done':
        pipeline.totalDuration = data['totalDuration'];
        break;
    }

    return null;
  }
}
