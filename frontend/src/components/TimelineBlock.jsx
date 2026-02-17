import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Clock, ChevronRight } from 'lucide-react';

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const fadeIn = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

function TimelineBlock({ timeline }) {
  const { estimate, phases = [] } = timeline;

  return (
    <div>
      {/* Estimated total */}
      <div className="flex items-center gap-3 mb-6 px-5 py-4 rounded-sm border border-gold-400/30 bg-gradient-to-r from-gold-50/40 to-parchment-200/30">
        <Clock className="w-5 h-5 text-gold-600 shrink-0" />
        <span className="font-accent text-[0.9rem] tracking-[0.15em] uppercase text-ink-300">
          Estimated Duration:
        </span>
        <span className="font-display text-[1.25rem] font-semibold text-ink-500">
          {estimate}
        </span>
      </div>

      {/* Phase timeline */}
      {phases.length > 0 && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative pl-6 border-l-2 border-gold-400/30 space-y-6"
        >
          {phases.map((phase, i) => (
            <motion.div
              key={i}
              variants={fadeIn}
              className="relative"
            >
              {/* Dot on timeline */}
              <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-gold-500 bg-parchment-200" />

              <div className="manuscript-frame rounded-sm p-5 hover:border-gold-400/50 transition-all duration-200">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-accent text-[0.8125rem] tracking-[0.15em] uppercase text-gold-600 font-semibold">
                    Phase {i + 1}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-parchment-700" />
                  <span className="font-display text-[1.0625rem] font-semibold text-ink-500">
                    {phase.phase}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-3.5 h-3.5 text-ink-200" />
                  <span className="font-accent text-[0.875rem] text-ink-300 tracking-wider">
                    {phase.duration}
                  </span>
                </div>
                {phase.description && (
                  <p className="font-body text-[1rem] text-ink-300 leading-[1.8] italic">
                    {phase.description}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

export default memo(TimelineBlock);
