const checks = [
  { label: "Dedicated Stripe sandbox", status: "verified" },
  { label: "Raw-body webhook route", status: "implemented" },
  { label: "Webhook signature tests", status: "implemented" },
  { label: "Public HTTPS deployment", status: "verified" },
  { label: "Stripe event destination", status: "pending" },
  { label: "USD 1.00 SPT test payment", status: "pending" },
];

export default function Home() {
  return (
    <main>
      <header className="masthead">
        <div>
          <p className="eyebrow">PaymentLab AI · Phase 0</p>
          <h1>Capability gate</h1>
          <p className="lede">
            The isolated webhook boundary is publicly deployed and remains
            fail-closed until its Stripe signing secret is configured. No
            payment or event destination has been created.
          </p>
        </div>
        <span className="mode">TEST MODE ONLY</span>
      </header>

      <section aria-labelledby="readiness-heading" className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Implementation readiness</p>
            <h2 id="readiness-heading">Safe progress before the live spike</h2>
          </div>
          <span className="record-note">Phase record available in the docs preview</span>
        </div>

        <ul className="check-grid">
          {checks.map((check) => (
            <li key={check.label}>
              <span aria-hidden="true" className={`dot ${check.status}`} />
              <span>{check.label}</span>
              <strong>{check.status}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="next-step" aria-labelledby="next-heading">
        <p className="eyebrow">Next controlled step</p>
        <h2 id="next-heading">Create the Stripe test event destination</h2>
        <p>
          Point the sandbox destination to the callback below, subscribe only to
          the approved PaymentIntent and SPT events, then store its endpoint-specific
          signing secret as <code>STRIPE_WEBHOOK_SECRET</code> in Vercel.
        </p>
        <code className="route">https://pradpay.vercel.app/api/webhooks/stripe</code>
      </section>
    </main>
  );
}
