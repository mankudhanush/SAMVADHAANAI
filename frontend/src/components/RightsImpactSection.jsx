import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

const itemVariant = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

function RightsImpactSection({ rights = [] }) {
  if (!rights.length) return null;

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
    >
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-sm border border-gold-400/40 bg-gradient-to-br from-gold-50 to-parchment-300 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-gold-600" />
        </div>
        <div>
          <span className="block font-accent text-[0.8125rem] tracking-[0.25em] uppercase text-gold-600">
            Article II
          </span>
          <h3 className="font-display text-[1.375rem] font-semibold text-ink-500 leading-snug">
            Fundamental Rights Impact
          </h3>
        </div>
      </div>

      {/* Rights list */}
      <div className="space-y-4 pl-0 sm:pl-[52px]">
        {rights.map((item, i) => (
          <motion.div
            key={i}
            variants={itemVariant}
            className="relative p-5 rounded-sm border-l-[3px] border-l-maroon-500/70 border border-gold-400/20 bg-parchment-100/40"
          >
            <h4 className="font-accent text-[0.9375rem] tracking-[0.1em] uppercase text-maroon-600 font-semibold mb-2">
              {item.right || `Fundamental Right ${i + 1}`}
            </h4>
            <p className="font-body text-[0.9375rem] text-ink-300 leading-relaxed">
              {item.impact_analysis || 'No impact analysis available.'}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

export default memo(RightsImpactSection);
