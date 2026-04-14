import { TestBed } from '@angular/core/testing';
import { WorkbenchComponent } from './workbench';
import { WorkspaceService } from '../workspace.service';
import { signal } from '@angular/core';

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

describe('WorkbenchComponent', () => {
  beforeEach(async () => {
    mockMatchMedia();
    await TestBed.configureTestingModule({
      imports: [WorkbenchComponent],
      providers: [
        {
          provide: WorkspaceService,
          useValue: {
            selectedItem: signal(null),
            reflectionSelected: signal(false),
          },
        },
      ],
    }).compileComponents();
  });

  it('should show quick capture hint in empty state', () => {
    const fixture = TestBed.createComponent(WorkbenchComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Quick Capture');
    expect(text).toMatch(/[⌘Ctrl]\+?K/);
  });
});
