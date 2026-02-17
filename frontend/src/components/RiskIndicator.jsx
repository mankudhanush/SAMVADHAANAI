import React, { memo } from 'react';
import { motion } from 'framer-motion';

const LEVEL_CONFIG = {
  Low: {
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    ring: 'stroke-emerald-500',
    track: 'stroke-emerald-100',
    label: 'Low Risk',
  },
  Medium: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    ring: 'stroke-amber-500',
    track: 'stroke-amber-100',
    label: 'Medium Risk',
  },
  High: {
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-300',
    ring: 'stroke-red-600',
    track: 'stroke-red-100',
    label: 'High Risk',
  },
};

function RiskIndicator({ riskScore }) {
  const { level, percentage, factors = [] } = riskScore;
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.Medium;

  // SVG ring parameters
  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
      {/* Circular gauge */}
      <div className="relative shrink-0">
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className={config.track}
          />
          {/* Progress */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={config.ring}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-display text-[2rem] font-bold ${config.color}`}>
            {percentage}%
          </span>
          <span className="font-accent text-[0.75rem] tracking-[0.15em] uppercase text-ink-200">
            Risk
          </span>
        </div>
      </div>

      {/* Level badge + factors */}
      <div className="flex-1">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-sm border ${config.border} ${config.bg} mb-4`}>
          <span className={`w-2.5 h-2.5 rounded-full ${config.ring.replace('stroke-', 'bg-')}`} />
          <span className={`font-accent text-[0.9375rem] tracking-[0.1em] uppercase font-semibold ${config.color}`}>
            {config.label}
          </span>
        </div>

        {factors.length > 0 && (
          <div className="space-y-2.5 mt-2">
            <p className="font-accent text-[0.8125rem] tracking-[0.15em] uppercase text-ink-200">
              Contributing Factors
            </p>
            {factors.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-3 font-body text-[1rem] text-ink-300"
              >
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                    f.impact === 'high'
                      ? 'bg-red-500'
                      : f.impact === 'medium'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <span>{f.factor}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(RiskIndicator);
