import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';

const itemVariant = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

function ArticleMappingSection({ articles = [] }) {
  if (!articles.length) return null;

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
    >
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-sm border border-gold-400/40 bg-gradient-to-br from-gold-50 to-parchment-300 flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-gold-600" />
        </div>
        <div>
          <span className="block font-accent text-[0.8125rem] tracking-[0.25em] uppercase text-gold-600">
            Article I
          </span>
          <h3 className="font-display text-[1.375rem] font-semibold text-ink-500 leading-snug">
            Constitutional Article Mapping
          </h3>
        </div>
      </div>

      {/* Article cards */}
      <div className="space-y-4 pl-0 sm:pl-[52px]">
        {articles.map((art, i) => (
          <motion.div
            key={i}
            variants={itemVariant}
            className="p-5 rounded-sm border border-gold-400/25 bg-parchment-100/50 hover:border-gold-400/40 transition-colors duration-200"
          >
            <div className="flex items-start gap-3 mb-2">
              <span className="shrink-0 px-2.5 py-1 rounded-sm bg-maroon-500/10 border border-maroon-400/20 font-accent text-[0.8125rem] tracking-wider text-maroon-600 font-semibold">
                {art.article_number || `Article ${i + 1}`}
              </span>
              <h4 className="font-display text-[1.0625rem] font-semibold text-ink-500 leading-snug pt-0.5">
                {art.title || 'Constitutional Provision'}
              </h4>
            </div>
            <p className="font-body text-[0.9375rem] text-ink-300 leading-relaxed mt-2">
              {art.relevance_explanation || 'No explanation available.'}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

export default memo(ArticleMappingSection);
