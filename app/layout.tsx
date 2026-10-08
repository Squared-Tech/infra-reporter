import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AudioUnlock from "@/components/AudioUnlock";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FixZed — Citizen reporting for Zambia's local councils",
  description:
    "Report infrastructure and community issues with one photo. FixZed's AI routes your report to the right council department with a location-confidence score, and emergencies alert the council live.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AudioUnlock />
        {children}
      </body>
    </html>
  );
}
