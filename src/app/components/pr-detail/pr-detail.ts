import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, concat, map, of, skip, switchMap } from 'rxjs';
import { PullRequest } from '../../models/work-item.model';
import { prStripeClass, prStatusBadgeClass, prStatusDotClass, prStatusLabel } from '../../utils/pr-status';
import { JiraMarkupPipe } from '../../pipes/jira-markup.pipe';
import { BitbucketService } from '../../services/bitbucket.service';
import { JiraService } from '../../services/jira.service';
import { JiraPrCardComponent } from '../jira-pr-card/jira-pr-card';
import { ReviewFindingsComponent } from '../review-findings/review-findings';
import { CompactHeaderBarComponent } from '../compact-header-bar/compact-header-bar';
import { DetailActionBarComponent } from '../detail-action-bar/detail-action-bar';
import { AiReviewService } from '../../services/ai-review.service';
import { extractJiraKey } from '../../utils/pr-jira-key';
import * as Diff2Html from 'diff2html';
import { Diff2HtmlUI } from 'diff2html/lib/ui/js/diff2html-ui-base';
import { ColorSchemeType } from 'diff2html/lib/types';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import python from 'highlight.js/lib/languages/python';
import groovy from 'highlight.js/lib/languages/groovy';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import markdown from 'highlight.js/lib/languages/markdown';
import bash from 'highlight.js/lib/languages/bash';
import plaintext from 'highlight.js/lib/languages/plaintext';

@Component({
  selector: 'app-pr-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, JiraMarkupPipe, JiraPrCardComponent, ReviewFindingsComponent, CompactHeaderBarComponent, DetailActionBarComponent],
  styles: [`
    @keyframes prFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    :host {
      display: block;
      animation: prFadeIn 0.15s ease-out;
    }
  `],
  template: `
    <article [attr.aria-label]="(pr().isAuthoredByMe ? 'Mein PR: ' : 'PR: ') + pr().title">

      <app-compact-header-bar
        [visible]="showCompactBar()"
        [title]="pr().title"
        [statusLabel]="statusLabel()"
        [statusClass]="statusBadgeClass()"
        [stripeColor]="stripeClass()"
        [prefix]="pr().fromRef.repository.slug"
      />

      @if (pr().myReviewStatus === 'Ready to Merge') {
        <div class="bg-emerald-50 border-b border-emerald-200" role="status">
          <div class="max-w-2xl mx-auto px-6 py-2.5 flex items-center gap-2">
            <svg class="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            <span class="text-sm font-medium text-emerald-700">Alle Reviewer haben zugestimmt — bereit zum Mergen.</span>
          </div>
        </div>
      }

      @if (pr().isDraft) {
        <div class="bg-amber-50 border-b border-amber-200" role="status">
          <div class="max-w-2xl mx-auto px-6 py-2.5 flex items-center gap-2">
            <svg class="w-4 h-4 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span class="text-sm font-medium text-amber-700">Entwurf — dieser PR ist noch nicht bereit zum Review oder Mergen.</span>
          </div>
        </div>
      }

      <header class="bg-[var(--color-bg-card)] border-b border-[var(--color-border-subtle)]">
        <div class="max-w-2xl mx-auto relative">
          <div class="absolute left-0 top-0 bottom-0 w-[3px]" [class]="stripeClass()" aria-hidden="true"></div>

          <div class="px-6 pt-5 pb-4 pl-7">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span class="font-mono text-xs font-semibold text-[var(--color-text-muted)] tracking-wide">{{ pr().fromRef.repository.slug }}</span>
              <span class="text-[var(--color-text-muted)]" aria-hidden="true">&middot;</span>
              <span
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border"
                [class]="statusBadgeClass()"
              >
                <span class="w-1.5 h-1.5 rounded-full" [class]="statusDotClass()" aria-hidden="true"></span>
                {{ statusLabel() }}
              </span>
              @if (pr().isAuthoredByMe) {
                <span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] uppercase tracking-wide">Dein PR</span>
              }
              @if (pr().isDraft) {
                <span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">Entwurf</span>
              }
            </div>

            <h1 class="text-lg font-semibold text-[var(--color-text-heading)] leading-snug mb-2">{{ pr().title }}</h1>

            @if (pr().isAuthoredByMe) {
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm text-[var(--color-text-muted)]">
                  erstellt {{ pr().createdDate | date:'dd.MM.yyyy' }}
                  <span class="text-[var(--color-text-muted)] mx-1" aria-hidden="true">&middot;</span>geändert {{ pr().updatedDate | date:'dd.MM.yyyy' }}
                </p>
              </div>
              @if (pr().reviewers.length > 0) {
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  <span class="text-sm text-[var(--color-text-muted)] font-medium shrink-0">Reviewer:</span>
                  @for (reviewer of pr().reviewers; track reviewer.user.id) {
                    <span
                      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border"
                      [class]="reviewer.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : reviewer.status === 'NEEDS_WORK'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]'"
                    >
                      @if (reviewer.status === 'APPROVED') {
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                      } @else if (reviewer.status === 'NEEDS_WORK') {
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      }
                      {{ reviewer.user.displayName }}
                    </span>
                  }
                </div>
              }
            } @else {
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-bg-surface)] text-[var(--color-text-body)] text-[9px] font-bold shrink-0" aria-hidden="true">{{ authorInitials() }}</span>
                <p class="text-sm text-[var(--color-text-muted)]">
                  von <span class="text-[var(--color-text-muted)] font-medium">{{ pr().author.user.displayName }}</span>
                  <span class="text-[var(--color-text-muted)] mx-1" aria-hidden="true">&middot;</span>erstellt {{ pr().createdDate | date:'dd.MM.yyyy' }}
                  <span class="text-[var(--color-text-muted)] mx-1" aria-hidden="true">&middot;</span>geändert {{ pr().updatedDate | date:'dd.MM.yyyy' }}
                </p>
              </div>
            }

            <div class="flex items-center gap-2 mt-3 flex-wrap">
              <span class="text-sm text-[var(--color-text-muted)] font-medium shrink-0">von</span>
              <code class="font-mono text-[13px] text-[var(--color-text-body)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5 break-all">{{ pr().fromRef.displayId }}</code>
              <svg class="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14m-4-4 4 4-4 4"/></svg>
              @if (isNonDefaultTarget()) {
                <code class="font-mono text-[13px] text-amber-700 font-semibold bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5 break-all">{{ pr().toRef.displayId }}</code>
              } @else {
                <code class="font-mono text-[13px] text-[var(--color-text-body)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5 break-all">{{ pr().toRef.displayId }}</code>
              }
            </div>

            @if (pr().commentCount > 0 || pr().openTaskCount > 0 || buildLabel()) {
              <div class="flex items-center gap-4 mt-2.5">
                @if (pr().commentCount > 0) {
                  <div class="flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span class="text-sm text-[var(--color-text-muted)]">{{ pr().commentCount }} Kommentar{{ pr().commentCount === 1 ? '' : 'e' }}</span>
                  </div>
                }
                @if (pr().openTaskCount > 0) {
                  <div class="flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    <span class="text-sm text-amber-700 font-medium">{{ pr().openTaskCount }} offene{{ pr().openTaskCount === 1 ? 'r Task' : ' Tasks' }}</span>
                  </div>
                }
                @if (buildLabel(); as build) {
                  <div class="flex items-center gap-1.5">
                    @if (build.type === 'failed') {
                      <svg class="w-3.5 h-3.5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    } @else if (build.type === 'running') {
                      <svg class="w-3.5 h-3.5 text-[var(--color-primary-solid)] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    } @else {
                      <svg class="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                    }
                    <span class="text-sm font-medium" [class]="build.colorClass">{{ build.text }}</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </header>

      <div #headerSentinel></div>
      <app-detail-action-bar [item]="pr()" />

      <div class="max-w-2xl mx-auto space-y-3 py-4 px-2">
        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border-subtle)] shadow-sm overflow-hidden">
          <button
            type="button"
            class="w-full text-left px-6 py-3.5 flex items-center gap-3 hover:bg-[var(--color-bg-surface)] transition-colors"
            (click)="jiraExpanded.set(!jiraExpanded())"
            [attr.aria-expanded]="jiraExpanded()"
          >
            <svg class="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 transition-transform duration-150" [class.rotate-90]="jiraExpanded()" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>
            <svg class="w-4 h-4 text-[var(--color-text-muted)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10M7 12h10M7 17h6"/></svg>
            <span class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Jira-Ticket</span>
            @if (resolvedJiraTicket(); as ticket) {
              <span class="font-mono text-xs text-[var(--color-primary-text)] font-semibold">{{ ticket.key }}</span>
              <span class="text-xs text-[var(--color-text-muted)]">— {{ ticket.status }}</span>
            }
          </button>
          @if (jiraExpanded()) {
            <div class="border-t border-[var(--color-border-subtle)] px-6 py-4">
              <app-jira-pr-card [ticket]="jiraTicket()" />
            </div>
          }
        </div>

        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border-subtle)] shadow-sm overflow-hidden">
          <button
            type="button"
            class="w-full text-left px-6 py-3.5 flex items-center gap-3 hover:bg-[var(--color-bg-surface)] transition-colors"
            (click)="descExpanded.set(!descExpanded())"
            [attr.aria-expanded]="descExpanded()"
          >
            <svg class="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 transition-transform duration-150" [class.rotate-90]="descExpanded()" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>
            <svg class="w-4 h-4 text-[var(--color-text-muted)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
            <span class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Beschreibung</span>
          </button>
          @if (descExpanded()) {
            <div class="border-t border-[var(--color-border-subtle)] px-6 pb-5 pt-4">
              @if (pr().description) {
                <div class="jira-markup" [innerHTML]="pr().description | jiraMarkup"></div>
              } @else {
                <p class="text-sm text-[var(--color-text-muted)] italic">Keine Beschreibung vorhanden.</p>
              }
            </div>
          }
        </div>

        <app-review-findings [reviewState]="aiReview.reviewState()" />

        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border-subtle)] shadow-sm overflow-hidden">
          <button
            type="button"
            class="w-full text-left px-6 py-3.5 flex items-center gap-3 hover:bg-[var(--color-bg-surface)] transition-colors"
            (click)="diffExpanded.set(!diffExpanded())"
            [attr.aria-expanded]="diffExpanded()"
          >
            <svg class="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 transition-transform duration-150" [class.rotate-90]="diffExpanded()" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>
            <svg class="w-4 h-4 text-[var(--color-text-muted)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>
            <span class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Änderungen</span>
            @if (diffFileCount() > 0) {
              <span class="text-xs text-[var(--color-text-muted)]">{{ diffFileCount() }} {{ diffFileCount() === 1 ? 'Datei' : 'Dateien' }}</span>
            }
          </button>
          @if (diffExpanded()) {
            <div class="border-t border-[var(--color-border-subtle)] px-6 py-4">
              @if (diffData() === 'loading') {
                <p class="text-sm text-[var(--color-text-muted)] italic">Änderungen laden...</p>
              } @else if (diffData() === 'error') {
                <p class="text-sm text-[var(--color-text-muted)] italic">Änderungen konnten nicht geladen werden.</p>
              } @else if (diffFileCount() === 0) {
                <p class="text-sm text-[var(--color-text-muted)] italic">Keine Änderungen vorhanden.</p>
              } @else {
                <div #diffContainer class="overflow-x-auto rounded border border-[var(--color-border-subtle)]"></div>
              }
            </div>
          }
        </div>

        <div class="h-4" aria-hidden="true"></div>
      </div>
    </article>
  `,
})
export class PrDetailComponent {
  private static hljsRegistered = false;

  pr = input.required<PullRequest>();

  private readonly jiraService = inject(JiraService);
  private readonly bitbucketService = inject(BitbucketService);
  protected readonly aiReview = inject(AiReviewService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly diffContainer = viewChild<ElementRef<HTMLElement>>('diffContainer');
  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('headerSentinel');

  readonly showCompactBar = signal(false);

  constructor() {
    if (!PrDetailComponent.hljsRegistered) {
      hljs.registerLanguage('typescript', typescript);
      hljs.registerLanguage('javascript', javascript);
      hljs.registerLanguage('xml', xml);
      hljs.registerLanguage('html', xml);
      hljs.registerLanguage('css', css);
      hljs.registerLanguage('scss', scss);
      hljs.registerLanguage('json', json);
      hljs.registerLanguage('yaml', yaml);
      hljs.registerLanguage('ini', ini);
      hljs.registerLanguage('toml', ini);
      hljs.registerLanguage('java', java);
      hljs.registerLanguage('python', python);
      hljs.registerLanguage('groovy', groovy);
      hljs.registerLanguage('dockerfile', dockerfile);
      hljs.registerLanguage('markdown', markdown);
      hljs.registerLanguage('bash', bash);
      hljs.registerLanguage('plaintext', plaintext);
      PrDetailComponent.hljsRegistered = true;
    }

    this.aiReview.reviewRequested$.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      const diff = this.diffData();
      if (diff === 'loading' || diff === 'error') return;
      const ticket = this.jiraTicket();
      const resolvedTicket = (ticket !== 'loading' && ticket !== 'error' && ticket !== 'no-ticket') ? ticket : null;
      this.aiReview.requestReview(diff, resolvedTicket);
    });

    toObservable(this.pr).pipe(
      skip(1),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.aiReview.reset());

    afterNextRender(() => {
      const sentinel = this.scrollSentinel()?.nativeElement;
      if (!sentinel) return;
      const observer = new IntersectionObserver(
        ([entry]) => this.showCompactBar.set(!entry.isIntersecting),
        { threshold: 0 }
      );
      observer.observe(sentinel);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  readonly jiraTicket = toSignal(
    toObservable(this.pr).pipe(
      map(pr => extractJiraKey(pr)),
      switchMap(key => {
        if (!key) return of('no-ticket' as const);
        return concat(
          of('loading' as const),
          this.jiraService.getTicketByKey(key).pipe(
            catchError(() => of('error' as const)),
          ),
        );
      }),
    ),
    { initialValue: 'loading' as const },
  );

  readonly jiraExpanded = signal(false);
  readonly descExpanded = signal(true);
  readonly diffExpanded = signal(false);

  readonly resolvedJiraTicket = computed(() => {
    const t = this.jiraTicket();
    return (t !== 'loading' && t !== 'error' && t !== 'no-ticket') ? t : null;
  });

  readonly statusDotClass = computed(() => prStatusDotClass(this.pr()));

  readonly diffData = toSignal(
    toObservable(this.pr).pipe(
      switchMap(pr =>
        concat(
          of('loading' as const),
          this.bitbucketService.getPullRequestDiff(pr).pipe(
            catchError(() => of('error' as const)),
          ),
        )
      ),
    ),
    { initialValue: 'loading' as const },
  );

  private readonly diffParsed = computed(() => {
    const data = this.diffData();
    if (data === 'loading' || data === 'error') return null;
    return Diff2Html.parse(data);
  });

  readonly diffFileCount = computed(() => this.diffParsed()?.length ?? 0);

  private readonly dataReady = computed(() => {
    const diff = this.diffData();
    const ticket = this.jiraTicket();
    return diff !== 'loading' && diff !== 'error' && ticket !== 'loading';
  });

  private dataReadyEffect = effect(() => {
    this.aiReview.canReview.set(this.dataReady());
  });

  private renderEffect = effect(() => {
    const container = this.diffContainer();
    if (!container) return;
    if (!this.diffExpanded()) return;
    const data = this.diffData();
    if (data === 'loading' || data === 'error') return;
    setTimeout(() => {
      const ui = new Diff2HtmlUI(container.nativeElement, data, {
        outputFormat: 'line-by-line',
        drawFileList: false,
        matching: 'lines',
        diffStyle: 'word',
        colorScheme: ColorSchemeType.LIGHT,
      }, hljs);
      ui.draw();
      ui.highlightCode();
    });
  });

  authorInitials = computed(() =>
    this.pr().author.user.displayName
      .split(' ')
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2)
  );

  isNonDefaultTarget = computed(() => {
    const target = this.pr().toRef.displayId;
    return target !== 'main' && target !== 'master';
  });

  stripeClass = computed(() => prStripeClass(this.pr()));
  statusBadgeClass = computed(() => prStatusBadgeClass(this.pr()));
  statusLabel = computed(() => prStatusLabel(this.pr()));

  buildLabel = computed((): { type: 'success' | 'failed' | 'running'; text: string; colorClass: string } | null => {
    if (!this.pr().isAuthoredByMe) return null;
    const build = this.pr().buildStatus;
    if (!build) return null;
    if (build.failed > 0) return { type: 'failed', text: 'Build fehlgeschlagen', colorClass: 'text-red-600' };
    if (build.inProgress > 0) return { type: 'running', text: 'Build läuft', colorClass: 'text-[var(--color-primary-text)]' };
    if (build.successful > 0) return { type: 'success', text: 'Build erfolgreich', colorClass: 'text-emerald-600' };
    return null;
  });
}
