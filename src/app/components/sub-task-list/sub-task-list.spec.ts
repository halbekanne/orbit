import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { SubTaskListComponent } from './sub-task-list';
import { SubTask } from '../../models/sub-task.model';

@Component({
  template: `<app-sub-task-list [subtasks]="subtasks()" (subtasksChange)="onChanged($event)" />`,
  imports: [SubTaskListComponent],
})
class TestHostComponent {
  subtasks = signal<SubTask[]>([]);
  lastEmitted: SubTask[] = [];
  onChanged(subtasks: SubTask[]) { this.lastEmitted = subtasks; }
}

describe('SubTaskListComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('renders section header with "Aufgaben"', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Aufgaben');
  });

  it('shows 0/0 counter when no subtasks', () => {
    const el: HTMLElement = fixture.nativeElement;
    const badge = el.querySelector('[data-testid="subtask-counter"]');
    expect(badge?.textContent?.trim()).toBe('0/0');
  });

  it('renders subtask items', () => {
    host.subtasks.set([
      { id: 'st-1', title: 'First', status: 'open', completedAt: null },
      { id: 'st-2', title: 'Second', status: 'done', completedAt: '2026-01-01' },
    ]);
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('[data-testid="subtask-item"]');
    expect(items.length).toBe(2);
  });

  it('shows correct counter for mixed states', () => {
    host.subtasks.set([
      { id: 'st-1', title: 'A', status: 'done', completedAt: '2026-01-01' },
      { id: 'st-2', title: 'B', status: 'open', completedAt: null },
      { id: 'st-3', title: 'C', status: 'open', completedAt: null },
    ]);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('[data-testid="subtask-counter"]');
    expect(badge?.textContent?.trim()).toContain('1/3');
  });

  it('emits subtasksChange when adding via input', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="subtask-input"]');
    input.value = 'New task';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(host.lastEmitted.length).toBe(1);
    expect(host.lastEmitted[0].title).toBe('New task');
    expect(host.lastEmitted[0].status).toBe('open');
  });

  it('emits subtasksChange with toggled status on checkbox click', () => {
    host.subtasks.set([{ id: 'st-1', title: 'A', status: 'open', completedAt: null }]);
    fixture.detectChanges();
    const checkbox = fixture.nativeElement.querySelector('[data-testid="subtask-checkbox"]');
    checkbox.click();
    fixture.detectChanges();
    expect(host.lastEmitted[0].status).toBe('done');
    expect(host.lastEmitted[0].completedAt).toBeTruthy();
  });

  it('emits subtasksChange when deleting a subtask', () => {
    host.subtasks.set([
      { id: 'st-1', title: 'A', status: 'open', completedAt: null },
      { id: 'st-2', title: 'B', status: 'open', completedAt: null },
    ]);
    fixture.detectChanges();
    const deleteBtn = fixture.nativeElement.querySelector('[data-testid="subtask-delete"]');
    deleteBtn.click();
    fixture.detectChanges();
    expect(host.lastEmitted.length).toBe(1);
  });

  it('shows emerald badge when all subtasks are done', () => {
    host.subtasks.set([
      { id: 'st-1', title: 'A', status: 'done', completedAt: '2026-01-01' },
      { id: 'st-2', title: 'B', status: 'done', completedAt: '2026-01-01' },
    ]);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('[data-testid="subtask-counter"]');
    expect(badge?.className).toContain('emerald');
  });

  it('shows indigo badge when partially done', () => {
    host.subtasks.set([
      { id: 'st-1', title: 'A', status: 'done', completedAt: '2026-01-01' },
      { id: 'st-2', title: 'B', status: 'open', completedAt: null },
    ]);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('[data-testid="subtask-counter"]');
    expect(badge?.className).toContain('indigo');
  });

  it('has accessible input field placeholder', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="subtask-input"]');
    expect(input.placeholder).toContain('Neue Aufgabe');
  });
});
