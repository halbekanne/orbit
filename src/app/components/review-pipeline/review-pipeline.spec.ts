import { TestBed } from '@angular/core/testing';
import { ReviewPipelineComponent } from './review-pipeline';
import { PipelineState } from '../../models/review.model';

function setup(pipeline: PipelineState) {
  TestBed.configureTestingModule({ imports: [ReviewPipelineComponent] });
  const fixture = TestBed.createComponent(ReviewPipelineComponent);
  fixture.componentRef.setInput('pipeline', pipeline);
  fixture.detectChanges();
  return fixture;
}

function emptyPipeline(): PipelineState {
  return { agents: [], consolidator: { status: 'pending' }, warnings: [] };
}

describe('ReviewPipelineComponent', () => {
  it('renders nothing when pipeline has no agents', () => {
    const fixture = setup(emptyPipeline());
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-pipeline]')).toBeNull();
  });

  it('renders agent steps', () => {
    const fixture = setup({
      agents: [
        { agent: 'ak-check', label: 'AK-Abgleich', temperature: 0.2, status: 'done', duration: 3.2, summary: 'Alles ok' },
        { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4, status: 'done', duration: 2.1, summary: 'Minor issues' },
      ],
      consolidator: { status: 'pending' },
      warnings: [],
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-pipeline]')).not.toBeNull();
    expect(el.textContent).toContain('AK-Abgleich');
    expect(el.textContent).toContain('Code-Qualität');
  });

  it('shows running indicator for active agents', () => {
    const fixture = setup({
      agents: [
        { agent: 'ak-check', label: 'AK-Abgleich', temperature: 0.2, status: 'running' },
      ],
      consolidator: { status: 'pending' },
      warnings: [],
    });
    const el = fixture.nativeElement as HTMLElement;
    const dot = el.querySelector('[data-status="running"]');
    expect(dot).not.toBeNull();
    expect(el.textContent).toContain('läuft...');
  });

  it('shows error state for failed agents', () => {
    const fixture = setup({
      agents: [
        { agent: 'ak-check', label: 'AK-Abgleich', temperature: 0.2, status: 'error', error: 'Timeout' },
      ],
      consolidator: { status: 'pending' },
      warnings: [],
    });
    const el = fixture.nativeElement as HTMLElement;
    const dot = el.querySelector('[data-status="error"]');
    expect(dot).not.toBeNull();
    expect(el.textContent).toContain('Fehler');
  });

  it('shows temperature badges', () => {
    const fixture = setup({
      agents: [
        { agent: 'ak-check', label: 'AK-Abgleich', temperature: 0.4, status: 'done' },
      ],
      consolidator: { status: 'pending' },
      warnings: [],
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('T=0.4');
  });

  it('shows consolidator decisions when present', () => {
    const fixture = setup({
      agents: [
        { agent: 'ak-check', label: 'AK-Abgleich', temperature: 0.2, status: 'done' },
      ],
      consolidator: {
        status: 'done',
        temperature: 0.1,
        duration: 1.5,
        decisions: [
          { action: 'kept', finding: 'Missing null check', reason: 'Valid concern' },
          { action: 'removed', finding: 'Style nit', reason: 'Too minor' },
          { action: 'severity-changed', finding: 'Type error', reason: 'Downgraded', oldSeverity: 'critical', newSeverity: 'minor' },
        ],
      },
      warnings: [],
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Valid concern');
    expect(el.textContent).toContain('Too minor');
    expect(el.textContent).toContain('Downgraded');
  });

  it('shows total duration when available', () => {
    const fixture = setup({
      agents: [
        { agent: 'ak-check', label: 'AK-Abgleich', temperature: 0.2, status: 'done', duration: 3.2 },
      ],
      consolidator: { status: 'done' },
      warnings: [],
      totalDuration: 5.4,
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('5.4s');
  });
});
