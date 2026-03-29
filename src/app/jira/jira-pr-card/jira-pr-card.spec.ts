import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JiraPrCardComponent } from './jira-pr-card';
import { JiraTicket } from '../../shared/work-item.model';

function makeTicket(overrides: Partial<JiraTicket> = {}): JiraTicket {
  return {
    type: 'ticket',
    id: '1',
    key: 'VERS-42',
    summary: 'Fix the login flow',
    issueType: 'Bug',
    status: 'In Progress',
    priority: 'High',
    assignee: 'Anna B.',
    reporter: '',
    creator: '',
    description: 'This is the ticket description.',
    dueDate: null,
    createdAt: '',
    updatedAt: '',
    url: 'http://jira/browse/VERS-42',
    labels: [],
    project: null,
    components: [],
    comments: [],
    attachments: [],
    relations: [],
    epicLink: null,
    ...overrides,
  };
}

describe('JiraPrCardComponent', () => {
  let fixture: ComponentFixture<JiraPrCardComponent>;

  function setup(ticket: JiraTicket | 'loading' | 'no-ticket' | 'error') {
    fixture = TestBed.configureTestingModule({
      imports: [JiraPrCardComponent],
    }).createComponent(JiraPrCardComponent);
    fixture.componentRef.setInput('ticket', ticket);
    fixture.detectChanges();
  }

  it('renders skeleton with aria-busy when loading', () => {
    setup('loading');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('renders "Kein Jira-Ticket gefunden" for no-ticket state', () => {
    setup('no-ticket');
    expect(fixture.nativeElement.textContent).toContain('Kein Jira-Ticket gefunden');
  });

  it('renders "Ticket konnte nicht geladen werden" for error state', () => {
    setup('error');
    expect(fixture.nativeElement.textContent).toContain('Ticket konnte nicht geladen werden');
  });

  it('renders ticket key in the header', () => {
    setup(makeTicket());
    expect(fixture.nativeElement.textContent).toContain('VERS-42');
  });

  it('renders ticket summary', () => {
    setup(makeTicket());
    expect(fixture.nativeElement.textContent).toContain('Fix the login flow');
  });

  it('renders assignee name', () => {
    setup(makeTicket());
    expect(fixture.nativeElement.textContent).toContain('Anna B.');
  });

  it('renders "Nicht zugeordnet" when assignee is unassigned', () => {
    setup(makeTicket({ assignee: 'Nicht zugeordnet' }));
    expect(fixture.nativeElement.textContent).toContain('Nicht zugeordnet');
  });

  it('renders description via jira markup pipe', () => {
    setup(makeTicket({ description: 'This is the ticket description.' }));
    expect(fixture.nativeElement.textContent).toContain('This is the ticket description.');
  });

  it('does not render description section when description is empty', () => {
    setup(makeTicket({ description: '' }));
    const descSection = fixture.nativeElement.querySelector('[data-testid="jira-description"]');
    expect(descSection).toBeNull();
  });

  it('renders "In Jira öffnen" link with correct aria-label', () => {
    setup(makeTicket());
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a[aria-label]');
    expect(link.getAttribute('aria-label')).toBe('Öffne VERS-42 in Jira');
    expect(link.getAttribute('href')).toBe('http://jira/browse/VERS-42');
  });
});
