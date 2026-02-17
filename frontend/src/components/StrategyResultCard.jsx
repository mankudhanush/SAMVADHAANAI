import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Shield, AlertTriangle, Clock, Scroll, FileText } from 'lucide-react';
import RiskIndicator from './RiskIndicator';
import TimelineBlock from './TimelineBlock';

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const reducedFadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

/* Ornamental Divider — reused from main theme */
const OrnamentDivider = memo(() => (
  <div className="relative my-10 sm:my-12">
    <div className="ornament-rule" />
  </div>
));
OrnamentDivider.displayName = 'OrnamentDivider';

/* Article Heading */
const ArticleHeading = memo(({ number, title, subtitle, icon: Icon }) => (
  <div className="flex items-start gap-4 sm:gap-5 mb-8">
    {Icon && (
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-sm border border-gold-400/40 bg-gradient-to-br from-gold-50 to-parchment-300 flex items-center justify-center shrink-0 shadow-sm">
        <Icon className="w-5.5 h-5.5 sm:w-6 sm:h-6 text-gold-600" />
      </div>
    )}
    <div>
      {number && (
        <span className="block font-accent text-[0.875rem] tracking-[0.25em] uppercase text-gold-600 mb-1">
          Article {number}
        </span>
      )}
      <h2 className="font-display text-[1.5rem] sm:text-[1.75rem] font-semibold text-ink-500 leading-snug">
        {title}
      </h2>
      {subtitle && (
        <p className="font-body text-[1.0625rem] text-ink-300 italic mt-1.5 leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  </div>
));
ArticleHeading.displayName = 'ArticleHeading';

/* Severity badge */
const SeverityBadge = memo(({ severity }) => {
  const colors = {
    high: 'bg-red-50 text-red-700 border-red-300',
    medium: 'bg-amber-50 text-amber-700 border-amber-300',
    low: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  };
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-sm border text-[0.75rem] font-accent tracking-[0.1em] uppercase font-semibold ${
        colors[severity] || colors.medium
      }`}
    >
      {severity}
    </span>
  );
});
SeverityBadge.displayName = 'SeverityBadge';


function StrategyResultCard({ result }) {
  const {
    applicable_sections = [],
    counterarguments = [],
    risk_score = {},
    expected_timeline = {},
    strategy_summary = '',
  } = result;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      {/* ═══ Article I — Applicable Sections ═══ */}
      <motion.section variants={fadeIn} className="manuscript-frame rounded-sm p-7 sm:p-10">
        <ArticleHeading
          number="I"
          title="Applicable Sections"
          subtitle="Statutes and legal provisions relevant to this matter"
          icon={BookOpen}
        />
        {applicable_sections.length > 0 ? (
          <div className="space-y-3.5">
            {applicable_sections.map((s, i) => (
              <motion.div
                key={i}
                variants={reducedFadeIn}
                className="flex items-start gap-4 p-4 rounded-sm border border-parchment-600/30 bg-parchment-50/40 hover:border-gold-400/40 transition-all"
              >
                <span className="w-9 h-9 rounded-sm bg-gradient-to-b from-gold-100 to-gold-200 border border-gold-400/30 flex items-center justify-center text-sm font-bold text-gold-700 font-accent shrink-0">
                  §{i + 1}
                </span>
                <div>
                  <p className="font-display text-[1.0625rem] font-semibold text-ink-500">
                    {s.section}
                  </p>
                  {s.relevance && (
                    <p className="font-body text-[1rem] text-ink-300 italic mt-1 leading-relaxed">
                      {s.relevance}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="font-body text-ink-300 italic">No applicable sections identified.</p>
        )}
      </motion.section>

      <OrnamentDivider />

      {/* ═══ Article II — Counterarguments ═══ */}
      <motion.section variants={fadeIn} className="manuscript-frame rounded-sm p-7 sm:p-10">
        <ArticleHeading
          number="II"
          title="Counterarguments"
          subtitle="Anticipated arguments from the opposing party"
          icon={Shield}
        />
        {counterarguments.length > 0 ? (
          <div className="space-y-4">
            {counterarguments.map((c, i) => (
              <motion.div
                key={i}
                variants={reducedFadeIn}
                className="p-4 rounded-sm border border-parchment-600/30 bg-parchment-50/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="font-body text-[1.0625rem] text-ink-400 leading-[1.8] flex-1">
                    <span className="font-accent text-gold-600 font-semibold mr-2">
                      {i + 1}.
                    </span>
                    {c.argument}
                  </p>
                  <SeverityBadge severity={c.severity} />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="font-body text-ink-300 italic">No counterarguments identified.</p>
        )}
      </motion.section>

      <OrnamentDivider />

      {/* ═══ Article III — Risk Evaluation ═══ */}
      <motion.section variants={fadeIn} className="manuscript-frame rounded-sm p-7 sm:p-10">
        <ArticleHeading
          number="III"
          title="Risk Evaluation"
          subtitle="Assessment of litigation risk based on case factors"
          icon={AlertTriangle}
        />
        <RiskIndicator riskScore={risk_score} />
      </motion.section>

      <OrnamentDivider />

      {/* ═══ Article IV — Timeline ═══ */}
      <motion.section variants={fadeIn} className="manuscript-frame rounded-sm p-7 sm:p-10">
        <ArticleHeading
          number="IV"
          title="Timeline"
          subtitle="Expected procedural timeline and case phases"
          icon={Clock}
        />
        <TimelineBlock timeline={expected_timeline} />
      </motion.section>

      <OrnamentDivider />

      {/* ═══ Article V — Strategic Advisory ═══ */}
      <motion.section variants={fadeIn} className="manuscript-frame rounded-sm p-7 sm:p-10">
        <ArticleHeading
          number="V"
          title="Strategic Advisory"
          subtitle="Constitutional recommendation by the Advisory Engine"
          icon={Scroll}
        />
        <div className="p-6 rounded-sm border border-gold-400/30 bg-gradient-to-b from-gold-50/30 to-parchment-200/30">
          <p className="font-body text-[1.125rem] text-ink-400 leading-[2] whitespace-pre-line">
            {strategy_summary}
          </p>
        </div>
      </motion.section>
    </motion.div>
  );
}

export default memo(StrategyResultCard);
