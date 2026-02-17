import React, { useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scale, ArrowLeft, BookOpen, Users, GraduationCap } from 'lucide-react';

import ConstitutionalUploadForm from '../components/ConstitutionalUploadForm';
import ArticleMappingSection from '../components/ArticleMappingSection';
import RightsImpactSection from '../components/RightsImpactSection';
import DirectivePrinciplesBlock from '../components/DirectivePrinciplesBlock';
import LandmarkCasesPanel from '../components/LandmarkCasesPanel';
import ConstitutionalRiskIndicator from '../components/ConstitutionalRiskIndicator';
import { analyzeConstitutionalIntelligence } from '../services/api';

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

function ConstitutionalIntelligence() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [intelligenceMode, setIntelligenceMode] = useState('citizen');

  const handleSubmit = useCallback(async (documentText) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeConstitutionalIntelligence(documentText, intelligenceMode);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Constitutional analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [intelligenceMode]);

  const handleReset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-parchment-200 text-ink-500 font-body selection:bg-gold-400/20">
      {/* ═══════════════════ HEADER ═══════════════════ */}
      <header className="sticky top-0 z-40 bg-parchment-200/95 backdrop-blur-sm border-b border-gold-400/20">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 flex items-center justify-between h-[72px]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-2 rounded-sm text-ink-200 hover:text-ink-400 hover:bg-parchment-300/60 border border-transparent hover:border-gold-400/25 transition-all duration-200 font-accent text-[0.875rem] tracking-wider"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Chamber
            </button>
            <div className="h-6 w-px bg-gold-400/30 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm border border-gold-400/40 bg-gradient-to-br from-maroon-500 to-maroon-600 flex items-center justify-center">
                <Scale className="w-4 h-4 text-gold-100" />
              </div>
              <div>
                <h1 className="font-display text-[1.125rem] font-semibold text-ink-500 leading-none">
                  SAMVIDHAAN AI
                </h1>
                <p className="font-accent text-[0.75rem] tracking-[0.2em] uppercase text-ink-300">
                  Constitutional Intelligence
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 font-accent text-[0.875rem] text-ink-300 bg-parchment-400/40 px-4 py-2 border border-gold-400/25 rounded-sm">
            <BookOpen className="w-4 h-4 text-gold-600" />
            <span className="tracking-wider">Constitutional Bench</span>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-gold-600/30 to-transparent" />
      </header>

      {/* ═══════════════════ MAIN ═══════════════════ */}
      <main className="max-w-[1200px] mx-auto px-6 sm:px-10 py-12 sm:py-16">

        {/* Title */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="text-center mb-12"
        >
          <p className="font-accent text-[0.9375rem] tracking-[0.25em] uppercase text-gold-600 mb-3">
            Constitutional Bench Advisory
          </p>
          <h1 className="font-display text-[2rem] sm:text-[2.5rem] font-bold text-ink-500 leading-tight mb-3">
            Constitutional Intelligence Engine
          </h1>
          <p className="font-body text-[1.125rem] text-ink-300 italic max-w-[660px] mx-auto leading-relaxed">
            Submit a legal document to receive comprehensive constitutional mapping — 
            articles, fundamental rights, directive principles, and landmark judgments.
          </p>
        </motion.div>

        {/* ═══════════════════ MODE SELECTOR ═══════════════════ */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center gap-1 p-1 rounded-sm bg-parchment-300/60 border border-gold-400/25">
            <button
              onClick={() => setIntelligenceMode('citizen')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-sm font-accent text-[0.8125rem] tracking-wider transition-all duration-200 ${
                intelligenceMode === 'citizen'
                  ? 'bg-gradient-to-br from-maroon-500 to-maroon-600 text-gold-100 border border-gold-400/40 shadow-sm'
                  : 'text-ink-300 hover:text-ink-400 hover:bg-parchment-400/40'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Citizen</span>
            </button>
            <button
              onClick={() => setIntelligenceMode('law_student')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-sm font-accent text-[0.8125rem] tracking-wider transition-all duration-200 ${
                intelligenceMode === 'law_student'
                  ? 'bg-gradient-to-br from-maroon-500 to-maroon-600 text-gold-100 border border-gold-400/40 shadow-sm'
                  : 'text-ink-300 hover:text-ink-400 hover:bg-parchment-400/40'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Law Student</span>
            </button>
          </div>
        </motion.div>
        <p className="text-center font-accent text-[0.8125rem] tracking-wider text-ink-300 mb-6 -mt-4">
          {intelligenceMode === 'citizen' 
            ? 'Plain language explanations for everyday understanding'
            : 'Detailed legal analysis with technical terminology'}
        </p>

        {/* Ornamental divider */}
        <div className="relative my-10 sm:my-12">
          <div className="h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-parchment-200 px-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rotate-45 bg-gold-500/60" />
              <div className="w-2 h-2 rotate-45 border border-gold-500/60" />
              <div className="w-1.5 h-1.5 rotate-45 bg-gold-500/60" />
            </div>
          </div>
        </div>

        {/* Upload Form */}
        <ConstitutionalUploadForm onSubmit={handleSubmit} loading={loading} />

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-6 rounded-sm border border-maroon-300 bg-maroon-50/60"
          >
            <p className="font-accent text-[0.875rem] tracking-[0.15em] uppercase text-maroon-600 mb-2 font-semibold">
              Analysis Error
            </p>
            <p className="font-body text-[1.0625rem] text-maroon-700 leading-relaxed">
              {error}
            </p>
          </motion.div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Results divider */}
            <div className="relative my-12 sm:my-16">
              <div className="h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-parchment-200 px-6">
                <p className="font-accent text-[0.875rem] tracking-[0.25em] uppercase text-gold-600">
                  Constitutional Analysis
                </p>
              </div>
            </div>

            {/* Section I — Article Mapping */}
            <ArticleMappingSection articles={result.relevant_articles} />

            {/* Divider */}
            {result.relevant_articles?.length > 0 && result.fundamental_rights_impact?.length > 0 && (
              <div className="my-10 h-px bg-gradient-to-r from-transparent via-gold-400/30 to-transparent" />
            )}

            {/* Section II — Fundamental Rights */}
            <RightsImpactSection rights={result.fundamental_rights_impact} />

            {/* Divider */}
            {result.fundamental_rights_impact?.length > 0 && result.directive_principles_relevance?.length > 0 && (
              <div className="my-10 h-px bg-gradient-to-r from-transparent via-gold-400/30 to-transparent" />
            )}

            {/* Section III — Directive Principles */}
            <DirectivePrinciplesBlock principles={result.directive_principles_relevance} />

            {/* Divider */}
            {result.directive_principles_relevance?.length > 0 && result.landmark_cases?.length > 0 && (
              <div className="my-10 h-px bg-gradient-to-r from-transparent via-gold-400/30 to-transparent" />
            )}

            {/* Section IV — Landmark Cases */}
            <LandmarkCasesPanel cases={result.landmark_cases} />

            {/* Divider */}
            {result.landmark_cases?.length > 0 && (
              <div className="my-10 h-px bg-gradient-to-r from-transparent via-gold-400/30 to-transparent" />
            )}

            {/* Section V — Risk + Summary */}
            <ConstitutionalRiskIndicator
              riskLevel={result.constitutional_risk_level}
              interpretationSummary={result.interpretation_summary}
            />

            {/* New Analysis button */}
            <div className="text-center mt-14">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-sm border-2 border-gold-400/40 text-gold-700 font-accent text-[0.9375rem] tracking-[0.15em] uppercase hover:bg-gold-50 hover:border-gold-500/50 transition-all duration-200"
              >
                File New Constitutional Petition
              </button>
            </div>
          </>
        )}
      </main>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="mt-20">
        <div className="h-px bg-gradient-to-r from-transparent via-gold-400/30 to-transparent" />
        <div className="max-w-[1200px] mx-auto px-6 py-10 text-center">
          <p className="font-accent text-[0.9rem] tracking-[0.2em] uppercase text-ink-300">
            &copy; {new Date().getFullYear()} SAMVIDHAAN AI &mdash; Constitutional Intelligence Engine
          </p>
          <p className="font-accent text-[0.875rem] tracking-wider text-ink-200 mt-2.5">
            Constitutional Bench Advisory &bull; AI-Powered Legal Intelligence
          </p>
        </div>
      </footer>
    </div>
  );
}

export default ConstitutionalIntelligence;
