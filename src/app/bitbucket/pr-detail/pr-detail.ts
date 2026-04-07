import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, concat, map, of, skip, switchMap } from 'rxjs';
import { PullRequest } from '../../shared/work-item.model';
import { prStatusColor, prStatusLabel, prStripeClass, reviewerStatusColor } from '../pr-status';
import { BadgeComponent } from '../../shared/badge/badge';
import { JiraMarkupPipe } from '../../jira/jira-markup.pipe';
import { BitbucketService } from '../bitbucket.service';
import { JiraService } from '../../jira/jira.service';
import { JiraPrCardComponent } from '../../jira/jira-pr-card/jira-pr-card';
import { ReviewFindingsComponent } from '../../review/review-findings/review-findings';
import { CompactHeaderBarComponent } from '../../shared/compact-header-bar/compact-header-bar';
import { DetailActionBarComponent } from '../../shared/detail-action-bar/detail-action-bar';
import { CollapsibleSectionComponent } from '../../shared/collapsible-section/collapsible-section';
import { AiReviewService } from '../../review/ai-review.service';
import { SettingsService } from '../../settings/settings.service';
import { extractJiraKey } from '../pr-jira-key';
import {
  LucideCheck,
  LucideCircleAlert,
  LucideX,
  LucideArrowRight,
  LucideMessageSquare,
  LucideSquareCheck,
  LucideLoaderCircle,
  LucideSparkles,
  LucideNotepadText,
  LucideFileText,
  LucideFile,
} from '@lucide/angular';
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
  imports: [
    DatePipe,
    JiraMarkupPipe,
    JiraPrCardComponent,
    ReviewFindingsComponent,
    CompactHeaderBarComponent,
    DetailActionBarComponent,
    CollapsibleSectionComponent,
    BadgeComponent,
    LucideCheck,
    LucideCircleAlert,
    LucideX,
    LucideArrowRight,
    LucideMessageSquare,
    LucideSquareCheck,
    LucideLoaderCircle,
    LucideSparkles,
    LucideNotepadText,
    LucideFileText,
    LucideFile,
  ],
  styles: [
    `
      @keyframes prFadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      :host {
        display: block;
        animation: prFadeIn 0.15s ease-out;
      }
    `,
  ],
  template: `
    <article [attr.aria-label]="(pr().isAuthoredByMe ? 'Mein PR: ' : 'PR: ') + pr().title">
      <app-compact-header-bar
        [visible]="showCompactBar()"
        [title]="pr().title"
        [statusLabel]="statusLabel()"
        [statusColor]="statusColor()"
        [stripeColor]="stripeClass()"
        [prefix]="pr().fromRef.repository.slug"
      />

      @if (pr().myReviewStatus === 'Ready to Merge') {
        <div
          class="bg-[var(--color-success-bg)] border-b border-[var(--color-success-border)]"
          role="status"
        >
          <div class="max-w-2xl mx-auto px-6 py-2.5 flex items-center gap-2">
            <svg lucideCheck class="text-[var(--color-success-text)] shrink-0" [size]="16"></svg>
            <span class="text-sm font-medium text-[var(--color-success-text)]"
              >Alle Reviewer haben zugestimmt — bereit zum Mergen.</span
            >
          </div>
        </div>
      }

      @if (pr().isDraft) {
        <div
          class="bg-[var(--color-signal-bg)] border-b border-[var(--color-signal-border)]"
          role="status"
        >
          <div class="max-w-2xl mx-auto px-6 py-2.5 flex items-center gap-2">
            <svg lucideCircleAlert class="text-[var(--color-signal-text)] shrink-0" [size]="16"></svg>
            <span class="text-sm font-medium text-[var(--color-signal-text)]"
              >Entwurf — dieser PR ist noch nicht bereit zum Review oder Mergen.</span
            >
          </div>
        </div>
      }

      <header class="bg-[var(--color-bg-card)] border-b border-[var(--color-border-subtle)]">
        <div class="max-w-2xl mx-auto relative">
          <div
            class="absolute left-0 top-0 bottom-0 w-[3px]"
            [class]="stripeClass()"
            aria-hidden="true"
          ></div>

          <div class="px-6 pt-5 pb-4 pl-7">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span
                class="font-mono text-xs font-semibold text-[var(--color-text-muted)] tracking-wide"
                >{{ pr().fromRef.repository.slug }}</span
              >
              <span class="text-[var(--color-text-muted)]" aria-hidden="true">&middot;</span>
              <orbit-badge [color]="statusColor()" [status]="true">{{ statusLabel() }}</orbit-badge>
              @if (pr().isAuthoredByMe) {
                <orbit-badge color="neutral" [uppercase]="true" size="sm">Dein PR</orbit-badge>
              }
              @if (pr().isDraft) {
                <orbit-badge color="signal" [uppercase]="true" size="sm">Entwurf</orbit-badge>
              }
            </div>

            <h1 class="text-lg font-semibold text-[var(--color-text-heading)] leading-snug mb-2">
              {{ pr().title }}
            </h1>

            @if (pr().isAuthoredByMe) {
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm text-[var(--color-text-muted)]">
                  erstellt {{ pr().createdDate | date: 'dd.MM.yyyy' }}
                  <span class="text-[var(--color-text-muted)] mx-1" aria-hidden="true"
                    >&middot;</span
                  >geändert {{ pr().updatedDate | date: 'dd.MM.yyyy' }}
                </p>
              </div>
              @if (pr().reviewers.length > 0) {
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  <span class="text-sm text-[var(--color-text-muted)] font-medium shrink-0"
                    >Reviewer:</span
                  >
                  @for (reviewer of pr().reviewers; track reviewer.user.id) {
                    <orbit-badge [color]="reviewerColor(reviewer.status)" size="sm">
                      @if (reviewer.status === 'APPROVED') {
                        <svg lucideCheck [size]="12" [strokeWidth]="2.5"></svg>
                      } @else if (reviewer.status === 'NEEDS_WORK') {
                        <svg lucideX [size]="12" [strokeWidth]="2.5"></svg>
                      }
                      {{ reviewer.user.displayName }}
                    </orbit-badge>
                  }
                </div>
              }
            } @else {
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-bg-surface)] text-[var(--color-text-body)] text-[9px] font-bold shrink-0"
                  aria-hidden="true"
                  >{{ authorInitials() }}</span
                >
                <p class="text-sm text-[var(--color-text-muted)]">
                  von
                  <span class="text-[var(--color-text-muted)] font-medium">{{
                    pr().author.user.displayName
                  }}</span>
                  <span class="text-[var(--color-text-muted)] mx-1" aria-hidden="true"
                    >&middot;</span
                  >erstellt {{ pr().createdDate | date: 'dd.MM.yyyy' }}
                  <span class="text-[var(--color-text-muted)] mx-1" aria-hidden="true"
                    >&middot;</span
                  >geändert {{ pr().updatedDate | date: 'dd.MM.yyyy' }}
                </p>
              </div>
            }

            <div class="flex items-center gap-2 mt-3 flex-wrap">
              <span class="text-sm text-[var(--color-text-muted)] font-medium shrink-0">von</span>
              <code
                class="font-mono text-[13px] text-[var(--color-text-body)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5 break-all"
                >{{ pr().fromRef.displayId }}</code
              >
              <svg lucideArrowRight class="text-[var(--color-text-muted)] shrink-0" [size]="14"></svg>
              @if (isNonDefaultTarget()) {
                <code
                  class="font-mono text-[13px] text-amber-700 font-semibold bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5 break-all"
                  >{{ pr().toRef.displayId }}</code
                >
              } @else {
                <code
                  class="font-mono text-[13px] text-[var(--color-text-body)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5 break-all"
                  >{{ pr().toRef.displayId }}</code
                >
              }
            </div>

            @if (pr().commentCount > 0 || pr().openTaskCount > 0 || buildLabel()) {
              <div class="flex items-center gap-4 mt-2.5">
                @if (pr().commentCount > 0) {
                  <div class="flex items-center gap-1.5">
                    <svg lucideMessageSquare class="text-[var(--color-text-muted)]" [size]="14"></svg>
                    <span class="text-sm text-[var(--color-text-muted)]"
                      >{{ pr().commentCount }} Kommentar{{
                        pr().commentCount === 1 ? '' : 'e'
                      }}</span
                    >
                  </div>
                }
                @if (pr().openTaskCount > 0) {
                  <div class="flex items-center gap-1.5">
                    <svg lucideSquareCheck class="text-[var(--color-signal-text)]" [size]="14"></svg>
                    <span class="text-sm text-[var(--color-signal-text)] font-medium"
                      >{{ pr().openTaskCount }} offene{{
                        pr().openTaskCount === 1 ? 'r Task' : ' Tasks'
                      }}</span
                    >
                  </div>
                }
                @if (buildLabel(); as build) {
                  <div class="flex items-center gap-1.5">
                    @if (build.type === 'failed') {
                      <svg lucideX class="text-[var(--color-danger-text)]" [size]="14"></svg>
                    } @else if (build.type === 'running') {
                      <svg lucideLoaderCircle class="text-[var(--color-primary-solid)] animate-spin" [size]="14"></svg>
                    } @else {
                      <svg lucideCheck class="text-[var(--color-success-text)]" [size]="14"></svg>
                    }
                    <span class="text-sm font-medium" [class]="build.colorClass">{{
                      build.text
                    }}</span>
                  </div>
                }
              </div>
            }
          </div>

          <app-detail-action-bar [item]="pr()" />
        </div>
      </header>

      <div #headerSentinel></div>

      <div class="max-w-2xl mx-auto space-y-3 py-4 px-2">
        <app-collapsible-section label="Jira-Ticket">
          <svg lucideNotepadText sectionIcon class="text-[var(--color-text-muted)] shrink-0" [size]="16"></svg>
          <ng-container sectionMeta>
            @if (resolvedJiraTicket(); as ticket) {
              <span class="font-mono text-xs text-[var(--color-primary-text)] font-semibold">{{
                ticket.key
              }}</span>
              <span class="text-xs text-[var(--color-text-muted)]">— {{ ticket.status }}</span>
            }
          </ng-container>
          <app-jira-pr-card [ticket]="jiraTicket()" />
        </app-collapsible-section>

        <app-collapsible-section label="Beschreibung" [expanded]="true">
          <svg lucideFileText sectionIcon class="text-[var(--color-text-muted)] shrink-0" [size]="16"></svg>
          @if (pr().description) {
            <div class="jira-markup" [innerHTML]="pr().description | jiraMarkup"></div>
          } @else {
            <p class="text-sm text-[var(--color-text-muted)] italic">
              Keine Beschreibung vorhanden.
            </p>
          }
        </app-collapsible-section>

        @if (settingsService.aiReviewsEnabled()) {
          <app-review-findings [reviewState]="aiReview.reviewState()" />
        } @else {
          <div
            class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border-subtle)] px-6 py-4 flex items-center gap-3"
          >
            <svg lucideSparkles class="shrink-0 text-[var(--color-text-muted)]" [size]="20" [strokeWidth]="1.5"></svg>
            <p class="text-sm text-[var(--color-text-muted)]">
              KI-gestützte Reviews können in den Einstellungen aktiviert werden.
            </p>
          </div>
        }

        <app-collapsible-section label="Änderungen">
          <svg lucideFile sectionIcon class="text-[var(--color-text-muted)] shrink-0" [size]="16"></svg>
          <ng-container sectionMeta>
            @if (diffFileCount() > 0) {
              <span class="text-xs text-[var(--color-text-muted)]"
                >{{ diffFileCount() }} {{ diffFileCount() === 1 ? 'Datei' : 'Dateien' }}</span
              >
            }
          </ng-container>
          @if (diffData() === 'loading') {
            <p class="text-sm text-[var(--color-text-muted)] italic">Änderungen laden...</p>
          } @else if (diffData() === 'error') {
            <p class="text-sm text-[var(--color-text-muted)] italic">
              Änderungen konnten nicht geladen werden.
            </p>
          } @else if (diffFileCount() === 0) {
            <p class="text-sm text-[var(--color-text-muted)] italic">Keine Änderungen vorhanden.</p>
          } @else {
            <div
              #diffContainer
              class="overflow-x-auto rounded border border-[var(--color-border-subtle)]"
            ></div>
          }
        </app-collapsible-section>

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
  protected readonly settingsService = inject(SettingsService);
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

    this.aiReview.reviewRequested$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const diff = this.diffData();
      if (diff === 'loading' || diff === 'error') return;
      const ticket = this.jiraTicket();
      const resolvedTicket =
        ticket !== 'loading' && ticket !== 'error' && ticket !== 'no-ticket' ? ticket : null;
      this.aiReview.requestReview(diff, resolvedTicket);
    });

    toObservable(this.pr)
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.aiReview.reset());

    afterNextRender(() => {
      const sentinel = this.scrollSentinel()?.nativeElement;
      if (!sentinel) return;
      const observer = new IntersectionObserver(
        ([entry]) => this.showCompactBar.set(!entry.isIntersecting),
        { threshold: 0 },
      );
      observer.observe(sentinel);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  readonly jiraTicket = toSignal(
    toObservable(this.pr).pipe(
      map((pr) => extractJiraKey(pr)),
      switchMap((key) => {
        if (!key) return of('no-ticket' as const);
        return concat(
          of('loading' as const),
          this.jiraService.getTicketByKey(key).pipe(catchError(() => of('error' as const))),
        );
      }),
    ),
    { initialValue: 'loading' as const },
  );

  readonly resolvedJiraTicket = computed(() => {
    const t = this.jiraTicket();
    return t !== 'loading' && t !== 'error' && t !== 'no-ticket' ? t : null;
  });

  readonly diffData = toSignal(
    toObservable(this.pr).pipe(
      switchMap((pr) =>
        concat(
          of('loading' as const),
          this.bitbucketService.getPullRequestDiff(pr).pipe(catchError(() => of('error' as const))),
        ),
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
    const data = this.diffData();
    if (data === 'loading' || data === 'error') return;
    setTimeout(() => {
      const ui = new Diff2HtmlUI(
        container.nativeElement,
        data,
        {
          outputFormat: 'line-by-line',
          drawFileList: false,
          matching: 'lines',
          diffStyle: 'word',
          colorScheme: ColorSchemeType.LIGHT,
        },
        hljs,
      );
      ui.draw();
      ui.highlightCode();
    });
  });

  authorInitials = computed(() =>
    this.pr()
      .author.user.displayName.split(' ')
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2),
  );

  isNonDefaultTarget = computed(() => {
    const target = this.pr().toRef.displayId;
    return target !== 'main' && target !== 'master';
  });

  stripeClass = computed(() => prStripeClass(this.pr()));
  statusLabel = computed(() => prStatusLabel(this.pr()));
  statusColor = computed(() => prStatusColor(this.pr()));

  reviewerColor(status: string) {
    return reviewerStatusColor(status);
  }

  buildLabel = computed(
    (): { type: 'success' | 'failed' | 'running'; text: string; colorClass: string } | null => {
      if (!this.pr().isAuthoredByMe) return null;
      const build = this.pr().buildStatus;
      if (!build) return null;
      if (build.failed > 0)
        return {
          type: 'failed',
          text: 'Build fehlgeschlagen',
          colorClass: 'text-[var(--color-danger-text)]',
        };
      if (build.inProgress > 0)
        return {
          type: 'running',
          text: 'Build läuft',
          colorClass: 'text-[var(--color-primary-text)]',
        };
      if (build.successful > 0)
        return {
          type: 'success',
          text: 'Build erfolgreich',
          colorClass: 'text-[var(--color-success-text)]',
        };
      return null;
    },
  );
}
