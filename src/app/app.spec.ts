import { TestBed } from '@angular/core/testing';
import { App } from './app';

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

describe('App', () => {
  beforeEach(async () => {
    mockMatchMedia();
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should default to arbeit view', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance.activeView()).toBe('arbeit');
  });

  it('should render the hybrid rail', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const rail = fixture.nativeElement.querySelector('app-hybrid-rail');
    expect(rail).toBeTruthy();
  });

  it('should persist active view to localStorage', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.activeView.set('logbuch');
    TestBed.tick();
    expect(localStorage.getItem('orbit.activeView')).toBe('logbuch');
  });

  it('should restore active view from localStorage', () => {
    localStorage.setItem('orbit.activeView', 'logbuch');
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance.activeView()).toBe('logbuch');
  });
});
