import { Component, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CompactHeaderBarComponent } from './compact-header-bar';
import { BadgeColor } from '../badge/badge';

@Component({
  template: `
    <app-compact-header-bar
      [visible]="visible()"
      [title]="title()"
      [statusLabel]="statusLabel()"
      [statusColor]="statusColor()"
      [stripeColor]="stripeColor()"
      [prefix]="prefix()"
    />
  `,
  imports: [CompactHeaderBarComponent],
})
class TestHost {
  visible = signal(true);
  title = signal('Test Title');
  statusLabel = signal('In Progress');
  statusColor = signal<BadgeColor>('primary');
  stripeColor = signal('bg-violet-500');
  prefix = signal('');
}

describe('CompactHeaderBarComponent', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  let el: HTMLElement;

  function bar(): HTMLElement {
    return el.querySelector('[data-testid="compact-bar"]') as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TestHost] });
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  afterEach(() => TestBed.resetTestingModule());

  it('hides when not visible (has -translate-y-full class)', () => {
    host.visible.set(false);
    fixture.detectChanges();
    expect(bar().classList).toContain('-translate-y-full');
  });

  it('shows when visible (has translate-y-0 class)', () => {
    host.visible.set(true);
    fixture.detectChanges();
    expect(bar().classList).toContain('translate-y-0');
  });

  it('displays title', () => {
    host.title.set('My Ticket Title');
    fixture.detectChanges();
    const span = el.querySelector('.truncate') as HTMLElement;
    expect(span.textContent?.trim()).toBe('My Ticket Title');
  });

  it('displays status label', () => {
    host.statusLabel.set('Done');
    fixture.detectChanges();
    const badge = el.querySelector('orbit-badge') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('Done');
  });

  it('displays prefix when provided', () => {
    host.prefix.set('PROJ-123');
    fixture.detectChanges();
    const prefixEl = el.querySelector('.font-mono') as HTMLElement;
    expect(prefixEl).not.toBeNull();
    expect(prefixEl.textContent?.trim()).toBe('PROJ-123');
  });

  it('hides prefix when empty', () => {
    host.prefix.set('');
    fixture.detectChanges();
    const prefixEl = el.querySelector('.font-mono');
    expect(prefixEl).toBeNull();
  });

  it('applies stripe color class', () => {
    host.stripeColor.set('bg-amber-500');
    fixture.detectChanges();
    const stripe = el.querySelector('.w-\\[3px\\]') as HTMLElement;
    expect(stripe.classList).toContain('bg-amber-500');
  });

  it('renders orbit-badge with status color', () => {
    host.statusColor.set('success');
    fixture.detectChanges();
    const badge = el.querySelector('orbit-badge') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.textContent?.trim()).toBe('In Progress');
  });
});
