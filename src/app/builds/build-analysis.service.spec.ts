import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BuildAnalysisService } from './build-analysis.service';
import { SettingsService } from '../settings/settings.service';
import { BuildAnalysisRequest, BuildAnalysisResult } from './jenkins.model';

describe('BuildAnalysisService', () => {
  let service: BuildAnalysisService;
  let httpMock: HttpTestingController;
  let settingsService: SettingsService;

  const mockRequest: BuildAnalysisRequest = {
    jobPath: 'frontend-app',
    branch: 'feature/test',
    buildNumber: 42,
    failedStage: { name: 'Test', nodeId: '5', status: 'FAILED', durationMillis: 45000 },
    stageLog: 'npm ERR! test failed',
  };

  const mockResult: BuildAnalysisResult = {
    cause: 'Test failed',
    solution: 'Fix the test',
    evidence: { source: 'stage-log', snippet: 'npm ERR! test failed' },
    jenkinsfileAvailable: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BuildAnalysisService);
    httpMock = TestBed.inject(HttpTestingController);
    settingsService = TestBed.inject(SettingsService);
  });

  afterEach(() => httpMock.verify());

  it('should set not-configured when vertex AI url is empty', () => {
    service.analyze(mockRequest);
    expect(service.state().status).toBe('not-configured');
  });

  it('should fetch analysis and cache result', () => {
    (settingsService as any)._settings.set({
      ...settingsService.settings(),
      connections: {
        ...settingsService.settings().connections,
        vertexAi: { url: 'http://vertex.test', customHeaders: [] },
      },
    });

    service.analyze(mockRequest);
    expect(service.state().status).toBe('loading');

    const req = httpMock.expectOne(r => r.url.includes('/api/ai/build-analysis'));
    req.flush(mockResult);
    TestBed.tick();

    expect(service.state().status).toBe('result');

    service.analyze(mockRequest);
    httpMock.expectNone(r => r.url.includes('/api/ai/build-analysis'));
    expect(service.state().status).toBe('result');
  });

  it('should clear cache on reanalyze', () => {
    (settingsService as any)._settings.set({
      ...settingsService.settings(),
      connections: {
        ...settingsService.settings().connections,
        vertexAi: { url: 'http://vertex.test', customHeaders: [] },
      },
    });

    service.analyze(mockRequest);
    httpMock.expectOne(r => r.url.includes('/api/ai/build-analysis')).flush(mockResult);
    TestBed.tick();

    service.reanalyze(mockRequest);
    expect(service.state().status).toBe('loading');
    httpMock.expectOne(r => r.url.includes('/api/ai/build-analysis')).flush(mockResult);
  });

  it('should set error state on failure', () => {
    (settingsService as any)._settings.set({
      ...settingsService.settings(),
      connections: {
        ...settingsService.settings().connections,
        vertexAi: { url: 'http://vertex.test', customHeaders: [] },
      },
    });

    service.analyze(mockRequest);
    httpMock.expectOne(r => r.url.includes('/api/ai/build-analysis')).flush(
      { error: 'Vertex AI nicht erreichbar' },
      { status: 500, statusText: 'Internal Server Error' },
    );
    TestBed.tick();

    const state = service.state();
    expect(state.status).toBe('error');
  });
});
