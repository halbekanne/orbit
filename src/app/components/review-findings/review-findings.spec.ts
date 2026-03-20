import { TestBed } from '@angular/core/testing';
import { ReviewFindingsComponent } from './review-findings';
import { ReviewState, ReviewFinding, createInitialPipeline } from '../../models/review.model';

const makeFinding = (overrides: Partial<ReviewFinding> = {}): ReviewFinding => ({
  severity: 'important',
  category: 'code-quality',
  title: 'Test finding',
  file: 'test.ts',
  line: 10,
  detail: 'Some detail',
  suggestion: 'Fix it',
  ...overrides,
});

describe('ReviewFindingsComponent', () => {
  function setup(state: ReviewState) {
    TestBed.configureTestingModule({ imports: [ReviewFindingsComponent] });
    const fixture = TestBed.createComponent(ReviewFindingsComponent);
    fixture.componentRef.setInput('reviewState', state);
    fixture.detectChanges();
    return fixture;
  }

  it('does not render content when idle', () => {
    const fixture = setup('idle');
    expect(fixture.nativeElement.querySelector('[aria-labelledby="pr-review-heading"]')).toBeNull();
  });

  it('shows loading state', () => {
    const fixture = setup({ status: 'running', pipeline: createInitialPipeline() });
    expect(fixture.nativeElement.textContent).toContain('KI-Review läuft');
  });

  it('shows error state', () => {
    const fixture = setup({ status: 'error', pipeline: createInitialPipeline(), message: 'fail' });
    expect(fixture.nativeElement.textContent).toContain('Review konnte nicht durchgeführt werden');
  });

  it('shows empty state when no findings', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: { findings: [], summary: 'Keine Auffälligkeiten', warnings: [], reviewedAt: '' },
    });
    expect(fixture.nativeElement.textContent).toContain('Keine Auffälligkeiten gefunden');
  });

  it('renders findings as list items', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [
          makeFinding({ severity: 'critical', title: 'Critical bug' }),
          makeFinding({ severity: 'minor', title: 'Small thing' }),
        ],
        summary: '2 Auffälligkeiten',
        warnings: [],
        reviewedAt: '',
      },
    });
    const listItems = fixture.nativeElement.querySelectorAll('[role="listitem"]');
    expect(listItems.length).toBe(2);
  });

  it('expands critical findings by default', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [makeFinding({ severity: 'critical', detail: 'Critical detail text' })],
        summary: '1', warnings: [], reviewedAt: '',
      },
    });
    expect(fixture.nativeElement.textContent).toContain('Critical detail text');
  });

  it('collapses non-critical findings by default', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [makeFinding({ severity: 'minor', detail: 'Minor detail text' })],
        summary: '1', warnings: [], reviewedAt: '',
      },
    });
    expect(fixture.nativeElement.textContent).not.toContain('Minor detail text');
  });

  it('toggles finding detail on click', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [makeFinding({ severity: 'minor', detail: 'Toggled detail' })],
        summary: '1', warnings: [], reviewedAt: '',
      },
    });
    expect(fixture.nativeElement.textContent).not.toContain('Toggled detail');

    const button = fixture.nativeElement.querySelector('[role="listitem"] button');
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Toggled detail');
  });

  it('shows warnings when present', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [],
        summary: 'Keine Auffälligkeiten',
        warnings: ['Agent 1 fehlgeschlagen'],
        reviewedAt: '',
      },
    });
    expect(fixture.nativeElement.textContent).toContain('Agent 1 fehlgeschlagen');
  });

  it('shows summary text', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [makeFinding()],
        summary: '1 Auffälligkeit: 0 Kritisch, 1 Wichtig, 0 Gering',
        warnings: [],
        reviewedAt: '',
      },
    });
    expect(fixture.nativeElement.textContent).toContain('1 Auffälligkeit');
  });
});
