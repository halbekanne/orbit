import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ViewArbeitComponent } from './view-arbeit';
import { WorkDataService } from '../../services/work-data.service';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';
import { CosiReviewService } from '../../services/cosi-review.service';

const mockWorkDataService = {
  tickets: signal([]),
  ticketsLoading: signal(false),
  ticketsError: signal(false),
  pullRequests: signal([]),
  pullRequestsLoading: signal(false),
  pullRequestsError: signal(false),
  selectedItem: signal(null),
  rhythmSelected: signal(false),
  lastAddedId: signal(null),
  awaitingReviewCount: signal(0),
  select: () => {},
  selectRhythm: () => {},
};

const mockTodoService = {
  todos: signal([]),
  openTodos: signal([]),
  doneTodos: signal([]),
  wontDoTodos: signal([]),
  pendingCount: signal(0),
  add: () => {},
  update: () => {},
  reorder: () => {},
};

const mockIdeaService = {
  ideas: signal([]),
  activeIdeas: signal([]),
  wontDoIdeas: signal([]),
  add: () => {},
  update: () => {},
  reorder: () => {},
};

const mockCosiReviewService = {
  reviewState: signal('idle'),
  canReview: signal(false),
  triggerReview: () => {},
};

describe('ViewArbeitComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ViewArbeitComponent],
      providers: [
        { provide: WorkDataService, useValue: mockWorkDataService },
        { provide: TodoService, useValue: mockTodoService },
        { provide: IdeaService, useValue: mockIdeaService },
        { provide: CosiReviewService, useValue: mockCosiReviewService },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ViewArbeitComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render navigator aside', () => {
    const fixture = TestBed.createComponent(ViewArbeitComponent);
    fixture.detectChanges();
    const aside = fixture.nativeElement.querySelector('aside[aria-label="Navigator"]');
    expect(aside).toBeTruthy();
  });

  it('should render navigator, workbench, and action-rail', () => {
    const fixture = TestBed.createComponent(ViewArbeitComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-navigator')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-workbench')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-action-rail')).toBeTruthy();
  });

  it('should have flex layout host class', () => {
    const fixture = TestBed.createComponent(ViewArbeitComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('flex')).toBe(true);
    expect(fixture.nativeElement.classList.contains('h-full')).toBe(true);
  });
});
