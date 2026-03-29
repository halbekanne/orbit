import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { ReflectionCardComponent } from './reflection-card';

describe('ReflectionCardComponent', () => {
  let component: ReflectionCardComponent;
  let fixture: ComponentFixture<ReflectionCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReflectionCardComponent],
      providers: [{ provide: HttpClient, useValue: { get: () => of([]), post: () => of([]) } }],
    }).compileComponents();

    fixture = TestBed.createComponent(ReflectionCardComponent);
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
