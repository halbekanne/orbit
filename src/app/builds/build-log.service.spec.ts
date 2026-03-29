import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BuildLogService } from './build-log.service';

describe('BuildLogService', () => {
  let service: BuildLogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withFetch()), provideHttpClientTesting()],
    });
    service = TestBed.inject(BuildLogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stopStreaming();
    httpMock.verify();
  });

  it('loads full console log', () => {
    service.loadFullLog('job/frontend-app', 'main', 142);
    const req = httpMock.expectOne(r => r.url.includes('/142/consoleText'));
    req.flush('[Pipeline] Start of Pipeline\n[Pipeline] End', { headers: {} });
    expect(service.logText()).toContain('Start of Pipeline');
  });

  it('signals not streaming after full load', () => {
    service.loadFullLog('job/frontend-app', 'main', 142);
    const req = httpMock.expectOne(r => r.url.includes('consoleText'));
    req.flush('log text');
    expect(service.isStreaming()).toBe(false);
  });
});
