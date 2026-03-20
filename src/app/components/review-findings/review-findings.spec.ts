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

  it('does not render when idle', () => {
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

  it('groups findings by file', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [
          makeFinding({ file: 'a.ts', severity: 'critical' }),
          makeFinding({ file: 'b.ts', severity: 'important' }),
          makeFinding({ file: 'a.ts', severity: 'minor' }),
        ],
        summary: '3 findings',
        warnings: [],
        reviewedAt: '',
      },
    });
    const groups = fixture.nativeElement.querySelectorAll('[data-file-group]');
    expect(groups.length).toBe(2);
  });

  it('expands file groups with critical findings by default', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [
          makeFinding({ file: 'critical.ts', severity: 'critical', title: 'Critical bug' }),
        ],
        summary: '1',
        warnings: [],
        reviewedAt: '',
      },
    });
    const group = fixture.nativeElement.querySelector('[data-file-group]');
    const button = group.querySelector('button');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Critical bug');
  });

  it('collapses file groups without critical findings by default', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [
          makeFinding({ file: 'minor.ts', severity: 'minor', detail: 'Minor detail text' }),
        ],
        summary: '1',
        warnings: [],
        reviewedAt: '',
      },
    });
    const group = fixture.nativeElement.querySelector('[data-file-group]');
    const button = group.querySelector('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles file group on header click', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [
          makeFinding({ file: 'minor.ts', severity: 'minor', title: 'Toggled finding' }),
        ],
        summary: '1',
        warnings: [],
        reviewedAt: '',
      },
    });
    const button = fixture.nativeElement.querySelector('[data-file-group] button');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Toggled finding');
  });

  it('shows severity dots in file group header', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [
          makeFinding({ file: 'a.ts', severity: 'critical' }),
          makeFinding({ file: 'a.ts', severity: 'minor' }),
        ],
        summary: '2',
        warnings: [],
        reviewedAt: '',
      },
    });
    const dots = fixture.nativeElement.querySelectorAll('[data-severity-dot]');
    expect(dots.length).toBe(2);
  });

  it('shows inline code in detail text', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [
          makeFinding({ file: 'a.ts', severity: 'critical', detail: 'Use `ngOnInit` instead' }),
        ],
        summary: '1',
        warnings: [],
        reviewedAt: '',
      },
    });
    const codeEl = fixture.nativeElement.querySelector('code');
    expect(codeEl).toBeTruthy();
    expect(codeEl.textContent).toContain('ngOnInit');
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

  it('sorts file groups by highest severity', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [
          makeFinding({ file: 'minor-file.ts', severity: 'minor' }),
          makeFinding({ file: 'critical-file.ts', severity: 'critical' }),
        ],
        summary: '2',
        warnings: [],
        reviewedAt: '',
      },
    });
    const groups = fixture.nativeElement.querySelectorAll('[data-file-group]');
    expect(groups[0].getAttribute('data-file-group')).toBe('critical-file.ts');
    expect(groups[1].getAttribute('data-file-group')).toBe('minor-file.ts');
  });
});
