import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { WorkDataService } from '../../services/work-data.service';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';
import { ActionRailComponent } from './action-rail';
import { Todo, Idea, JiraTicket } from '../../models/work-item.model';

const makeTodo = (overrides: Partial<Todo> = {}): Todo => ({
  type: 'todo', id: 'td1', title: 'Test', description: '',
  status: 'open', urgent: false, createdAt: '', completedAt: null, ...overrides,
});

const makeIdea = (overrides: Partial<Idea> = {}): Idea => ({
  type: 'idea', id: 'id1', title: 'Test', description: '',
  status: 'active', createdAt: '', ...overrides,
});

describe('ActionRailComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(selectedItem: unknown) {
    const mockData = { selectedItem: signal(selectedItem) };
    const updateSpy = vi.fn();
    const promoteSpy = vi.fn();
    const demoteSpy = vi.fn();

    TestBed.configureTestingModule({
      imports: [ActionRailComponent],
      providers: [
        { provide: WorkDataService, useValue: { selectedItem: mockData.selectedItem, promoteToTodo: promoteSpy, demoteToIdea: demoteSpy } },
        { provide: TodoService, useValue: { update: updateSpy, todos: signal([]) } },
        { provide: IdeaService, useValue: { update: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ActionRailComponent);
    fixture.detectChanges();
    return { fixture, updateSpy, promoteSpy, demoteSpy };
  }

  it('renders nothing meaningful when no item selected', () => {
    const { fixture } = setup(null);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('button').length).toBe(0);
  });

  it('shows Erledigt button for open todo', () => {
    const { fixture } = setup(makeTodo({ status: 'open' }));
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const labels = Array.from(buttons).map((b: unknown) => (b as Element).textContent?.trim());
    expect(labels).toContain('Erledigt');
  });

  it('shows Wieder öffnen for done todo', () => {
    const { fixture } = setup(makeTodo({ status: 'done', completedAt: '2026-03-16T00:00:00' }));
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .map((b: unknown) => (b as Element).textContent?.trim());
    expect(labels.some(l => l?.includes('Wieder öffnen'))).toBe(true);
  });

  it('shows Zur Aufgabe machen for active idea', () => {
    const { fixture } = setup(makeIdea({ status: 'active' }));
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .map((b: unknown) => (b as Element).textContent?.trim());
    expect(labels.some(l => l?.includes('Zur Aufgabe machen'))).toBe(true);
  });

  it('shows In Jira öffnen link for ticket', () => {
    const ticket: Partial<JiraTicket> = { type: 'ticket', url: 'https://jira.example.com/browse/T-1' };
    const { fixture } = setup(ticket);
    const link = fixture.nativeElement.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('https://jira.example.com/browse/T-1');
  });
});
