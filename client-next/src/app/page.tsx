import type { Metadata } from 'next';
import LandingNav from '@/lib/components/landing/LandingNav';
import Hero from '@/lib/components/landing/Hero';
import DiagramTypes from '@/lib/components/landing/DiagramTypes';
import Features from '@/lib/components/landing/Features';
import HowItWorks from '@/lib/components/landing/HowItWorks';
import FinalCTA from '@/lib/components/landing/FinalCTA';
import LandingFooter from '@/lib/components/landing/LandingFooter';

export const metadata: Metadata = {
  title: 'EasyDraw — Design technical diagrams with ease',
  description:
    'ERDs and flowcharts in a clean, intuitive canvas — with flexible shapes for UML and data-flow diagrams. Free to use.',
};

export default function Home() {
  // Warm cream page ground under the glassy white/80 sticky header — scrolled
  // content shows through the header's backdrop blur, everything below sits on
  // cream.
  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f3]">
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <DiagramTypes />
        <Features />
        <HowItWorks />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
