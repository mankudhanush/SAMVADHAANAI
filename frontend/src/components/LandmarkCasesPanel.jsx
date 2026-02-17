import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Gavel } from 'lucide-react';

const itemVariant = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

function LandmarkCasesPanel({ cases = [] }) {
  if (!cases.length) return null;

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
    >
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-sm border border-gold-400/40 bg-gradient-to-br from-gold-50 to-parchment-300 flex items-center justify-center shrink-0">
          <Gavel className="w-5 h-5 text-gold-600" />
        </div>
        <div>
          <span className="block font-accent text-[0.8125rem] tracking-[0.25em] uppercase text-gold-600">
            Article IV
          </span>
          <h3 className="font-display text-[1.375rem] font-semibold text-ink-500 leading-snug">
            Landmark Supreme Court Judgments
          </h3>
        </div>
      </div>

      {/* Cases list */}
      <div className="space-y-4 pl-0 sm:pl-[52px]">
        {cases.map((item, i) => (
          <motion.div
            key={i}
            variants={itemVariant}
            className="flex items-start gap-4 p-5 rounded-sm border border-gold-400/20 bg-parchment-100/40 hover:border-gold-400/35 transition-colors duration-200"
          >
            {/* Case number badge */}
            <div className="shrink-0 w-10 h-10 rounded-sm bg-gradient-to-br from-maroon-500 to-maroon-600 flex items-center justify-center">
              <span className="font-display text-[0.875rem] font-bold text-gold-100">
                {i + 1}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-display text-[1rem] font-semibold text-ink-500 leading-snug mb-1.5">
                {item.case_name || `Case ${i + 1}`}
              </h4>
              <p className="font-body text-[0.9375rem] text-ink-300 leading-relaxed">
                {item.constitutional_significance || 'No significance analysis available.'}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

export default memo(LandmarkCasesPanel);
