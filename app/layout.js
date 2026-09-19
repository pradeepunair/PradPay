import "./styles.css";

export const metadata = {
  title: "PaymentLab AI — Guided Replay",
  description: "Inspect a synthetic agentic-commerce journey from buyer, merchant, and payment-provider perspectives.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
