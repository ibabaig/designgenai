import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HELLO, WORLD. — Gallery",
  description: "HELLO, WORLD. A typographic exhibition at the Museum of Digital Art.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
