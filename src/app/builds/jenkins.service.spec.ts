import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { JenkinsService } from './jenkins.service';
import { SettingsService } from '../settings/settings.service';
import { DataRefreshService } from '../shared/data-refresh.service';

describe('JenkinsService', () => {
  let service: JenkinsService;
  let httpMock: HttpTestingController;

  const mockSettings = {
    jenkinsConfigured: () => true,
    jenkinsConfig: () => ({
      baseUrl: 'http://localhost:6204',
      username: 'user',
      apiToken: 'token',
      jobs: [{ displayName: 'frontend-app', jobPath: 'job/frontend-app' }],
    }),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettings },
        DataRefreshService,
      ],
    });
    service = TestBed.inject(JenkinsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads branches for configured jobs', () => {
    service.loadBranches().subscribe();

    const req = httpMock.expectOne(r => r.url.includes('/jenkins/job/frontend-app/api/json'));
    expect(req.request.params.get('tree')).toContain('jobs[name,color,url]');
    req.flush({
      jobs: [
        { name: 'main', color: 'blue', url: 'http://localhost:6204/job/frontend-app/job/main/' },
      ],
    });

    const buildReq = httpMock.expectOne(r => r.url.includes('/jenkins/job/frontend-app/job/main/api/json'));
    buildReq.flush({ builds: [{ number: 1, result: 'SUCCESS', timestamp: Date.now(), duration: 1000, url: 'http://localhost:6204/job/frontend-app/job/main/1/' }] });
  });

  it('loads build detail for a branch', () => {
    service.loadBuildDetail('job/frontend-app', 'main', 142).subscribe();

    const detailReq = httpMock.expectOne(r => r.url.includes('/jenkins/job/frontend-app/job/main/api/json'));
    detailReq.flush({
      number: 142,
      result: 'SUCCESS',
      duration: 245832,
      timestamp: Date.now(),
      building: false,
      estimatedDuration: 240000,
      description: '<b>Release</b>',
      url: 'http://localhost:6204/job/frontend-app/job/main/142/',
      actions: [],
    });

    const stagesReq = httpMock.expectOne(r => r.url.includes('wfapi/describe'));
    stagesReq.flush({ id: '142', name: '#142', status: 'SUCCESS', stages: [] });
  });

  it('triggers a build', () => {
    service.triggerBuild('job/frontend-app', 'main', {}).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('buildWithParameters') && r.method === 'POST');
    req.flush(null, { status: 201, statusText: 'Created' });
  });

  it('stops a build', () => {
    service.stopBuild('job/frontend-app', 'main', 142).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/142/stop') && r.method === 'POST');
    req.flush(null);
  });
});
