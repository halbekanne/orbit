import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, Observable, of, switchMap, tap, catchError, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { SettingsService } from '../settings/settings.service';
import { DataRefreshService } from '../shared/data-refresh.service';
import { BitbucketService } from '../bitbucket/bitbucket.service';
import {
  BranchBuild,
  JenkinsBranch,
  JenkinsBuild,
  JenkinsBuildDetail,
  JenkinsParameterDefinition,
  JenkinsRun,
  JenkinsStageDetail,
  JenkinsStageLog,
} from './jenkins.model';

@Injectable({ providedIn: 'root' })
export class JenkinsService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);
  private readonly refreshService = inject(DataRefreshService);
  private readonly bitbucket = inject(BitbucketService);
  private readonly base = `${environment.proxyUrl}/jenkins`;

  private readonly _branches = signal<BranchBuild[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);

  readonly branches = this._branches.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly branchesByJob = computed(() => {
    const grouped = new Map<string, BranchBuild[]>();
    for (const b of this._branches()) {
      const list = grouped.get(b.jobDisplayName) ?? [];
      list.push(b);
      grouped.set(b.jobDisplayName, list);
    }
    for (const [key, list] of grouped) {
      list.sort((a, b) => {
        const aTime = a.lastBuild?.timestamp ?? 0;
        const bTime = b.lastBuild?.timestamp ?? 0;
        return bTime - aTime;
      });
    }
    return grouped;
  });

  constructor() {
    this.refreshService.register('jenkins', () => this.loadBranches());
  }

  loadBranches(): Observable<void> {
    if (!this.settings.jenkinsConfigured()) {
      this._branches.set([]);
      return of(undefined);
    }
    this._loading.set(true);
    this._error.set(false);

    const jobs = this.settings.jenkinsConfig().jobs;
    const requests = jobs.map(job => this.loadJobBranches(job.jobPath, job.displayName));

    return forkJoin(requests).pipe(
      map(results => results.flat()),
      tap(branches => {
        this._branches.set(this.enrichWithPrs(branches));
        this._loading.set(false);
      }),
      map(() => undefined),
      catchError(() => {
        this._error.set(true);
        this._loading.set(false);
        throw new Error('Failed to load Jenkins branches');
      }),
    );
  }

  private loadJobBranches(jobPath: string, displayName: string): Observable<BranchBuild[]> {
    const params = new HttpParams().set('tree', 'jobs[name,color,url]');
    return this.http.get<{ jobs: JenkinsBranch[] }>(`${this.base}/${jobPath}/api/json`, { params }).pipe(
      switchMap(response => {
        if (response.jobs.length === 0) return of([]);
        const buildRequests = response.jobs.map(branch =>
          this.loadLatestBuild(jobPath, branch.name).pipe(
            map(build => ({
              jobDisplayName: displayName,
              jobPath,
              branchName: branch.name,
              branchColor: branch.color,
              lastBuild: build,
              prNumber: null,
            } as BranchBuild)),
          ),
        );
        return forkJoin(buildRequests);
      }),
      catchError(() => of([])),
    );
  }

  private loadLatestBuild(jobPath: string, branch: string): Observable<JenkinsBuild | null> {
    const params = new HttpParams().set('tree', 'builds[number,result,timestamp,duration,url]{0,1}');
    return this.http.get<{ builds: JenkinsBuild[] }>(`${this.base}/${jobPath}/job/${branch}/api/json`, { params }).pipe(
      map(res => res.builds?.[0] ?? null),
      catchError(() => of(null)),
    );
  }

  private enrichWithPrs(branches: BranchBuild[]): BranchBuild[] {
    const prs = this.bitbucket.pullRequests();
    if (prs.length === 0) return branches;
    return branches.map(b => {
      const decodedBranch = decodeURIComponent(b.branchName);
      const matchingPr = prs.find(pr => pr.fromRef.displayId === decodedBranch);
      return matchingPr ? { ...b, prNumber: matchingPr.prNumber } : b;
    });
  }

  loadBuildDetail(jobPath: string, branch: string): Observable<{ detail: JenkinsBuildDetail; stages: JenkinsRun }> {
    const detailParams = new HttpParams().set('tree', 'description,result,duration,timestamp,building,estimatedDuration,number,url,actions[parameters[name,value]]');
    return this.http.get<JenkinsBuildDetail>(`${this.base}/${jobPath}/job/${branch}/api/json`, { params: detailParams }).pipe(
      switchMap(detail => {
        return this.http.get<JenkinsRun>(`${this.base}/${jobPath}/job/${branch}/${detail.number}/wfapi/describe`).pipe(
          map(stages => ({ detail, stages })),
        );
      }),
    );
  }

  loadStageDetail(jobPath: string, branch: string, buildNumber: number, stageId: string): Observable<JenkinsStageDetail> {
    return this.http.get<JenkinsStageDetail>(`${this.base}/${jobPath}/job/${branch}/${buildNumber}/execution/node/${stageId}/wfapi/describe`);
  }

  loadStageLog(jobPath: string, branch: string, buildNumber: number, nodeId: string): Observable<JenkinsStageLog> {
    return this.http.get<JenkinsStageLog>(`${this.base}/${jobPath}/job/${branch}/${buildNumber}/execution/node/${nodeId}/wfapi/log`);
  }

  loadParameters(jobPath: string, branch: string): Observable<JenkinsParameterDefinition[]> {
    const params = new HttpParams().set('tree', 'property[parameterDefinitions[name,type,description,defaultParameterValue[value],choices]]');
    return this.http.get<{ property: { parameterDefinitions?: JenkinsParameterDefinition[] }[] }>(`${this.base}/${jobPath}/job/${branch}/api/json`, { params }).pipe(
      map(res => {
        const prop = res.property?.find(p => p.parameterDefinitions);
        return prop?.parameterDefinitions ?? [];
      }),
    );
  }

  triggerBuild(jobPath: string, branch: string, params: Record<string, string>): Observable<unknown> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      body.set(key, value);
    }
    return this.http.post(
      `${this.base}/${jobPath}/job/${branch}/buildWithParameters`,
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, observe: 'response' },
    );
  }

  stopBuild(jobPath: string, branch: string, buildNumber: number): Observable<unknown> {
    return this.http.post(`${this.base}/${jobPath}/job/${branch}/${buildNumber}/stop`, null);
  }
}
