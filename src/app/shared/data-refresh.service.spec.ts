import { TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { DataRefreshService } from './data-refresh.service';

describe('DataRefreshService', () => {
  let service: DataRefreshService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataRefreshService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('calls registered fetch functions on refreshAll with force', () => {
    let jiraCalled = false;
    let bbCalled = false;
    service.register('jira', () => { jiraCalled = true; return of(undefined); });
    service.register('bitbucket', () => { bbCalled = true; return of(undefined); });

    service.refreshAll(true);

    expect(jiraCalled).toBe(true);
    expect(bbCalled).toBe(true);
  });

  it('sets source status to refreshing during fetch', () => {
    const subject = new Subject<void>();
    service.register('jira', () => subject.asObservable());

    service.refreshAll(true);

    expect(service.sourceState('jira')().status).toBe('refreshing');

    subject.next();
    subject.complete();

    expect(service.sourceState('jira')().status).toBe('idle');
  });

  it('updates lastFetchTime on successful fetch', () => {
    service.register('jira', () => of(undefined));

    expect(service.sourceState('jira')().lastFetchTime).toBeNull();

    service.refreshAll(true);

    expect(service.sourceState('jira')().lastFetchTime).toBeGreaterThan(0);
  });

  it('sets status to error on failed fetch', () => {
    vi.useFakeTimers();
    service.register('jira', () => throwError(() => new Error('fail')));

    service.refreshAll(true);

    expect(service.sourceState('jira')().status).toBe('retrying');

    vi.advanceTimersByTime(3_000);
    expect(service.sourceState('jira')().status).toBe('retrying');

    vi.advanceTimersByTime(6_000);
    expect(service.sourceState('jira')().status).toBe('retrying');

    vi.advanceTimersByTime(12_000);
    expect(service.sourceState('jira')().status).toBe('error');

    vi.useRealTimers();
  });

  it('exposes isRefreshing as true when any source is refreshing', () => {
    const subject = new Subject<void>();
    service.register('jira', () => subject.asObservable());
    service.register('bitbucket', () => of(undefined));

    service.refreshAll(true);

    expect(service.isRefreshing()).toBe(true);

    subject.next();
    subject.complete();

    expect(service.isRefreshing()).toBe(false);
  });

  it('ignores refreshAll while already refreshing', () => {
    let callCount = 0;
    const subject = new Subject<void>();
    service.register('jira', () => { callCount++; return subject.asObservable(); });

    service.refreshAll(true);
    service.refreshAll(true);

    expect(callCount).toBe(1);

    subject.next();
    subject.complete();
  });
});
