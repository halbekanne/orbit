# Orbit — Design Token System
## Tailwind CSS → Semantische Tokens

---

## Tailwind-Paletten-Zuordnung

| Orbit-Konzept       | Tailwind-Palette | Begründung |
|----------------------|------------------|------------|
| Warm Neutrals (Basis)| `stone`          | Einzige Tailwind-Palette mit warmem Unterton (gelblich statt bläulich) |
| Primär / Identität   | `violet`         | Direkte Übereinstimmung mit BD-b Balanced Violet |
| Signal / Aufmerksamkeit | `amber`       | Warmer Goldton, komplementär zu Violet |
| Erfolg / Erledigt    | `emerald`        | Klares Grün, gut unterscheidbar von Amber |
| Fehler / Problem     | `red`            | Universal verständlich |
| Info (optional)      | `blue`           | Nur für Links und informative Elemente, kein Status |

---

## Semantische Tokens

### Hintergründe & Oberflächen

```
Token                         Light              Dark
─────────────────────────────────────────────────────────
bg.page                       stone-100          stone-950
bg.surface                    stone-200          stone-900
bg.card                       white              stone-800
bg.elevated                   white              stone-800

border.default                stone-300          stone-600
border.subtle                 stone-200          stone-700
```


### Text

```
Token                         Light              Dark
─────────────────────────────────────────────────────────
text.heading                  stone-800          stone-100
text.body                     stone-600          stone-300
text.muted                    stone-400          stone-500
text.hint                     stone-400          stone-500  (mit niedrigerer opacity bei inactive)
```

### Rail / Navigation

```
Token                         Light              Dark
─────────────────────────────────────────────────────────
rail.bg                       stone-900          stone-950
rail.icon.default             stone-500          stone-600
rail.icon.active              white              white
rail.accent                   violet-500         violet-400
```

---

## Primär — Violet (Identität & aktive Zustände)

Verwendung: Buttons, aktive Navigation, Fokus-Ringe, Pomodoro, ausgewählte Elemente,
"In Progress", "In Review", "Wartet auf mein Review"

```
Token                         Light              Dark
─────────────────────────────────────────────────────────
primary.bg                    violet-50          violet-500/12
primary.bg.hover              violet-100         violet-500/20
primary.border                violet-200         violet-500/25
primary.solid                 violet-500         violet-400
primary.solid.hover           violet-600         violet-300
primary.text                  violet-700         violet-300
primary.on-solid              white              white
```

**Tailwind-Klassen-Beispiele:**
- Button: `bg-violet-500 hover:bg-violet-600 text-white` / dark: `bg-violet-400 hover:bg-violet-300`
- Badge: `bg-violet-50 text-violet-700` / dark: `bg-violet-500/12 text-violet-300`
- Fokus-Ring: `focus-visible:ring-violet-500` / dark: `focus-visible:ring-violet-400`

---

## Signal — Amber (Aufmerksamkeit)

Verwendung: NUR der dicke linke Kartenrand bei "braucht Aufmerksamkeit",
"prio: hoch", "Xd offen", "Erneutes Review nötig"

```
Token                         Light              Dark
─────────────────────────────────────────────────────────
signal.bar                    amber-500          amber-500
signal.text                   amber-700          amber-500
```

**Tailwind-Klassen-Beispiel:**
- Attention-Bar: `border-l-4 border-amber-500` / dark: `border-amber-500`
- Inline-Text "3d offen": `text-amber-700 font-medium` / dark: `text-amber-500`

---

## Erfolg — Emerald (Erledigt / Erfolgreich)

Verwendung: "Done", "Build erfolgreich", "Bereit zum Mergen"

```
Token                         Light              Dark
─────────────────────────────────────────────────────────
success.bg                    emerald-50         emerald-400/10
success.border                emerald-200        emerald-400/20
success.solid                 emerald-500        emerald-400
success.text                  emerald-700        emerald-400
```

**Tailwind-Klassen-Beispiel:**
- Badge: `bg-emerald-50 text-emerald-700` / dark: `bg-emerald-400/10 text-emerald-400`
- Icon-Farbe: `text-emerald-500` / dark: `text-emerald-400`

---

## Fehler — Red (Problem / Kaputt)

Verwendung: "Fehler"-Badge, "Build fehlgeschlagen", "Änderungen nötig"

```
Token                         Light              Dark
─────────────────────────────────────────────────────────
danger.bg                     red-50             red-400/10
danger.border                 red-200            red-400/20
danger.solid                  red-500            red-400
danger.text                   red-700            red-400
```

**Tailwind-Klassen-Beispiel:**
- Badge: `bg-red-50 text-red-700` / dark: `bg-red-400/10 text-red-400`
- Zeitlinie "jetzt": `bg-red-500` / dark: `bg-red-400`

---

## Info — Blue (Optional, nur dekorativ)

Verwendung: Links, externe Referenzen, Jira-Ticket-Links. KEIN Status.

```
Token                         Light              Dark
─────────────────────────────────────────────────────────
info.text                     blue-600           blue-400
info.text.hover               blue-700           blue-300
```

---

## Karten-Zustände (das Herzstück)

### Inaktiv — "Ich muss nichts tun"

```css
/* Light */
.card-inactive {
  @apply bg-white border border-stone-200 rounded-lg opacity-55;
}

/* Dark */
.dark .card-inactive {
  @apply bg-stone-800 border-stone-700 opacity-[0.62];
}
```

Keine Farbe, keine linke Kante, nur reduzierte Sichtbarkeit.

### Normal — "Mein Thema, nichts Besonderes"

```css
/* Light */
.card-normal {
  @apply bg-white border border-stone-200 rounded-lg;
}

/* Dark */
.dark .card-normal {
  @apply bg-stone-800 border-stone-700;
}
```

Komplett neutral. Kein Farbakzent, keine linke Kante.

### Aufmerksamkeit — "Braucht meine Aufmerksamkeit"

```css
/* Light */
.card-attention {
  @apply bg-white border border-stone-200 rounded-r-lg rounded-l-none
         border-l-4 border-l-amber-500;
}

/* Dark */
.dark .card-attention {
  @apply bg-stone-800 border-stone-700 rounded-r-lg rounded-l-none
         border-l-4 border-l-amber-500;
}
```

Einziger Unterschied zu Normal: der dicke Amber-Balken links.

---

## Tailwind Config Erweiterung (optional)

Falls die Standard-Tailwind-`stone`-Palette nicht warm genug ist,
kann man Custom-Werte ergänzen:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        warm: {
          50:  '#faf7f2',
          100: '#f5f0e8',
          200: '#ebe4d8',
          300: '#ddd5c6',
          400: '#c4b9a8',
          500: '#a89a86',
          600: '#8a7c68',
          700: '#6e6252',
          800: '#524840',
          900: '#3a3029',
          950: '#1c1917',
        }
      }
    }
  }
}
```

Dann wird aus `bg-stone-100` einfach `bg-warm-100` — gleiche Semantik,
wärmerer Ton.

---

## Zusammenfassung als Faustregel

```
Inaktive Karte      →  opacity runter, keine Farbe
Normale Karte       →  neutral, keine Farbe, keine linke Kante
Aufmerksamkeits-Karte →  border-l-4 amber-500 (light + dark)

Violet              →  "das ist aktiv / ausgewählt / Orbit-Identität"
Amber               →  NUR der Aufmerksamkeits-Balken + inline-Text wie "3d offen"
Emerald             →  "erledigt / erfolgreich"
Red                 →  "Fehler / kaputt"
Blue                →  nur Links, kein Status

Alles andere        →  stone
```
