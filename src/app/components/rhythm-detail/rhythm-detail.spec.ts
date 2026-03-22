import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { RhythmDetailComponent } from './rhythm-detail';

describe('RhythmDetailComponent', () => {
  let component: RhythmDetailComponent;
  let fixture: ComponentFixture<RhythmDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RhythmDetailComponent],
      providers: [
        { provide: HttpClient, useValue: { get: () => of([]), post: () => of([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RhythmDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show input form when morning is not filled', () => {
    const el: HTMLElement = fixture.nativeElement;
    const textarea = el.querySelector('textarea');
    expect(textarea).toBeTruthy();
  });

  it('should have textarea with aria-labelledby pointing to question element', () => {
    const el: HTMLElement = fixture.nativeElement;
    const textarea = el.querySelector('textarea');
    const labelId = textarea?.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    const labelEl = el.querySelector(`#${labelId}`);
    expect(labelEl).toBeTruthy();
    expect(labelEl?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('should emit submitted event on submit', () => {
    const spy = vi.fn();
    component.submitted.subscribe(spy);

    component.textValue.set('Mein Fokus');
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-submit"]') as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();

    expect(spy).toHaveBeenCalled();
  });

  it('should emit skipped event on skip', () => {
    const spy = vi.fn();
    component.skipped.subscribe(spy);

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-skip"]') as HTMLButtonElement;
    btn.click();

    expect(spy).toHaveBeenCalled();
  });
});
