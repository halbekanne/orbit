import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { DayCalendarPanelComponent } from './day-calendar-panel';

function setup() {
  TestBed.configureTestingModule({
    imports: [DayCalendarPanelComponent],
    providers: [
      {
        provide: HttpClient,
        useValue: {
          get: (url: string) => {
            if (url.includes('/api/logbuch')) {
              return of([]);
            }
            return of({ date: new Date().toISOString().slice(0, 10), appointments: [] });
          },
          post: () => of({}),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(DayCalendarPanelComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('DayCalendarPanelComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem('orbit.dayCalendar.collapsed');
  });

  it('renders the timeline', () => {
    const { el } = setup();
    const timeline = el.querySelector('app-day-timeline');
    expect(timeline).toBeTruthy();
  });

  it('renders collapse toggle button', () => {
    const { el } = setup();
    const toggle = el.querySelector('[data-testid="collapse-toggle"]');
    expect(toggle).toBeTruthy();
  });

  it('hides timeline content when collapsed', () => {
    const { fixture, el } = setup();
    const toggle = el.querySelector<HTMLButtonElement>('[data-testid="collapse-toggle"]');
    toggle!.click();
    fixture.detectChanges();
    const timeline = el.querySelector('app-day-timeline');
    expect(timeline).toBeNull();
  });

  it('renders header with "Tagesplan"', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Tagesplan');
  });
});
