# Orbit

> Personal developer command center — Jira, Bitbucket, and work context in one calm, ADHD-friendly dashboard.

Orbit lives on a second monitor throughout the workday. It consolidates tickets, pull requests, and todos into a single interface so your focus stays on the work — not on tab-switching between enterprise tools.

![Angular](https://img.shields.io/badge/Angular-21-red?logo=angular) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Why Orbit?

Enterprise tools like Jira are built for managers, not makers. Switching between Jira, Bitbucket, and your IDE dozens of times a day isn't just annoying — for engineers with ADHD, every context switch is a potential derailment.

Orbit is the anti-Jira: instant, calm, and low-noise. Everything you need to stay on top of your day, without the cognitive overhead.

---

## Features

- **Ticket Overview** — In-progress Jira tickets with status, priority, due dates, and overdue indicators
- **Pull Request Tracking** — Bitbucket PRs with review status (Awaiting Review / Changes Requested / Approved) and comment counts
- **Personal Todos** — Lightweight task list for daily reminders and workflow steps
- **Detail Workbench** — Click any item to see the full context without leaving Orbit
- **Signal-based state** — Instant, reactive UI with no unnecessary re-renders

---

## Design Principles

Orbit is built around a single constraint: **the primary user has ADHD**. Every design decision flows from this.

| Principle | What it means |
|---|---|
| **Spatial Stability** | Layout never shifts or reorders — users orient by position |
| **Zero-Depth Navigation** | No nested menus, no back buttons — one step to resolve anything |
| **Status at a Glance** | Color and icons communicate state — scanning beats reading |
| **Chunking** | Strong visual separation between groups — no walls of content |
| **Low Motion** | No auto-playing animations — transitions ≤150ms |
| **Frictionless Transitions** | External links (Jira, Bitbucket) always open in a new tab |

The UI is in **German**, as Orbit is built for daily use at a German insurance company.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Angular 21 |
| Language | TypeScript 5.9 |
| Styling | Tailwind CSS 4 |
| State | Angular Signals |
| Testing | Vitest + jsdom |
| Formatting | Prettier |

---

## Getting Started

**Prerequisites:** Node.js 20+, npm 10+

```bash
# Clone the repo
git clone git@github.com:halbekanne/orbit.git
cd orbit

# Install dependencies
npm install

# Start the dev server
npm start
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

```bash
# Run tests
npm test

# Build for production
npm run build
```

---

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── navigator/        # Left sidebar — item list
│   │   ├── workbench/        # Right panel — item detail
│   │   ├── ticket-card/      # Jira ticket card
│   │   ├── ticket-detail/    # Jira ticket detail view
│   │   ├── pr-card/          # Pull request card
│   │   ├── pr-detail/        # Pull request detail view
│   │   ├── todo-card/        # Todo card
│   │   └── todo-detail/      # Todo detail view
│   ├── models/
│   │   └── work-item.model.ts
│   ├── services/
│   │   └── work-data.service.ts
│   ├── app.ts
│   └── app.html
└── styles.css
```

---

## Roadmap

- [ ] Jira API integration
- [ ] Bitbucket API integration
- [ ] Notifications for PR status changes and approaching due dates
- [ ] Keyboard navigation
- [ ] Configurable widget layout

---

## License

MIT
