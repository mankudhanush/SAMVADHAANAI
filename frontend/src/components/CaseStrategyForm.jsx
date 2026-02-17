import React, { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Scale, Send, Loader2, MapPin } from 'lucide-react';

const CASE_TYPES = [
  { value: 'civil', label: 'Civil' },
  { value: 'criminal', label: 'Criminal' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'property', label: 'Property' },
  { value: 'family', label: 'Family' },
  { value: 'labour', label: 'Labour' },
  { value: 'tax', label: 'Tax' },
  { value: 'constitutional', label: 'Constitutional' },
  { value: 'cyber', label: 'Cyber' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'consumer', label: 'Consumer Protection' },
  { value: 'intellectual-property', label: 'Intellectual Property' },
];

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

function CaseStrategyForm({ onSubmit, loading }) {
  const [caseDescription, setCaseDescription] = useState('');
  const [caseType, setCaseType] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');

  const canSubmit = caseDescription.trim().length >= 20 && caseType && !loading;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      caseDescription: caseDescription.trim(),
      caseType,
      jurisdiction: jurisdiction.trim() || null,
    });
  };

  return (
    <motion.form
      initial="hidden"
      animate="visible"
      variants={fadeIn}
      onSubmit={handleSubmit}
      className="manuscript-frame rounded-sm p-7 sm:p-10"
    >
      {/* Header */}
      <div className="flex items-start gap-4 sm:gap-5 mb-8">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-sm border border-gold-400/40 bg-gradient-to-br from-gold-50 to-parchment-300 flex items-center justify-center shrink-0 shadow-sm">
          <Scale className="w-5.5 h-5.5 sm:w-6 sm:h-6 text-gold-600" />
        </div>
        <div>
          <span className="block font-accent text-[0.875rem] tracking-[0.25em] uppercase text-gold-600 mb-1">
            Petition
          </span>
          <h2 className="font-display text-[1.5rem] sm:text-[1.75rem] font-semibold text-ink-500 leading-snug">
            File Your Case Brief
          </h2>
          <p className="font-body text-[1.0625rem] text-ink-300 italic mt-1.5 leading-relaxed">
            Present the facts of your matter for constitutional strategic analysis
          </p>
        </div>
      </div>

      {/* Case Type */}
      <div className="mb-6">
        <label className="block font-accent text-[0.875rem] tracking-[0.15em] uppercase text-ink-300 mb-2.5">
          Classification of Matter
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {CASE_TYPES.map((ct) => (
            <button
              key={ct.value}
              type="button"
              onClick={() => setCaseType(ct.value)}
              className={`px-4 py-3 rounded-sm border text-[0.9375rem] font-accent tracking-wider transition-all duration-200 ${
                caseType === ct.value
                  ? 'border-gold-500 bg-gold-50/60 text-gold-700 shadow-sm'
                  : 'border-parchment-600/40 text-ink-200 hover:border-gold-400/50 hover:bg-parchment-100'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Jurisdiction (optional) */}
      <div className="mb-6">
        <label className="block font-accent text-[0.875rem] tracking-[0.15em] uppercase text-ink-300 mb-2.5">
          <MapPin className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Jurisdiction <span className="text-ink-200 normal-case tracking-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
          placeholder="e.g. Supreme Court of India, Delhi High Court, Mumbai District Court"
          className="w-full px-5 py-3.5 rounded-sm border border-parchment-600/40 bg-parchment-100/50 font-body text-[1.0625rem] text-ink-400 placeholder:text-parchment-700 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition-all"
        />
      </div>

      {/* Case Description */}
      <div className="mb-8">
        <label className="block font-accent text-[0.875rem] tracking-[0.15em] uppercase text-ink-300 mb-2.5">
          Statement of Facts
        </label>
        <textarea
          value={caseDescription}
          onChange={(e) => setCaseDescription(e.target.value)}
          placeholder="Describe the case in detail — include parties involved, the nature of the dispute, key facts, any evidence available, and the desired outcome. Minimum 20 characters."
          rows={7}
          className="w-full px-5 py-4 rounded-sm border border-parchment-600/40 bg-parchment-100/50 font-body text-[1.0625rem] text-ink-400 placeholder:text-parchment-700 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition-all resize-y leading-[1.8]"
        />
        <p className="font-accent text-[0.8125rem] text-ink-200 mt-1.5 tracking-wide">
          {caseDescription.trim().length} / 20 minimum characters
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className={`group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-4 rounded-sm font-accent text-[1rem] tracking-[0.15em] uppercase transition-all duration-300 ${
          canSubmit
            ? 'bg-gradient-to-b from-maroon-400 to-maroon-600 border-2 border-maroon-500 text-parchment-50 shadow-lg hover:from-maroon-500 hover:to-maroon-700 hover:shadow-xl hover:scale-[1.01]'
            : 'bg-parchment-400/60 border-2 border-parchment-500/40 text-ink-200 cursor-not-allowed'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Deliberating…
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            Submit for Strategic Analysis
          </>
        )}
      </button>
    </motion.form>
  );
}

export default memo(CaseStrategyForm);
