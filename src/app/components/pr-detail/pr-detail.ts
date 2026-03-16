import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, concat, map, of, switchMap } from 'rxjs';
import { PullRequest, PrStatus } from '../../models/work-item.model';
import { JiraMarkupPipe } from '../../pipes/jira-markup.pipe';
import { JiraService } from '../../services/jira.service';
import { JiraPrCardComponent } from '../jira-pr-card/jira-pr-card';
import { extractJiraKey } from '../pr-jira-key';

@Component({
  selector: 'app-pr-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, JiraMarkupPipe, JiraPrCardComponent],
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
    <article [attr.aria-label]="'PR: ' + pr().title">

      @if (pr().isDraft) {
        <div class="bg-amber-50 border-b border-amber-200" role="status">
          <div class="max-w-2xl mx-auto px-6 py-2.5 flex items-center gap-2">
            <svg class="w-4 h-4 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span class="text-xs font-semibold text-amber-700">Entwurf – dieser PR ist noch nicht bereit zum Review oder Mergen.</span>
          </div>
        </div>
      }

      <header class="sticky top-0 z-10 bg-white border-b border-stone-200">
        <div class="max-w-2xl mx-auto relative">
          <div class="absolute left-0 top-0 bottom-0 w-[3px]" [class]="stripeClass()" aria-hidden="true"></div>

          <div class="px-6 pt-5 pb-4 pl-7">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div class="flex items-center gap-2 min-w-0 flex-wrap">
                <span class="font-mono text-xs font-semibold text-stone-400 shrink-0 truncate max-w-[140px]">{{ pr().fromRef.repository.slug }}</span>
                <span class="text-stone-300 shrink-0" aria-hidden="true">·</span>
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border leading-none shrink-0"
                  [class]="statusBadgeClass()"
                >{{ pr().myReviewStatus }}</span>
                @if (pr().isDraft) {
                  <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 leading-none uppercase tracking-wide shrink-0">
                    Entwurf
                  </span>
                }
              </div>

            </div>

            <h1 class="text-lg font-semibold text-stone-900 leading-snug mb-3">{{ pr().title }}</h1>

            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-stone-200 text-stone-600 text-[9px] font-bold shrink-0"
                aria-hidden="true"
              >{{ authorInitials() }}</span>
              <p class="text-xs text-stone-400 leading-relaxed">
                von <span class="text-stone-500 font-medium">{{ pr().author.user.displayName }}</span>
                <span aria-hidden="true"> · </span>erstellt {{ pr().createdDate | date:'dd.MM.yyyy' }}
                <span aria-hidden="true"> · </span>geändert {{ pr().updatedDate | date:'dd.MM.yyyy' }}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section class="border-b border-stone-100" aria-labelledby="pr-jira-heading">
        <div class="max-w-2xl mx-auto px-6 py-5">
          <h2 id="pr-jira-heading" class="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Jira-Ticket</h2>
          <app-jira-pr-card [ticket]="jiraTicket()" />
        </div>
      </section>

      <section class="border-b border-stone-100" aria-labelledby="pr-desc-heading">
        <div class="max-w-2xl mx-auto px-6 py-5">
          <h2 id="pr-desc-heading" class="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Beschreibung</h2>
          @if (pr().description) {
            <div class="jira-markup" [innerHTML]="pr().description | jiraMarkup"></div>
          } @else {
            <p class="text-sm text-stone-400 italic">Keine Beschreibung vorhanden.</p>
          }
        </div>
      </section>

      <section class="border-b border-stone-100" aria-label="Weitere Informationen">
        <div class="max-w-2xl mx-auto px-6 py-4">
          <dl class="space-y-2.5">
            <div class="flex items-baseline gap-2">
              <dt class="text-[10px] font-semibold text-stone-400 uppercase tracking-wider shrink-0 w-24">Von Branch</dt>
              <dd class="font-mono text-[11.5px] text-stone-600 truncate">{{ pr().fromRef.displayId }}</dd>
            </div>

            @if (isNonDefaultTarget()) {
              <div class="flex items-baseline gap-2">
                <dt class="text-[10px] font-semibold text-stone-400 uppercase tracking-wider shrink-0 w-24">Nach Branch</dt>
                <dd class="font-mono text-[11.5px] text-amber-700 font-semibold truncate">{{ pr().toRef.displayId }}</dd>
              </div>
            } @else {
              <div class="flex items-baseline gap-2">
                <dt class="text-[10px] font-semibold text-stone-400 uppercase tracking-wider shrink-0 w-24">Nach Branch</dt>
                <dd class="font-mono text-[11.5px] text-stone-500 truncate">{{ pr().toRef.displayId }}</dd>
              </div>
            }

            @if (pr().commentCount > 0 || pr().openTaskCount > 0) {
              <div class="flex items-center gap-4">
                @if (pr().commentCount > 0) {
                  <div class="flex items-center gap-1.5">
                    <svg class="w-3 h-3 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span class="text-xs text-stone-600">{{ pr().commentCount }} Kommentar{{ pr().commentCount === 1 ? '' : 'e' }}</span>
                  </div>
                }
                @if (pr().openTaskCount > 0) {
                  <div class="flex items-center gap-1.5">
                    <svg class="w-3 h-3 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    <span class="text-xs text-amber-700 font-medium">{{ pr().openTaskCount }} offene{{ pr().openTaskCount === 1 ? 'r Task' : ' Tasks' }}</span>
                  </div>
                }
              </div>
            }
          </dl>
        </div>
      </section>

      <div class="h-6" aria-hidden="true"></div>
    </article>
  `,
})
export class PrDetailComponent {
  pr = input.required<PullRequest>();

  private readonly jiraService = inject(JiraService);

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

  stripeClass = computed((): string => {
    if (this.pr().isDraft) return 'bg-amber-300';
    const map: Record<PrStatus, string> = {
      'Awaiting Review': 'bg-indigo-400',
      'Needs Re-review': 'bg-amber-500',
      'Changes Requested': 'bg-stone-300',
      'Approved': 'bg-emerald-500',
      'Approved by Others': 'bg-stone-300',
    };
    return map[this.pr().myReviewStatus] ?? 'bg-stone-300';
  });

  statusBadgeClass = computed((): string => {
    const map: Record<PrStatus, string> = {
      'Awaiting Review': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'Needs Re-review': 'bg-amber-50 text-amber-800 border-amber-300',
      'Changes Requested': 'bg-stone-100 text-stone-500 border-stone-200',
      'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Approved by Others': 'bg-stone-100 text-stone-500 border-stone-200',
    };
    return map[this.pr().myReviewStatus] ?? 'bg-stone-100 text-stone-500 border-stone-200';
  });
}
