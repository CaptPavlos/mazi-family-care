import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Mazi · Family care",
  description:
    "Your family’s care, together. Health records, appointments and everyday coordination.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
