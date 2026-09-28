import type { Metadata } from 'next';
import LandingNav from '@/lib/components/landing/LandingNav';
import LandingFooter from '@/lib/components/landing/LandingFooter';
import HomeExperience from '@/lib/components/landing/HomeExperience';
import styles from '@/lib/components/landing/HomeExperience.module.css';

export const metadata: Metadata = {
  title: 'EasyDraw — Give your ideas another dimension',
  description:
    'Sketch on a whiteboard, refine an AI diagram preview, and explore your ideas in editable 2D and 3D. Try an interactive data centre in EasyDraw.',
};

export default function Home() {
  return (
    <div className={styles.home}>
      <a href="#home-main" className={styles.skip}>Skip to content</a>
      <LandingNav />
      <HomeExperience />
      <LandingFooter variant="home" />
    </div>
  );
}
