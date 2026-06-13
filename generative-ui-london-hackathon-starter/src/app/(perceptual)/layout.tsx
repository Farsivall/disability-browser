import { Plus_Jakarta_Sans } from "next/font/google";
import "@/a2ui/theme.css";
import "@/a2ui/accessible.css";
import "@/components/perceptual-web/side-panel.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export default function PerceptualLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${plusJakarta.variable} antialiased`}>{children}</div>
  );
}
