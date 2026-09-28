'use client';

import Link from 'next/link';
import { ArrowDown, ArrowRight, Box, Check, Layers3, MousePointer2, MoveUpRight, PencilLine, Shapes, Sparkles, Spline, Workflow } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth.store';
import DataCentreShowcase from './DataCentreShowcase';
import styles from './HomeExperience.module.css';

function SketchIllustration() {
  return <svg viewBox="0 0 360 176" fill="none" aria-hidden="true" className={styles.sketchArt}>
    <path d="M28 58q37-5 73 0l-2 49q-32 5-72-1zM235 52q42-2 89 2l-1 57q-44-2-88 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="m116 79 105 0m-12-9 13 9-13 9" stroke="var(--color-mq-red, #a6192e)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <text x="44" y="87" fill="currentColor" fontSize="18" fontFamily="Komika Hand, cursive">idea</text>
    <text x="251" y="88" fill="currentColor" fontSize="18" fontFamily="Komika Hand, cursive">next?</text>
    <path d="M87 120q89 55 183-2m-14 1 14-2-1 14" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 5" />
    <path d="m134 35 5-11m9 14 9-8m-23 3-5-7" stroke="var(--color-mq-red, #a6192e)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>;
}

function DiagramIllustration() {
  return <div className={styles.diagramArt} aria-hidden="true">
    <svg viewBox="0 0 360 176" fill="none"><path d="M102 87h62V48h64M164 87v42h64" stroke="#bc9da5" strokeWidth="1.5" /><circle cx="164" cy="87" r="4" fill="var(--color-mq-red, #a6192e)" /></svg>
    <span className={styles.miniInput}><Workflow size={16} /> Your idea</span>
    <span className={styles.miniOutput}><Check size={14} /> Clear structure</span>
    <span className={styles.miniOutputBottom}><Spline size={14} /> Connected</span>
    <span className={styles.miniCursor}><MousePointer2 size={16} fill="currentColor" /> You</span>
  </div>;
}

function SpaceIllustration() {
  return <div className={styles.spaceArt} aria-hidden="true">
    <div className={styles.spaceOrbit} /><div className={styles.spaceOrbitTwo} />
    <div className={styles.cubeGroup}>{[0, 1, 2].map((i) => <span className={styles.littleCube} key={i} style={{ '--cube': i } as React.CSSProperties}><i /><b /><em /></span>)}</div>
    <span className={styles.spaceLabel}><Box size={13} /> A new perspective</span>
  </div>;
}

export default function HomeExperience() {
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const entry = ready && user ? '/dashboard' : '/register';
  return <main id="home-main" className={styles.main}>
    <section className={styles.hero} aria-labelledby="home-heading">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}><span className={styles.eyebrowDot} /> A LITTLE SKETCH. A BIGGER PERSPECTIVE.</p>
        <h1 id="home-heading">Give your ideas<br />another<br /><span>dimension.</span></h1>
        <p className={styles.heroDescription}>From the first scribble to the full picture.<br className={styles.desktopBreak} /> Sketch freely, build diagrams, and see your thinking come together in 3D.</p>
        <div className={styles.heroActions}>
          {ready ? <Link href={entry} className={styles.primary}>{user ? 'Open your workspace' : 'Start creating'}<ArrowRight size={17} /></Link>
            : <span className={styles.actionSkeleton} aria-label="Checking your session" />}
          <a href="#playground" className={styles.textAction}>Play with the demo <MoveUpRight size={15} /></a>
        </div>
        <div className={styles.heroTools} aria-label="Three connected ways to create">
          <span><PencilLine size={16} /> Sketch</span><i />
          <span><Workflow size={16} /> Diagram</span><i />
          <span><Box size={16} /> Explore in 3D</span>
        </div>
      </div>
      <DataCentreShowcase />
      <div className={styles.heroFootnote}><span>YOUR IDEAS DON’T HAVE TO STAY FLAT.</span><a href="#how-it-works" aria-label="Discover how EasyDraw works"><ArrowDown size={16} /></a><span>SCROLL TO SEE THE POSSIBILITIES</span></div>
    </section>

    <section id="how-it-works" className={styles.process} aria-labelledby="process-heading">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>LESS FRICTION. MORE IMAGINATION.</p><h2 id="process-heading">Rough idea.<br /><span>Remarkably clear.</span></h2></div>
        <p>You bring the idea. EasyDraw gives it room to grow—from a sketch, to something you can shape and explore.</p>
      </div>
      <div className={styles.processGrid}>
        <article className={styles.processCard}><div className={styles.cardHeading}><span className={styles.step}>01</span><PencilLine size={19} /></div><SketchIllustration /><h3>Get it out of your head.</h3><p>A whiteboard for the messy first draft. Draw with your mouse or pen, add a few words, and follow your thought.</p><span className={styles.cardTag}>YOUR STARTING POINT</span></article>
        <article className={styles.processCard}><div className={styles.cardHeading}><span className={styles.step}>02</span><Sparkles size={19} /></div><DiagramIllustration /><h3>A little help. Your direction.</h3><p>Explain what you have in mind. Generate an AI preview, refine it, and create a diagram when it feels right.</p><span className={styles.cardTag}>REVIEW BEFORE YOU CREATE</span></article>
        <article className={styles.processCard}><div className={styles.cardHeading}><span className={styles.step}>03</span><Box size={19} /></div><SpaceIllustration /><h3>See the bigger picture.</h3><p>Move between 2D and 3D. Rotate your view, explore connections, and keep shaping the same diagram.</p><span className={styles.cardTag}>ONE DIAGRAM. MORE PERSPECTIVE.</span></article>
      </div>
    </section>

    <section id="workspace" className={styles.workspace} aria-labelledby="workspace-heading">
      <div className={styles.workspaceHeading}><p className={styles.eyebrow}>MAKE SPACE FOR YOUR NEXT IDEA</p><h2 id="workspace-heading">Two ways to begin.<br /><span>Endless places to go.</span></h2></div>
      <div className={styles.workspaceGrid}>
        <Link href={ready && user ? '/dashboard/diagrams' : '/register'} className={styles.workspaceCard}>
          <div className={styles.workspaceIcon}><Workflow size={27} strokeWidth={1.5} /></div><div><span className={styles.workspaceKicker}>START WITH STRUCTURE</span><h3>Diagram</h3><p>Connect the dots. Map a system, plan a process, or bring an architecture into focus.</p><span className={styles.workspaceLink}>Start a diagram <ArrowRight size={16} /></span></div><span className={styles.cornerArrow}><MoveUpRight size={19} /></span>
        </Link>
        <Link href={ready && user ? '/dashboard/whiteboards' : '/register'} className={styles.workspaceCard}>
          <div className={styles.workspaceIcon}><PencilLine size={27} strokeWidth={1.5} /></div><div><span className={styles.workspaceKicker}>START WITH A SPARK</span><h3>Whiteboard</h3><p>A blank canvas for anything on your mind. Sketch first, then turn your idea into a diagram with AI.</p><span className={styles.workspaceLink}>Open a whiteboard <ArrowRight size={16} /></span></div><span className={styles.cornerArrow}><MoveUpRight size={19} /></span>
        </Link>
      </div>
      <div className={styles.capabilities}><span><Shapes size={18} /> Your own custom libraries</span><span><Layers3 size={18} /> Editable shapes & connections</span><span><Box size={18} /> Shared 2D & 3D content</span></div>
    </section>

    <section className={styles.invitation} aria-labelledby="invitation-heading"><div><p className={styles.eyebrow}>A WORKSPACE THAT THINKS LIKE YOU</p><h2 id="invitation-heading">What will you<br />make <span>clearer?</span></h2></div><div><p>The system you’re planning. The process you’re explaining. The idea you can’t stop thinking about.</p><Link href={entry} className={styles.lightButton}>Let’s draw it <ArrowRight size={18} /></Link></div><div className={styles.invitationMark} aria-hidden="true"><Spline strokeWidth={0.65} /></div></section>
  </main>;
}
