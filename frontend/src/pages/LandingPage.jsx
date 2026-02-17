import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scale, BookOpen, Shield, Cpu, FileText, Gavel } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════════════════════ */
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }
  },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 1, ease: 'easeOut' }
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3 }
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.6, ease: 'easeOut' }
  },
};

/* ═══════════════════════════════════════════════════════════
   ORNAMENTAL COMPONENTS
   ═══════════════════════════════════════════════════════════ */

const CornerOrnament = memo(({ position }) => {
  const positionClasses = {
    'top-left': 'top-0 left-0 border-t-2 border-l-2',
    'top-right': 'top-0 right-0 border-t-2 border-r-2',
    'bottom-left': 'bottom-0 left-0 border-b-2 border-l-2',
    'bottom-right': 'bottom-0 right-0 border-b-2 border-r-2',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, delay: 0.5 }}
      className={`absolute w-16 h-16 sm:w-24 sm:h-24 ${positionClasses[position]} border-gold-400/40 pointer-events-none`}
    >
      <div className={`absolute w-8 h-8 sm:w-12 sm:h-12 ${positionClasses[position]} border-gold-500/30 m-2`} />
    </motion.div>
  );
});
CornerOrnament.displayName = 'CornerOrnament';

const OrnamentalDivider = memo(({ className = '' }) => (
  <div className={`relative my-12 sm:my-16 ${className}`}>
    <div className="h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-parchment-200 px-6">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-1.5 rotate-45 bg-gold-500/60" />
        <div className="w-2 h-2 rotate-45 border border-gold-500/60" />
        <div className="w-1.5 h-1.5 rotate-45 bg-gold-500/60" />
      </div>
    </div>
  </div>
));
OrnamentalDivider.displayName = 'OrnamentalDivider';

const ArticleSection = memo(({ number, title, children, icon: Icon }) => (
  <motion.article
    variants={fadeInUp}
    className="relative"
  >
    <div className="flex items-start gap-4 sm:gap-5 mb-5">
      {Icon && (
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-sm border border-gold-400/40 bg-gradient-to-br from-gold-50 to-parchment-300 flex items-center justify-center shrink-0 shadow-sm">
          <Icon className="w-6 h-6 text-gold-600" />
        </div>
      )}
      <div>
        <span className="block font-accent text-[0.875rem] tracking-[0.3em] uppercase text-gold-600 mb-1">
          Article {number}
        </span>
        <h3 className="font-display text-[1.5rem] sm:text-[1.75rem] font-semibold text-ink-500 leading-snug">
          {title}
        </h3>
      </div>
    </div>
    <div className="pl-0 sm:pl-[76px]">
      {children}
    </div>
  </motion.article>
));
ArticleSection.displayName = 'ArticleSection';

/* ═══════════════════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════════════════ */

function LandingPage() {
  const navigate = useNavigate();

  const handleEnterSystem = () => {
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-parchment-200 text-ink-500 font-body selection:bg-gold-400/20 relative overflow-hidden">
      
      {/* Corner Ornaments */}
      <CornerOrnament position="top-left" />
      <CornerOrnament position="top-right" />
      <CornerOrnament position="bottom-left" />
      <CornerOrnament position="bottom-right" />

      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23B8960B' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* ═══════════════════ HERO SECTION ═══════════════════ */}
      <header className="relative min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 sm:py-24">
        
        {/* Top decorative line */}
        <motion.div 
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute top-8 left-1/2 -translate-x-1/2 w-32 sm:w-48 h-px bg-gradient-to-r from-transparent via-gold-500 to-transparent"
        />

        {/* Emblem */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-8"
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-sm border-2 border-gold-400/60 bg-gradient-to-br from-maroon-500 to-maroon-600 flex items-center justify-center shadow-lg">
            <Scale className="w-10 h-10 sm:w-12 sm:h-12 text-gold-100" />
          </div>
        </motion.div>

        {/* Main Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="text-center"
        >
          <h1 className="font-display text-[2.5rem] sm:text-[3.5rem] md:text-[4.5rem] font-bold text-ink-500 tracking-tight leading-none mb-4">
            <span className="block">SAMVIDHAAN</span>
            <span className="block text-gold-600 relative">
              AI
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 sm:w-32 h-0.5 bg-gradient-to-r from-transparent via-maroon-500 to-transparent" />
            </span>
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="font-accent text-[1.0625rem] sm:text-[1.3125rem] text-ink-300 tracking-[0.2em] uppercase mt-6 text-center italic"
        >
          "A Legal Operating System Platform"
        </motion.p>

        {/* Decorative elements */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="flex items-center gap-4 mt-8"
        >
          <div className="w-12 sm:w-20 h-px bg-gradient-to-r from-transparent to-gold-400/60" />
          <div className="w-2 h-2 rotate-45 border border-gold-500" />
          <div className="w-12 sm:w-20 h-px bg-gradient-to-l from-transparent to-gold-400/60" />
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-6 h-10 rounded-full border-2 border-gold-400/40 flex items-start justify-center p-2"
          >
            <div className="w-1 h-2 bg-gold-500/60 rounded-full" />
          </motion.div>
        </motion.div>
      </header>

      <OrnamentalDivider />

      {/* ═══════════════════ ABOUT SECTION ═══════════════════ */}
      <main className="max-w-[1000px] mx-auto px-6 sm:px-10 pb-16">
        
        {/* Preamble */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeIn}
          className="text-center mb-16"
        >
          <p className="font-accent text-[0.9375rem] tracking-[0.25em] uppercase text-gold-600 mb-4">
            Preamble
          </p>
          <p className="font-body text-[1.125rem] sm:text-[1.3125rem] text-ink-400 leading-[1.9] max-w-[720px] mx-auto italic">
            We, the architects of legal intelligence, in pursuit of justice, clarity, and accessibility, 
            do hereby establish this platform to serve the sovereign understanding of law.
          </p>
        </motion.div>

        <OrnamentalDivider />

        {/* Articles */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={staggerContainer}
          className="space-y-16"
        >
          {/* Article I — Vision */}
          <ArticleSection number="I" title="Vision" icon={BookOpen}>
            <p className="font-body text-[1.0625rem] sm:text-[1.125rem] text-ink-400 leading-[1.9]">
              SAMVIDHAAN AI stands as the constitutional foundation for legal document intelligence. 
              Built upon the principles of clarity, precision, and accessibility, this platform transforms 
              complex legal manuscripts into comprehensible wisdom. Our vision extends beyond mere document 
              processing—we aspire to democratize legal understanding for every citizen of the republic.
            </p>
          </ArticleSection>

          {/* Article II — Function */}
          <ArticleSection number="II" title="Function" icon={Cpu}>
            <p className="font-body text-[1.0625rem] sm:text-[1.125rem] text-ink-400 leading-[1.9] mb-4">
              The system operates through a sophisticated assembly of capabilities:
            </p>
            <ul className="space-y-3 ml-4">
              {[
                'Document Analysis — Optical recognition and intelligent extraction from legal manuscripts',
                'Semantic Understanding — Deep comprehension through retrieval-augmented generation',
                'Risk Assessment — Identification of contractual hazards and unfavorable provisions',
                'Multilingual Translation — Bridging linguistic barriers across constituent languages',
                'Counsel Discovery — Connecting citizens with qualified legal representatives',
                'Case Strategy Simulator — AI-powered strategic analysis and litigation risk advisory',
                'Constitutional Intelligence — Mapping documents to constitutional provisions, rights, and landmark judgments',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 font-body text-[1.0625rem] sm:text-[1.125rem] text-ink-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold-500 mt-2.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </ArticleSection>

          {/* Article III — Intelligence */}
          <ArticleSection number="III" title="Intelligence" icon={Shield}>
            <p className="font-body text-[1.0625rem] sm:text-[1.125rem] text-ink-400 leading-[1.9]">
              At its core, SAMVIDHAAN AI employs a hybrid intelligence architecture combining 
              vector embeddings, semantic retrieval, and large language model reasoning. Every query 
              is processed through a rigorous pipeline: document chunking, contextual embedding, 
              similarity search, re-ranking, and finally, authoritative response generation. 
              This ensures that answers are not merely retrieved but truly understood and articulated 
              with the gravitas befitting legal discourse.
            </p>
          </ArticleSection>

          {/* Article IV — Authority */}
          <ArticleSection number="IV" title="Authority" icon={Gavel}>
            <p className="font-body text-[1.0625rem] sm:text-[1.125rem] text-ink-400 leading-[1.9]">
              The design philosophy draws inspiration from the constitutional manuscripts that 
              govern nations. Every interaction with SAMVIDHAAN AI should evoke the solemnity 
              of a legal chamber—where precision is paramount, where clarity is constitutional, 
              and where the user stands as the ultimate sovereign. This is not mere software; 
              it is a legal operating system for the modern age.
            </p>
          </ArticleSection>
        </motion.div>

        <OrnamentalDivider />

        {/* Call to Action */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={scaleIn}
          className="text-center py-8"
        >
          <p className="font-accent text-[0.9rem] tracking-[0.2em] uppercase text-ink-300 mb-8">
            By the authority vested in this system
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <button
              onClick={handleEnterSystem}
              className="group relative inline-flex items-center justify-center"
            >
              <span className="absolute inset-0 rounded-sm bg-gradient-to-r from-gold-400/20 via-gold-500/30 to-gold-400/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="relative px-10 py-4 sm:px-14 sm:py-5 bg-gradient-to-b from-maroon-400 to-maroon-600 border-2 border-maroon-500 rounded-sm text-parchment-50 font-accent text-[1rem] sm:text-[1.125rem] tracking-[0.15em] uppercase shadow-lg transition-all duration-300 group-hover:from-maroon-500 group-hover:to-maroon-700 group-hover:shadow-xl group-hover:scale-[1.02]">
                <span className="flex items-center gap-3">
                  <FileText className="w-5 h-5" />
                  Enter the System
                </span>
              </span>
            </button>
          </div>

          <p className="font-body text-[1rem] text-ink-300 italic mt-6">
            Proceed to the constitutional document intelligence chamber
          </p>
        </motion.div>
      </main>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="mt-8 border-t border-gold-400/20">
        <div className="h-px bg-gradient-to-r from-transparent via-gold-500/30 to-transparent" />
        <div className="max-w-[1000px] mx-auto px-6 py-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-sm border border-gold-400/40 bg-gradient-to-br from-maroon-500 to-maroon-600 flex items-center justify-center">
              <Scale className="w-4 h-4 text-gold-100" />
            </div>
            <span className="font-display text-[1.25rem] font-semibold text-ink-500">
              SAMVIDHAAN AI
            </span>
          </div>
          <p className="font-accent text-[0.875rem] tracking-[0.15em] uppercase text-ink-300">
            Constitutional Document Intelligence
          </p>
          <p className="font-accent text-[0.8125rem] tracking-wider text-ink-200 mt-3">
            &copy; {new Date().getFullYear()} &mdash; All Rights Reserved
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
