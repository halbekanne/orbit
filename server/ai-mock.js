let skipDelays = false;

function setSkipDelays(val) {
  skipDelays = val;
}

function delay(min, max) {
  if (skipDelays) return Promise.resolve();
  const ms = Math.random() * (max - min) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const FINDINGS = {
  akAbgleich: {
    severity: 'critical',
    category: 'ak-abgleich',
    title: 'Hover-State für primären Button fehlt',
    file: 'src/components/button/button.styles.scss',
    line: 42,
    detail: 'Laut AK muss der primäre Button einen sichtbaren Hover-State haben. Die aktuelle Implementierung definiert keinen :hover-Selektor.',
    suggestion: 'Einen :hover-Selektor mit leicht abgedunkelter Hintergrundfarbe ergänzen.',
    codeSnippet: '+  background-color: var(--btn-primary-bg);',
  },
  codeQuality1: {
    severity: 'important',
    category: 'code-quality',
    title: 'Typ-Assertion statt Type Guard',
    file: 'src/components/button/button.ts',
    line: 87,
    detail: 'Die Typ-Assertion `as ButtonVariant` umgeht die Typprüfung. Ein Type Guard wäre sicherer und erkennt ungültige Werte zur Laufzeit.',
    suggestion: 'Einen Type Guard `isButtonVariant()` implementieren und vor dem Zugriff prüfen.',
    codeSnippet: '+    const variant = value as ButtonVariant;',
  },
  codeQuality2: {
    severity: 'minor',
    category: 'code-quality',
    title: 'Doppelte Berechnung in render()',
    file: 'src/components/button/button.ts',
    line: 112,
    detail: 'Die CSS-Klasse wird bei jedem Render-Zyklus neu berechnet, obwohl sich die Inputs nicht geändert haben.',
    suggestion: 'Berechnung in ein `willUpdate()` mit Dirty-Check verschieben.',
    codeSnippet: '+    const classes = this.computeClasses();',
  },
  eventListener: {
    severity: 'important',
    category: 'code-quality',
    title: 'Event-Listener wird nicht aufgeräumt',
    file: 'src/components/tooltip/tooltip.ts',
    line: 34,
    detail: 'Der `mouseenter`-Listener wird in `connectedCallback` registriert, aber in `disconnectedCallback` nicht entfernt. Das führt zu Memory Leaks bei häufigem Mount/Unmount.',
    suggestion: 'Listener-Referenz speichern und in `disconnectedCallback` via `removeEventListener` aufräumen.',
    codeSnippet: "+    this.addEventListener('mouseenter', this.onHover);",
  },
  nullCheck: {
    severity: 'minor',
    category: 'code-quality',
    title: 'Unnötiger Nullcheck',
    file: 'src/components/tooltip/tooltip.ts',
    line: 58,
    detail: 'Die Property `content` ist als `@property()` deklariert und hat einen Default-Wert. Der Nullcheck in Zeile 58 greift nie.',
    suggestion: 'Nullcheck entfernen, da `content` immer definiert ist.',
    codeSnippet: '+    if (this.content != null) {',
  },
  shadowDom: {
    severity: 'important',
    category: 'code-quality',
    title: 'Shadow DOM Styling Leak',
    file: 'src/components/card/card.styles.scss',
    line: 15,
    detail: 'Der `:host` Selektor fehlt. Styles können in den umgebenden DOM leaken wenn die Komponente ohne Shadow DOM genutzt wird.',
    suggestion: 'Alle Top-Level-Styles in `:host { }` wrappen.',
    codeSnippet: '+  .card-container {',
  },
  a11yMissingRole: {
    severity: 'critical',
    category: 'accessibility',
    title: 'Icon-Button ohne zugänglichen Namen',
    file: 'src/components/close-button.ts',
    line: 12,
    detail: 'Der Schließen-Button ist ein <div> ohne Rolle, ohne zugänglichen Namen und ohne Tastaturunterstützung. Screenreader-Nutzer können dieses Element weder finden noch bedienen.',
    suggestion: 'Semantisches <button>-Element verwenden und aria-label ergänzen: <button aria-label="Dialog schließen" @click=${this.onClose}>✕</button>',
    codeSnippet: '+    <div class="close" @click=${this.onClose}>✕</div>',
    wcagCriterion: '4.1.2 Name, Rolle, Wert',
  },
  a11yShadowRef: {
    severity: 'important',
    category: 'accessibility',
    title: 'ID-Referenz über Shadow-DOM-Grenze',
    file: 'src/components/form-field.ts',
    line: 28,
    detail: 'aria-labelledby referenziert eine ID außerhalb des Shadow DOM. Diese Referenz funktioniert nicht über Shadow-Grenzen hinweg — der zugängliche Name bleibt leer.',
    suggestion: 'aria-label direkt am Element verwenden statt aria-labelledby mit externer ID.',
    codeSnippet: '+    <input aria-labelledby="external-label">',
    wcagCriterion: '4.1.2 Name, Rolle, Wert',
  },
};

const SCENARIOS = [
  {
    name: 'Mehrere Findings (mixed)',
    async run(emit) {
      emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2, thinkingBudget: 16384 });
      emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4, thinkingBudget: 16384 });
      emit('agent:start', { agent: 'accessibility', label: 'Barrierefreiheit', temperature: 0.3, thinkingBudget: 16384 });

      await delay(1000, 2000);
      const akFindings = [FINDINGS.akAbgleich];
      emit('agent:done', {
        agent: 'ak-abgleich',
        duration: 1200,
        findingCount: akFindings.length,
        summary: '1 Auffälligkeit: 1 Kritisch',
        rawResponse: { findings: akFindings },
        thoughts: 'Analyzing ticket description...\nFound 3 Akzeptanzkriterien.\nAK-1: Hover state — checking diff... NOT FOUND.\nAK-2: Focus ring — FOUND.\nAK-3: Disabled state — FOUND.',
      });

      await delay(1000, 2000);
      const cqFindings = [FINDINGS.codeQuality1, FINDINGS.codeQuality2];
      emit('agent:done', {
        agent: 'code-quality',
        duration: 1500,
        findingCount: cqFindings.length,
        summary: '2 Auffälligkeiten: 1 Wichtig, 1 Gering',
        rawResponse: { findings: cqFindings },
        thoughts: 'Scanning diff for code quality issues...\nFile: button.ts — type assertion on line 87, should use type guard.\nFile: button.ts — render() recomputes classes unnecessarily.',
      });

      emit('agent:done', {
        agent: 'accessibility',
        duration: 1200,
        findingCount: 0,
        summary: 'Keine Auffälligkeiten',
        rawResponse: { findings: [] },
        thoughts: 'No accessibility issues found in the diff.',
      });

      emit('consolidator:start', { temperature: 0.2, thinkingBudget: 16384 });
      await delay(500, 1000);

      const consolidatedFindings = [FINDINGS.akAbgleich, FINDINGS.codeQuality1];
      const decisions = [
        { agent: 'ak-abgleich', action: 'kept', reason: 'Klares AK-Gap, Kritisch', finding: FINDINGS.akAbgleich.title },
        { agent: 'code-quality', action: 'kept', reason: 'Typ-Sicherheit relevant', finding: FINDINGS.codeQuality1.title },
        { agent: 'code-quality', action: 'removed', reason: 'Duplikat / zu geringfügig', finding: FINDINGS.codeQuality2.title },
      ];
      const rawResponse = { findings: consolidatedFindings, decisions, summary: '2 Auffälligkeiten: 1 Kritisch, 1 Wichtig' };

      emit('consolidator:done', {
        duration: 800,
        result: {
          findings: consolidatedFindings,
          summary: '2 Auffälligkeiten: 1 Kritisch, 1 Wichtig',
          warnings: [],
          reviewedAt: new Date().toISOString(),
        },
        decisions,
        summary: '3 Findings geprüft, 1 gefiltert, 2 übernommen',
        rawResponse,
        thoughts: 'Checking grounding for 3 findings...\nFinding "Hover-State fehlt": snippet found in diff. KEEP.\nFinding "Typ-Assertion": snippet found. KEEP.\nFinding "Doppelte Berechnung": snippet found but trivial. REMOVE.',
      });

      emit('done', {});
    },
  },
  {
    name: 'Keine Findings',
    async run(emit) {
      emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2, thinkingBudget: 16384 });
      emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4, thinkingBudget: 16384 });
      emit('agent:start', { agent: 'accessibility', label: 'Barrierefreiheit', temperature: 0.3, thinkingBudget: 16384 });

      await delay(1000, 2000);
      emit('agent:done', {
        agent: 'ak-abgleich',
        duration: 1100,
        findingCount: 0,
        summary: 'Keine Auffälligkeiten',
        rawResponse: { findings: [] },
        thoughts: 'Analyzing diff... All AK covered. No gaps found.',
      });

      await delay(1000, 2000);
      emit('agent:done', {
        agent: 'code-quality',
        duration: 1300,
        findingCount: 0,
        summary: 'Keine Auffälligkeiten',
        rawResponse: { findings: [] },
        thoughts: 'Scanning diff... Code structure is clean. No issues found.',
      });

      emit('agent:done', {
        agent: 'accessibility',
        duration: 1200,
        findingCount: 0,
        summary: 'Keine Auffälligkeiten',
        rawResponse: { findings: [] },
        thoughts: 'No accessibility issues found in the diff.',
      });

      emit('done', {});
    },
  },
  {
    name: 'Nur Code-Quality',
    async run(emit) {
      emit('warning', { message: 'Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.' });
      emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4, thinkingBudget: 16384 });
      emit('agent:start', { agent: 'accessibility', label: 'Barrierefreiheit', temperature: 0.3, thinkingBudget: 16384 });

      await delay(1000, 2000);
      const cqFindings = [FINDINGS.eventListener, FINDINGS.nullCheck];
      emit('agent:done', {
        agent: 'code-quality',
        duration: 1400,
        findingCount: cqFindings.length,
        summary: '2 Auffälligkeiten: 1 Wichtig, 1 Gering',
        rawResponse: { findings: cqFindings },
        thoughts: 'Scanning diff for code quality issues...\nFile: tooltip.ts — event listener not cleaned up in disconnectedCallback.\nFile: tooltip.ts — unnecessary null check on line 58.',
      });

      emit('agent:done', {
        agent: 'accessibility',
        duration: 1200,
        findingCount: 0,
        summary: 'Keine Auffälligkeiten',
        rawResponse: { findings: [] },
        thoughts: 'No accessibility issues found in the diff.',
      });

      emit('consolidator:start', { temperature: 0.2, thinkingBudget: 16384 });
      await delay(500, 1000);

      const decisions = [
        { agent: 'code-quality', action: 'kept', reason: 'Memory Leak ist relevant', finding: FINDINGS.eventListener.title },
        { agent: 'code-quality', action: 'kept', reason: 'Toter Code sollte entfernt werden', finding: FINDINGS.nullCheck.title },
      ];
      const rawResponse = { findings: cqFindings, decisions, summary: '2 Auffälligkeiten: 1 Wichtig, 1 Gering' };

      emit('consolidator:done', {
        duration: 700,
        result: {
          findings: cqFindings,
          summary: '2 Auffälligkeiten: 1 Wichtig, 1 Gering',
          warnings: ['Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.'],
          reviewedAt: new Date().toISOString(),
        },
        decisions,
        summary: '2 Findings übernommen',
        rawResponse,
        thoughts: 'Checking grounding for 2 findings...\nFinding "Event-Listener wird nicht aufgeräumt": listener registration found in diff. KEEP.\nFinding "Unnötiger Nullcheck": null check line found in diff. KEEP.',
      });

      emit('done', {});
    },
  },
  {
    name: 'Partial Failure',
    async run(emit) {
      emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2, thinkingBudget: 16384 });
      emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4, thinkingBudget: 16384 });
      emit('agent:start', { agent: 'accessibility', label: 'Barrierefreiheit', temperature: 0.3, thinkingBudget: 16384 });

      await delay(1000, 2000);
      emit('agent:error', { agent: 'ak-abgleich', error: 'AI API error: 503 — Service Unavailable' });

      await delay(1000, 2000);
      const cqFindings = [FINDINGS.shadowDom];
      emit('agent:done', {
        agent: 'code-quality',
        duration: 1600,
        findingCount: cqFindings.length,
        summary: '1 Auffälligkeit: 1 Wichtig',
        rawResponse: { findings: cqFindings },
        thoughts: 'Scanning diff for code quality issues...\nFile: card.styles.scss — missing :host selector, styles may leak.',
      });

      emit('agent:done', {
        agent: 'accessibility',
        duration: 1200,
        findingCount: 0,
        summary: 'Keine Auffälligkeiten',
        rawResponse: { findings: [] },
        thoughts: 'No accessibility issues found in the diff.',
      });

      emit('consolidator:start', { temperature: 0.2, thinkingBudget: 16384 });
      await delay(500, 1000);

      const decisions = [
        { agent: 'code-quality', action: 'kept', reason: 'Valides Styling-Problem', finding: FINDINGS.shadowDom.title },
      ];
      const rawResponse = { findings: cqFindings, decisions, summary: '1 Auffälligkeit: 1 Wichtig' };

      emit('consolidator:done', {
        duration: 600,
        result: {
          findings: cqFindings,
          summary: '1 Auffälligkeit: 1 Wichtig',
          warnings: ['Agent 1 (AK-Abgleich) fehlgeschlagen: AI API error: 503 — Service Unavailable'],
          reviewedAt: new Date().toISOString(),
        },
        decisions,
        summary: '1 Findings übernommen',
        rawResponse,
        thoughts: 'Checking grounding for 1 finding...\nFinding "Shadow DOM Styling Leak": missing :host selector visible in diff. KEEP.',
      });

      emit('done', {});
    },
  },
  {
    name: 'Mit Barrierefreiheits-Findings',
    async run(emit) {
      emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2, thinkingBudget: 16384 });
      emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4, thinkingBudget: 16384 });
      emit('agent:start', { agent: 'accessibility', label: 'Barrierefreiheit', temperature: 0.3, thinkingBudget: 16384 });

      await delay(1000, 2000);
      emit('agent:done', {
        agent: 'ak-abgleich',
        duration: 1100,
        findingCount: 0,
        summary: 'Keine Auffälligkeiten',
        rawResponse: { findings: [] },
        thoughts: 'Analyzing diff... All AK covered. No gaps found.',
      });

      await delay(1000, 2000);
      const cqFindings = [FINDINGS.codeQuality1];
      emit('agent:done', {
        agent: 'code-quality',
        duration: 1400,
        findingCount: cqFindings.length,
        summary: '1 Auffälligkeit: 1 Wichtig',
        rawResponse: { findings: cqFindings },
        thoughts: 'Scanning diff for code quality issues...\nFile: button.ts — type assertion on line 87, should use type guard.',
      });

      await delay(1000, 2000);
      const a11yFindings = [FINDINGS.a11yMissingRole, FINDINGS.a11yShadowRef];
      emit('agent:done', {
        agent: 'accessibility',
        duration: 1300,
        findingCount: a11yFindings.length,
        summary: '2 Auffälligkeiten: 1 Kritisch, 1 Wichtig',
        rawResponse: { findings: a11yFindings },
        thoughts: 'Scanning diff for accessibility issues...\nFile: close-button.ts — div used as button without role or accessible name.\nFile: form-field.ts — aria-labelledby references external ID across Shadow DOM boundary.',
      });

      emit('consolidator:start', { temperature: 0.2, thinkingBudget: 16384 });
      await delay(500, 1000);

      const consolidatedFindings = [FINDINGS.codeQuality1, FINDINGS.a11yMissingRole, FINDINGS.a11yShadowRef];
      const decisions = [
        { agent: 'code-quality', action: 'kept', reason: 'Typ-Sicherheit relevant', finding: FINDINGS.codeQuality1.title },
        { agent: 'accessibility', action: 'kept', reason: 'Kritisches Barrierefreiheitsproblem', finding: FINDINGS.a11yMissingRole.title },
        { agent: 'accessibility', action: 'kept', reason: 'ARIA-Referenz funktioniert nicht über Shadow-Grenzen', finding: FINDINGS.a11yShadowRef.title },
      ];
      const rawResponse = { findings: consolidatedFindings, decisions, summary: '3 Auffälligkeiten: 1 Kritisch, 2 Wichtig' };

      emit('consolidator:done', {
        duration: 850,
        result: {
          findings: consolidatedFindings,
          summary: '3 Auffälligkeiten: 1 Kritisch, 2 Wichtig',
          warnings: [],
          reviewedAt: new Date().toISOString(),
        },
        decisions,
        summary: '3 Findings geprüft, alle übernommen',
        rawResponse,
        thoughts: 'Checking grounding for 3 findings...\nFinding "Typ-Assertion": snippet found. KEEP.\nFinding "Icon-Button ohne zugänglichen Namen": div.close found in diff. KEEP.\nFinding "ID-Referenz über Shadow-DOM-Grenze": aria-labelledby found in diff. KEEP.',
      });

      emit('done', {});
    },
  },
];

async function runMockReview(emit) {
  const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  console.log(`[AI Mock] Szenario: ${scenario.name}`);
  await scenario.run(emit);
}

module.exports = { runMockReview, setSkipDelays };
