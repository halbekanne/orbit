import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { RhythmCardComponent } from './rhythm-card';

describe('RhythmCardComponent', () => {
  let component: RhythmCardComponent;
  let fixture: ComponentFixture<RhythmCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RhythmCardComponent],
      providers: [
        { provide: HttpClient, useValue: { get: () => of([]), post: () => of([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RhythmCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show morning-open state with CTA when no morning focus set', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cta = el.querySelector('button');
    expect(cta?.textContent).toContain('Fokus setzen');
  });

  it('should emit select on click', () => {
    const spy = vi.fn();
    component.select.subscribe(spy);
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    btn.click();
    expect(spy).toHaveBeenCalled();
  });
});
