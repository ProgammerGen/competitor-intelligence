import type { Metadata } from "next";
import { Inter as Geist } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/QueryProvider";
import { Sidebar } from "@/components/Sidebar";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Competitor Intelligence",
  description: "Monitor your competitors across products, news, web mentions, and job postings",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="font-sans antialiased bg-background text-foreground">
        <QueryProvider>
          <Sidebar />
          <div className="min-h-screen" id="app-shell">
            {children}
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
