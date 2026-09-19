import Link from "next/link";

const checklist = [
  "A deterministic 30-second journey from mission to confirmation",
  "Buyer, merchant, and payment-provider perspectives at one shared cursor",
  "Synthetic facts only — no payment or agent API calls",
];

export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="PaymentLab AI home">
          <span className="brand-mark">P</span>
          <span>PaymentLab AI</span>
        </Link>
        <span className="environment-pill">Development · synthetic only</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div>
          <p className="eyebrow">Observe decisions. Inspect evidence.</p>
          <h1 id="hero-title">A guided replay of agentic commerce</h1>
          <p className="hero-copy">
            Follow one bounded purchase as a recorded, deterministic sequence. Rewind any event
            and compare what the buyer, merchant, and payment provider knew at that exact point.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/demo/synthetic-success-v1">
              Start Guided Replay
            </Link>
            <a className="button secondary" href="#scope">
              Review the safety boundary
            </a>
          </div>
        </div>
        <aside className="mission-card" aria-label="Replay summary">
          <p className="card-kicker">Synthetic fixture v1</p>
          <h2>Successful delegated sale</h2>
          <ul>
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="fixture-note">$303.19 total · illustrative economics · fulfillment not performed</p>
        </aside>
      </section>

      <section className="scope-grid" id="scope" aria-labelledby="scope-title">
        <div>
          <p className="eyebrow">Milestone 1 boundary</p>
          <h2 id="scope-title">Replay before integration</h2>
          <p>
            This build establishes domain rules, event-time projection, and pinned ACP contract
            scaffolding without requiring Stripe, database, workflow, or model credentials.
          </p>
        </div>
        <div className="scope-card">
          <strong>No live side effects</strong>
          <p>Guided Replay reads a checked-in recording. It cannot submit a payment, call an agent, or mutate production data.</p>
        </div>
        <div className="scope-card">
          <strong>No future leakage</strong>
          <p>Every visible fact and event is derived only through the current replay cursor.</p>
        </div>
      </section>
    </main>
  );
}
