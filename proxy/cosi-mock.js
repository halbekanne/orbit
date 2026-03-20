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
  },
  codeQuality1: {
    severity: 'important',
    category: 'code-quality',
    title: 'Typ-Assertion statt Type Guard',
    file: 'src/components/button/button.ts',
    line: 87,
    detail: 'Die Typ-Assertion `as ButtonVariant` umgeht die Typprüfung. Ein Type Guard wäre sicherer und erkennt ungültige Werte zur Laufzeit.',
    suggestion: 'Einen Type Guard `isButtonVariant()` implementieren und vor dem Zugriff prüfen.',
  },
  codeQuality2: {
    severity: 'minor',
    category: 'code-quality',
    title: 'Doppelte Berechnung in render()',
    file: 'src/components/button/button.ts',
    line: 112,
    detail: 'Die CSS-Klasse wird bei jedem Render-Zyklus neu berechnet, obwohl sich die Inputs nicht geändert haben.',
    suggestion: 'Berechnung in ein `willUpdate()` mit Dirty-Check verschieben.',
  },
  eventListener: {
    severity: 'important',
    category: 'code-quality',
    title: 'Event-Listener wird nicht aufgeräumt',
    file: 'src/components/tooltip/tooltip.ts',
    line: 34,
    detail: 'Der `mouseenter`-Listener wird in `connectedCallback` registriert, aber in `disconnectedCallback` nicht entfernt. Das führt zu Memory Leaks bei häufigem Mount/Unmount.',
    suggestion: 'Listener-Referenz speichern und in `disconnectedCallback` via `removeEventListener` aufräumen.',
  },
  nullCheck: {
    severity: 'minor',
    category: 'code-quality',
    title: 'Unnötiger Nullcheck',
    file: 'src/components/tooltip/tooltip.ts',
    line: 58,
    detail: 'Die Property `content` ist als `@property()` deklariert und hat einen Default-Wert. Der Nullcheck in Zeile 58 greift nie.',
    suggestion: 'Nullcheck entfernen, da `content` immer definiert ist.',
  },
  shadowDom: {
    severity: 'important',
    category: 'code-quality',
    title: 'Shadow DOM Styling Leak',
    file: 'src/components/card/card.styles.scss',
    line: 15,
    detail: 'Der `:host` Selektor fehlt. Styles können in den umgebenden DOM leaken wenn die Komponente ohne Shadow DOM genutzt wird.',
    suggestion: 'Alle Top-Level-Styles in `:host { }` wrappen.',
  },
};

const SCENARIOS = [
  {
    name: 'Mehrere Findings (mixed)',
    async run(emit) {
      emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2 });
      emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4 });

      await delay(1000, 2000);
      const akFindings = [FINDINGS.akAbgleich];
      emit('agent:done', {
        agent: 'ak-abgleich',
        duration: 1200,
        findingCount: akFindings.length,
        summary: '1 Auffälligkeit: 1 Kritisch',
        rawResponse: { findings: akFindings },
      });

      await delay(1000, 2000);
      const cqFindings = [FINDINGS.codeQuality1, FINDINGS.codeQuality2];
      emit('agent:done', {
        agent: 'code-quality',
        duration: 1500,
        findingCount: cqFindings.length,
        summary: '2 Auffälligkeiten: 1 Wichtig, 1 Gering',
        rawResponse: { findings: cqFindings },
      });

      emit('consolidator:start', { temperature: 0.2 });
      await delay(500, 1000);

      const consolidatedFindings = [FINDINGS.akAbgleich, FINDINGS.codeQuality1];
      const decisions = [
        { action: 'kept', reason: 'Klares AK-Gap, Kritisch', finding: FINDINGS.akAbgleich.title },
        { action: 'kept', reason: 'Typ-Sicherheit relevant', finding: FINDINGS.codeQuality1.title },
        { action: 'removed', reason: 'Duplikat / zu geringfügig', finding: FINDINGS.codeQuality2.title },
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
      });

      emit('done', {});
    },
  },
  {
    name: 'Keine Findings',
    async run(emit) {
      emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2 });
      emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4 });

      await delay(1000, 2000);
      emit('agent:done', {
        agent: 'ak-abgleich',
        duration: 1100,
        findingCount: 0,
        summary: 'Keine Auffälligkeiten',
        rawResponse: { findings: [] },
      });

      await delay(1000, 2000);
      emit('agent:done', {
        agent: 'code-quality',
        duration: 1300,
        findingCount: 0,
        summary: 'Keine Auffälligkeiten',
        rawResponse: { findings: [] },
      });

      emit('done', {});
    },
  },
  {
    name: 'Nur Code-Quality',
    async run(emit) {
      emit('warning', { message: 'Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.' });
      emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4 });

      await delay(1000, 2000);
      const cqFindings = [FINDINGS.eventListener, FINDINGS.nullCheck];
      emit('agent:done', {
        agent: 'code-quality',
        duration: 1400,
        findingCount: cqFindings.length,
        summary: '2 Auffälligkeiten: 1 Wichtig, 1 Gering',
        rawResponse: { findings: cqFindings },
      });

      emit('consolidator:start', { temperature: 0.2 });
      await delay(500, 1000);

      const decisions = [
        { action: 'kept', reason: 'Memory Leak ist relevant', finding: FINDINGS.eventListener.title },
        { action: 'kept', reason: 'Toter Code sollte entfernt werden', finding: FINDINGS.nullCheck.title },
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
      });

      emit('done', {});
    },
  },
  {
    name: 'Partial Failure',
    async run(emit) {
      emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2 });
      emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4 });

      await delay(1000, 2000);
      emit('agent:error', { agent: 'ak-abgleich', error: 'CoSi API error: 503 — Service Unavailable' });

      await delay(1000, 2000);
      const cqFindings = [FINDINGS.shadowDom];
      emit('agent:done', {
        agent: 'code-quality',
        duration: 1600,
        findingCount: cqFindings.length,
        summary: '1 Auffälligkeit: 1 Wichtig',
        rawResponse: { findings: cqFindings },
      });

      emit('consolidator:start', { temperature: 0.2 });
      await delay(500, 1000);

      const decisions = [
        { action: 'kept', reason: 'Valides Styling-Problem', finding: FINDINGS.shadowDom.title },
      ];
      const rawResponse = { findings: cqFindings, decisions, summary: '1 Auffälligkeit: 1 Wichtig' };

      emit('consolidator:done', {
        duration: 600,
        result: {
          findings: cqFindings,
          summary: '1 Auffälligkeit: 1 Wichtig',
          warnings: ['Agent 1 (AK-Abgleich) fehlgeschlagen: CoSi API error: 503 — Service Unavailable'],
          reviewedAt: new Date().toISOString(),
        },
        decisions,
        summary: '1 Findings übernommen',
        rawResponse,
      });

      emit('done', {});
    },
  },
];

async function runMockReview(emit) {
  const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  console.log(`[CoSi Mock] Szenario: ${scenario.name}`);
  await scenario.run(emit);
}

module.exports = { runMockReview, setSkipDelays };
