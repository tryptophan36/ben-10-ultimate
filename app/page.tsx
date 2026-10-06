import type { Metadata } from "next";
import { Orbitron } from "next/font/google";
import { HomeMenu } from "@/components/menu/HomeMenu";

const display = Orbitron({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Ben 10 Ultimate",
  description: "Choose an alien, a mode, and an arena.",
};

export default function Home() {
  return (
    <div className={`${display.variable} font-sans h-dvh`}>
      <HomeMenu />
    </div>
  );
}
