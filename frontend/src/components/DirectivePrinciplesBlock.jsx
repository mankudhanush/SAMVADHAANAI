import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Compass } from 'lucide-react';

const itemVariant = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

function DirectivePrinciplesBlock({ principles = [] }) {
  if (!principles.length) return null;

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
    >
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-sm border border-gold-400/40 bg-gradient-to-br from-gold-50 to-parchment-300 flex items-center justify-center shrink-0">
          <Compass className="w-5 h-5 text-gold-600" />
        </div>
        <div>
          <span className="block font-accent text-[0.8125rem] tracking-[0.25em] uppercase text-gold-600">
            Article III
          </span>
          <h3 className="font-display text-[1.375rem] font-semibold text-ink-500 leading-snug">
            Directive Principles of State Policy
          </h3>
        </div>
      </div>

      {/* Principles grid */}
      <div className="grid gap-4 sm:grid-cols-2 pl-0 sm:pl-[52px]">
        {principles.map((item, i) => (
          <motion.div
            key={i}
            variants={itemVariant}
            className="p-5 rounded-sm border border-gold-400/25 bg-gradient-to-br from-parchment-100/70 to-parchment-200/40 hover:border-gold-400/40 transition-colors duration-200"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-gold-500/15 border border-gold-400/30 flex items-center justify-center font-accent text-[0.75rem] text-gold-700 font-bold">
                {i + 1}
              </span>
              <h4 className="font-accent text-[0.875rem] tracking-[0.1em] uppercase text-gold-700 font-semibold">
                {item.principle || `Directive Principle ${i + 1}`}
              </h4>
            </div>
            <p className="font-body text-[0.9375rem] text-ink-300 leading-relaxed">
              {item.analysis || 'No analysis available.'}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

export default memo(DirectivePrinciplesBlock);
