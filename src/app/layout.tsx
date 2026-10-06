import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CloudMart",
  description: "Digital services marketplace powered by a provider-agnostic architecture."
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body style={{margin:0,background:"#fafafa",color:"#111"}}>{children}</body></html>;
}
