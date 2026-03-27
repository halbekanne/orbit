import { TestBed } from '@angular/core/testing';
import { HybridRailComponent } from './hybrid-rail';

const mockMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
};

describe('HybridRailComponent', () => {
  beforeEach(async () => {
    mockMatchMedia();
    await TestBed.configureTestingModule({
      imports: [HybridRailComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(HybridRailComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render all view items', () => {
    const fixture = TestBed.createComponent(HybridRailComponent);
    fixture.componentRef.setInput('activeView', 'arbeit');
    fixture.detectChanges();
    const navButtons = fixture.nativeElement.querySelectorAll('nav button');
    expect(navButtons.length).toBe(2);
    expect(navButtons[0].textContent).toContain('Arbeit');
    expect(navButtons[1].textContent).toContain('Logbuch');
  });

  it('should mark the active view with aria-current', () => {
    const fixture = TestBed.createComponent(HybridRailComponent);
    fixture.componentRef.setInput('activeView', 'arbeit');
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[0].getAttribute('aria-current')).toBe('page');
    expect(buttons[1].getAttribute('aria-current')).toBeNull();
  });

  it('should emit viewChange on click', () => {
    const fixture = TestBed.createComponent(HybridRailComponent);
    fixture.componentRef.setInput('activeView', 'arbeit');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.viewChange.subscribe(spy);
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[1].click();
    expect(spy).toHaveBeenCalledWith('logbuch');
  });

  it('should navigate with arrow keys', () => {
    const fixture = TestBed.createComponent(HybridRailComponent);
    fixture.componentRef.setInput('activeView', 'arbeit');
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].focus();
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('should have nav with correct aria-label', () => {
    const fixture = TestBed.createComponent(HybridRailComponent);
    fixture.componentRef.setInput('activeView', 'arbeit');
    fixture.detectChanges();
    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav.getAttribute('aria-label')).toBe('Hauptnavigation');
  });
});
