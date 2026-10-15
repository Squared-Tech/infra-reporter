import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AudioUnlock from "@/components/AudioUnlock";
import ServiceWorker from "@/components/ServiceWorker";
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
  title: "FixZed: Citizen reporting for Zambia's local councils",
  description:
    "Report infrastructure and community issues with one photo. FixZed's AI routes your report to the right council department with a location-confidence score, and emergencies alert the council live.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FixZed",
  },
  // iOS still reads the prefixed spelling; Next only emits the standard one.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#198a00",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <AudioUnlock />
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
