const SCENARIOS = [
  {
    name: 'Mehrere Findings (mixed)',
    data: {
      findings: [
        {
          severity: 'critical',
          category: 'ak-abgleich',
          title: 'Hover-State für primären Button fehlt',
          file: 'src/components/button/button.styles.scss',
          line: 42,
          detail: 'Laut AK muss der primäre Button einen sichtbaren Hover-State haben. Die aktuelle Implementierung definiert keinen :hover-Selektor.',
          suggestion: 'Einen :hover-Selektor mit leicht abgedunkelter Hintergrundfarbe ergänzen.',
        },
        {
          severity: 'important',
          category: 'code-quality',
          title: 'Typ-Assertion statt Type Guard',
          file: 'src/components/button/button.ts',
          line: 87,
          detail: 'Die Typ-Assertion `as ButtonVariant` umgeht die Typprüfung. Ein Type Guard wäre sicherer und erkennt ungültige Werte zur Laufzeit.',
          suggestion: 'Einen Type Guard `isButtonVariant()` implementieren und vor dem Zugriff prüfen.',
        },
        {
          severity: 'minor',
          category: 'code-quality',
          title: 'Doppelte Berechnung in render()',
          file: 'src/components/button/button.ts',
          line: 112,
          detail: 'Die CSS-Klasse wird bei jedem Render-Zyklus neu berechnet, obwohl sich die Inputs nicht geändert haben.',
          suggestion: 'Berechnung in ein `willUpdate()` mit Dirty-Check verschieben.',
        },
      ],
      summary: '3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering',
      warnings: [],
    },
  },
  {
    name: 'Keine Findings',
    data: {
      findings: [],
      summary: 'Keine Auffälligkeiten',
      warnings: [],
    },
  },
  {
    name: 'Nur Code-Quality',
    data: {
      findings: [
        {
          severity: 'important',
          category: 'code-quality',
          title: 'Event-Listener wird nicht aufgeräumt',
          file: 'src/components/tooltip/tooltip.ts',
          line: 34,
          detail: 'Der `mouseenter`-Listener wird in `connectedCallback` registriert, aber in `disconnectedCallback` nicht entfernt. Das führt zu Memory Leaks bei häufigem Mount/Unmount.',
          suggestion: 'Listener-Referenz speichern und in `disconnectedCallback` via `removeEventListener` aufräumen.',
        },
        {
          severity: 'minor',
          category: 'code-quality',
          title: 'Unnötiger Nullcheck',
          file: 'src/components/tooltip/tooltip.ts',
          line: 58,
          detail: 'Die Property `content` ist als `@property()` deklariert und hat einen Default-Wert. Der Nullcheck in Zeile 58 greift nie.',
          suggestion: 'Nullcheck entfernen, da `content` immer definiert ist.',
        },
      ],
      summary: '2 Auffälligkeiten: 1 Wichtig, 1 Gering',
      warnings: ['Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.'],
    },
  },
  {
    name: 'Partial Failure',
    data: {
      findings: [
        {
          severity: 'important',
          category: 'code-quality',
          title: 'Shadow DOM Styling Leak',
          file: 'src/components/card/card.styles.scss',
          line: 15,
          detail: 'Der `:host` Selektor fehlt. Styles können in den umgebenden DOM leaken wenn die Komponente ohne Shadow DOM genutzt wird.',
          suggestion: 'Alle Top-Level-Styles in `:host { }` wrappen.',
        },
      ],
      summary: '1 Auffälligkeit: 1 Wichtig',
      warnings: ['Agent 1 (AK-Abgleich) fehlgeschlagen: CoSi API error: 503 — Service Unavailable'],
    },
  },
];

function randomDelay() {
  const ms = Math.random() * 1000 + 2000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMockReview() {
  const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  console.log(`[CoSi Mock] Szenario: ${scenario.name}`);
  await randomDelay();
  return {
    ...scenario.data,
    reviewedAt: new Date().toISOString(),
  };
}

module.exports = { runMockReview };
