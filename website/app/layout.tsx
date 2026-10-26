import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gatekeeper — Good company. Great communities.",
  description:
    "A little order. A lot more fun. Meet Gatekeeper, your Discord companion for moderation, games, birthdays, and the everyday moments in between.",
  applicationName: "Gatekeeper",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon.svg` },
  openGraph: {
    title: "Gatekeeper — Your server, in good company.",
    description:
      "Moderation, community tools, and games. All together in your Discord server.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
