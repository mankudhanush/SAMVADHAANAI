import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

const LEVEL_CONFIG = {
  low: {
    icon: CheckCircle,
    bg: 'from-emerald-50 to-emerald-100/50',
    border: 'border-emerald-400/40',
    badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30',
    text: 'text-emerald-700',
    glow: 'shadow-emerald-200/40',
  },
  medium: {
    icon: AlertCircle,
    bg: 'from-amber-50 to-amber-100/50',
    border: 'border-amber-400/40',
    badge: 'bg-amber-500/15 text-amber-700 border-amber-400/30',
    text: 'text-amber-700',
    glow: 'shadow-amber-200/40',
  },
  high: {
    icon: AlertTriangle,
    bg: 'from-orange-50 to-orange-100/50',
    border: 'border-orange-400/40',
    badge: 'bg-orange-500/15 text-orange-700 border-orange-400/30',
    text: 'text-orange-700',
    glow: 'shadow-orange-200/40',
  },
  critical: {
    icon: XCircle,
    bg: 'from-red-50 to-red-100/50',
    border: 'border-red-400/40',
    badge: 'bg-red-500/15 text-red-700 border-red-400/30',
    text: 'text-red-700',
    glow: 'shadow-red-200/40',
  },
};

function getLevelConfig(level) {
  const key = (level || '').toLowerCase().trim();
  return LEVEL_CONFIG[key] || LEVEL_CONFIG.medium;
}

function ConstitutionalRiskIndicator({ riskLevel = {}, interpretationSummary = '' }) {
  const level = riskLevel.level || 'Unknown';
  const reasoning = riskLevel.reasoning || '';
  const config = getLevelConfig(level);
  const Icon = config.icon;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-sm border border-gold-400/40 bg-gradient-to-br from-gold-50 to-parchment-300 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-gold-600" />
        </div>
        <div>
          <span className="block font-accent text-[0.8125rem] tracking-[0.25em] uppercase text-gold-600">
            Article V
          </span>
          <h3 className="font-display text-[1.375rem] font-semibold text-ink-500 leading-snug">
            Constitutional Risk Assessment
          </h3>
        </div>
      </div>

      <div className="pl-0 sm:pl-[52px] space-y-6">
        {/* Risk level badge + reasoning */}
        <div className={`p-6 rounded-sm border ${config.border} bg-gradient-to-br ${config.bg} shadow-sm ${config.glow}`}>
          <div className="flex items-center gap-3 mb-4">
            <Icon className={`w-6 h-6 ${config.text}`} />
            <span className={`inline-flex px-3.5 py-1.5 rounded-sm border font-accent text-[0.9375rem] tracking-[0.15em] uppercase font-bold ${config.badge}`}>
              {level}
            </span>
            <span className="font-accent text-[0.875rem] tracking-wider uppercase text-ink-300">
              Constitutional Vulnerability
            </span>
          </div>
          {reasoning && (
            <p className="font-body text-[0.9375rem] text-ink-400 leading-relaxed">
              {reasoning}
            </p>
          )}
        </div>

        {/* Interpretation summary */}
        {interpretationSummary && (
          <div className="p-6 rounded-sm border border-gold-400/25 bg-parchment-100/50">
            <h4 className="font-accent text-[0.875rem] tracking-[0.2em] uppercase text-gold-600 mb-3 font-semibold">
              Constitutional Interpretation
            </h4>
            <p className="font-body text-[1rem] text-ink-400 leading-[1.9] italic">
              "{interpretationSummary}"
            </p>
          </div>
        )}
      </div>
    </motion.section>
  );
}

export default memo(ConstitutionalRiskIndicator);
