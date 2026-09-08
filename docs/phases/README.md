# PaymentLab AI phase records

Each delivery phase has two checked-in representations:

- A Markdown file is the editable source of truth.
- A generated, self-contained HTML file is the browser-review and print version.

Start at [`index.html`](index.html) for the HTML phase library. After editing a
phase Markdown file or this documentation rule, run:

```sh
npm run docs:phases
```

Before committing, verify that generation is deterministic and no checked-in
HTML is stale. This also validates all phase pairs, HTML5 structure, navigation,
and local links:

```sh
npm run docs:phases:check
```

The paired records are:

| Phase | Markdown source | HTML companion |
| --- | --- | --- |
| 0 — Capability and decisions | [Markdown](phase-0-capability-and-decisions.md) | [HTML](phase-0-capability-and-decisions.html) |
| 1 — Domain and Guided Replay | [Markdown](phase-1-domain-and-guided-replay.md) | [HTML](phase-1-domain-and-guided-replay.html) |
| 2 — Durable agents and ACP | [Markdown](phase-2-durable-agents-and-acp.md) | [HTML](phase-2-durable-agents-and-acp.html) |
| 3 — Stripe sale and recovery | [Markdown](phase-3-stripe-sale-and-recovery.md) | [HTML](phase-3-stripe-sale-and-recovery.html) |
| 4 — Portfolio-ready release | [Markdown](phase-4-portfolio-ready-release.md) | [HTML](phase-4-portfolio-ready-release.html) |
| 5 — Controlled publication | [Markdown](phase-5-controlled-publication.md) | [HTML](phase-5-controlled-publication.html) |
| Reusable phase template | [Markdown](PHASE-TEMPLATE.md) | [HTML](PHASE-TEMPLATE.html) |

Generated HTML must never be edited directly. Both representations are committed
together, and phase gate review includes an HTML drift check and visual review.
