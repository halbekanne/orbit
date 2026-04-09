import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { ViewArbeitComponent } from './view-arbeit';
import { WorkspaceService } from '../workspace.service';
import { TodoService } from '../../todos/todo.service';
import { IdeaService } from '../../ideas/idea.service';
import { AiReviewService } from '../../review/ai-review.service';
import { SettingsService } from '../../settings/settings.service';

const mockWorkspaceService = {
  tickets: signal([]),
  ticketsLoading: signal(false),
  ticketsError: signal(false),
  pullRequests: signal([]),
  reviewPullRequests: signal([]),
  myPullRequests: signal([]),
  pullRequestsLoading: signal(false),
  pullRequestsError: signal(false),
  selectedItem: signal(null),
  reflectionSelected: signal(false),
  lastAddedId: signal(null),
  awaitingReviewCount: signal(0),
  select: () => {},
  selectReflection: () => {},
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

const mockAiReviewService = {
  reviewState: signal('idle'),
  canReview: signal(false),
  triggerReview: () => {},
};

const mockSettingsService = {
  dayCalendarEnabled: signal(true),
  pomodoroEnabled: signal(false),
  notizenEnabled: signal(false),
};

describe('ViewArbeitComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ViewArbeitComponent],
      providers: [
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: TodoService, useValue: mockTodoService },
        { provide: IdeaService, useValue: mockIdeaService },
        { provide: AiReviewService, useValue: mockAiReviewService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: HttpClient, useValue: { get: () => of([]), post: () => of({}) } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
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

  it('should render navigator, workbench, and day-calendar-panel', () => {
    const fixture = TestBed.createComponent(ViewArbeitComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-navigator')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-workbench')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-day-calendar-panel')).toBeTruthy();
  });

  it('should have flex layout host class', () => {
    const fixture = TestBed.createComponent(ViewArbeitComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('flex')).toBe(true);
    expect(fixture.nativeElement.classList.contains('h-full')).toBe(true);
  });

  it('sidebarCollapsed defaults to false', () => {
    const fixture = TestBed.createComponent(ViewArbeitComponent);
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(false);
  });

  it('toggleSidebar toggles the signal', () => {
    const fixture = TestBed.createComponent(ViewArbeitComponent);
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(false);
    fixture.componentInstance.toggleSidebar();
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(true);
    fixture.componentInstance.toggleSidebar();
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(false);
  });

  it('persists sidebarCollapsed to localStorage', () => {
    const fixture = TestBed.createComponent(ViewArbeitComponent);
    fixture.componentInstance.toggleSidebar();
    TestBed.tick();
    expect(localStorage.getItem('orbit.sidebar.collapsed')).toBe('true');
  });

  it('restores sidebarCollapsed from localStorage', async () => {
    localStorage.setItem('orbit.sidebar.collapsed', 'true');
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ViewArbeitComponent],
      providers: [
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: TodoService, useValue: mockTodoService },
        { provide: IdeaService, useValue: mockIdeaService },
        { provide: AiReviewService, useValue: mockAiReviewService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: HttpClient, useValue: { get: () => of([]), post: () => of({}) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ViewArbeitComponent);
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(true);
  });

  it('hides aside when sidebarCollapsed is true', () => {
    const fixture = TestBed.createComponent(ViewArbeitComponent);
    fixture.componentInstance.toggleSidebar();
    fixture.detectChanges();
    const aside = fixture.nativeElement.querySelector('aside[aria-label="Navigator"]');
    expect(aside).toBeNull();
  });

  it('shows sidebar-open button when sidebar collapsed', () => {
    const fixture = TestBed.createComponent(ViewArbeitComponent);
    fixture.componentInstance.toggleSidebar();
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('[data-testid="sidebar-open"]');
    expect(btn).toBeTruthy();
  });

  it('shows calendar-open button when calendar collapsed', () => {
    const fixture = TestBed.createComponent(ViewArbeitComponent);
    fixture.componentInstance.toggleCalendar();
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('[data-testid="calendar-open"]');
    expect(btn).toBeTruthy();
  });
});
