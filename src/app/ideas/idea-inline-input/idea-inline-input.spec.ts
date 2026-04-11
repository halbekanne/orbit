import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IdeaInlineInputComponent } from './idea-inline-input';

describe('IdeaInlineInputComponent', () => {
  let component: IdeaInlineInputComponent;
  let fixture: ComponentFixture<IdeaInlineInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdeaInlineInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IdeaInlineInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit add event when Enter is pressed with valid input', () => {
    vi.spyOn(component.add, 'emit');
    const inputEl = fixture.nativeElement.querySelector('input');
    inputEl.value = 'Test Idea';
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(component.add.emit).toHaveBeenCalledWith('Test Idea');
    expect(inputEl.value).toBe('');
  });

  it('should not emit add event when Enter is pressed with empty input', () => {
    vi.spyOn(component.add, 'emit');
    const inputEl = fixture.nativeElement.querySelector('input');
    inputEl.value = '   ';
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(component.add.emit).not.toHaveBeenCalled();
  });

  it('should clear input when Escape is pressed', () => {
    const inputEl = fixture.nativeElement.querySelector('input');
    inputEl.value = 'Test Idea';
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(inputEl.value).toBe('');
  });

  it('should not emit add event for non-Enter keys', () => {
    vi.spyOn(component.add, 'emit');
    const inputEl = fixture.nativeElement.querySelector('input');
    inputEl.value = 'Test Idea';
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    fixture.detectChanges();

    expect(component.add.emit).not.toHaveBeenCalled();
  });
});
