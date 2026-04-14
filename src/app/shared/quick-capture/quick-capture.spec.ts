import { TestBed } from '@angular/core/testing';
import { QuickCaptureComponent } from './quick-capture';

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

describe('QuickCaptureComponent', () => {
  beforeEach(async () => {
    mockMatchMedia();
    await TestBed.configureTestingModule({
      imports: [QuickCaptureComponent],
    }).compileComponents();
  });

  it('should show keyboard hints when open', () => {
    const fixture = TestBed.createComponent(QuickCaptureComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const hints = fixture.nativeElement.querySelector('[data-testid="keyboard-hints"]');
    expect(hints).toBeTruthy();
    expect(hints.textContent).toContain('Speichern');
    expect(hints.textContent).toContain('Abbrechen');
    expect(hints.textContent).toContain('Wechseln');
  });

  it('should not render anything when closed', () => {
    const fixture = TestBed.createComponent(QuickCaptureComponent);
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });
});
