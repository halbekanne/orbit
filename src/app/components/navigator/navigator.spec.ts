import { TestBed } from '@angular/core/testing';
import { NavigatorComponent } from './navigator';

describe('NavigatorComponent – collapse logic', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NavigatorComponent],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('defaults all sections to expanded when localStorage is empty', () => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.ticketsCollapsed()).toBe(false);
    expect(comp.prsCollapsed()).toBe(false);
    expect(comp.todosCollapsed()).toBe(false);
  });

  it('reads initial collapsed state from localStorage', () => {
    localStorage.setItem(
      'orbit.navigator.collapsed',
      JSON.stringify({ tickets: true, prs: false, todos: true })
    );
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.ticketsCollapsed()).toBe(true);
    expect(comp.prsCollapsed()).toBe(false);
    expect(comp.todosCollapsed()).toBe(true);
  });

  it('falls back to all-expanded when localStorage value is invalid JSON', () => {
    localStorage.setItem('orbit.navigator.collapsed', 'not-json');
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.ticketsCollapsed()).toBe(false);
    expect(comp.prsCollapsed()).toBe(false);
    expect(comp.todosCollapsed()).toBe(false);
  });

  it('persists collapsed state to localStorage when toggleTickets is called', () => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.toggleTickets();
    TestBed.flushEffects();
    const saved = JSON.parse(localStorage.getItem('orbit.navigator.collapsed')!);
    expect(saved.tickets).toBe(true);
  });

  it('persists collapsed state to localStorage when togglePrs is called', () => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.togglePrs();
    TestBed.flushEffects();
    const saved = JSON.parse(localStorage.getItem('orbit.navigator.collapsed')!);
    expect(saved.prs).toBe(true);
  });

  it('persists collapsed state to localStorage when toggleTodos is called', () => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.toggleTodos();
    TestBed.flushEffects();
    const saved = JSON.parse(localStorage.getItem('orbit.navigator.collapsed')!);
    expect(saved.todos).toBe(true);
  });

  it('toggles signal back to false on second call', () => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.toggleTickets();
    TestBed.flushEffects();
    comp.toggleTickets();
    TestBed.flushEffects();
    expect(comp.ticketsCollapsed()).toBe(false);
  });
});
