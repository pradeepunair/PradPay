import "./styles.css";

export const metadata = {
  title: "PaymentLab AI",
  description: "A test-only lab for verified agentic payment flows.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
