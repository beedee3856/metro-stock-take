import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MetroCount PRO — Supermarket Stock Taking & Inventory Counting",
  description: "Enterprise Stock Taking & Physical Inventory Management System for Supermarkets and Retailers",
  icons: {
    icon: "/metrocount-logo.png",
    apple: "/metrocount-logo.png",
  },
  openGraph: {
    title: "MetroCount PRO",
    description: "Enterprise Stock Taking & Physical Inventory Management System",
    images: ["/metrocount-logo.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased selection:bg-rose-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
