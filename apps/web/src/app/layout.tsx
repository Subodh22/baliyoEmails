import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";
import { Toaster } from "@/components/layout/toaster";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Baliyoemails — Cold Email Sequencer",
  description: "Boutique cold email sequencer for teams that care about deliverability.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#D4924A",
          colorBackground: "#0A0A0A",
          colorInputBackground: "#111111",
          colorInputText: "#EDEDED",
          borderRadius: "0.375rem",
        },
      }}
    >
      <html lang="en" className="dark">
        <body className="bg-[#0A0A0A] text-[#EDEDED] antialiased">
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
