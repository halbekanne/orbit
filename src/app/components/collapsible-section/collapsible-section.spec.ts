import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollapsibleSectionComponent } from './collapsible-section';

@Component({
  imports: [CollapsibleSectionComponent],
  template: `
    <app-collapsible-section [label]="label()" [expanded]="expanded()" [noPadding]="noPadding()">
      <svg sectionIcon data-testid="icon"></svg>
      <span sectionMeta data-testid="meta">Meta</span>
      <div data-testid="body">Body content</div>
    </app-collapsible-section>
  `,
})
class TestHostComponent {
  label = signal('Test-Label');
  expanded = signal(false);
  noPadding = signal(false);
}

describe('CollapsibleSectionComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    TestBed.tick();
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  function button(): HTMLButtonElement {
    return el.querySelector('button')!;
  }

  function body(): HTMLElement | null {
    return el.querySelector('[data-testid="body"]');
  }

  it('renders collapsed by default', () => {
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(body()).toBeNull();
  });

  it('renders expanded when input is true', () => {
    host.expanded.set(true);
    TestBed.tick();
    fixture.detectChanges();

    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(body()).not.toBeNull();
  });

  it('toggles on click', () => {
    button().click();
    TestBed.tick();
    fixture.detectChanges();

    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(body()).not.toBeNull();

    button().click();
    TestBed.tick();
    fixture.detectChanges();

    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(body()).toBeNull();
  });

  it('renders the label', () => {
    expect(button().textContent).toContain('Test-Label');
  });

  it('projects sectionIcon slot', () => {
    expect(el.querySelector('[data-testid="icon"]')).not.toBeNull();
  });

  it('projects sectionMeta slot', () => {
    expect(el.querySelector('[data-testid="meta"]')).not.toBeNull();
  });

  it('applies padding by default', () => {
    host.expanded.set(true);
    TestBed.tick();
    fixture.detectChanges();

    const bodyWrapper = body()!.parentElement!;
    expect(bodyWrapper.classList.contains('px-6')).toBe(true);
    expect(bodyWrapper.classList.contains('py-4')).toBe(true);
  });

  it('removes padding when noPadding is true', () => {
    host.expanded.set(true);
    host.noPadding.set(true);
    TestBed.tick();
    fixture.detectChanges();

    const bodyWrapper = body()!.parentElement!;
    expect(bodyWrapper.classList.contains('px-6')).toBe(false);
  });
});
