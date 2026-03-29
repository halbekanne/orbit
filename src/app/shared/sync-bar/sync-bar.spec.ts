import { vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SyncBarComponent } from './sync-bar';
import { DataRefreshService } from '../data-refresh.service';

describe('SyncBarComponent', () => {
  let fixture: ComponentFixture<SyncBarComponent>;

  const mockRefreshService = {
    globalStatus: signal<'idle' | 'refreshing' | 'retrying' | 'error'>('idle'),
    lastGlobalFetchTime: signal<Date | null>(null),
    retryInfo: signal<{ attempt: number; maxAttempts: number } | null>(null),
    isRefreshing: signal(false),
    refreshAll: vi.fn(),
    resetPollingTimer: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [SyncBarComponent],
      providers: [{ provide: DataRefreshService, useValue: mockRefreshService }],
    });
    fixture = TestBed.createComponent(SyncBarComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('renders', () => {
    expect(fixture.nativeElement).toBeTruthy();
  });

  it('shows timestamp when idle with data', () => {
    mockRefreshService.lastGlobalFetchTime.set(new Date(2026, 2, 29, 14, 32));
    mockRefreshService.globalStatus.set('idle');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('14:32');
  });

  it('shows "Aktualisiere…" when refreshing', () => {
    mockRefreshService.globalStatus.set('refreshing');
    mockRefreshService.isRefreshing.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Aktualisiere');
  });

  it('shows retry info when retrying', () => {
    mockRefreshService.globalStatus.set('retrying');
    mockRefreshService.isRefreshing.set(true);
    mockRefreshService.retryInfo.set({ attempt: 2, maxAttempts: 3 });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('2/3');
  });

  it('calls refreshAll and resetPollingTimer on sync click', () => {
    const btn = fixture.nativeElement.querySelector('button');
    btn.click();

    expect(mockRefreshService.refreshAll).toHaveBeenCalledWith(true);
    expect(mockRefreshService.resetPollingTimer).toHaveBeenCalled();
  });
});
