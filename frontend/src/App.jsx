import React, { useState, useCallback, useRef, useMemo, memo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale, Upload, FileText, MessageSquare, Send, Mic,
  Volume2, Languages, Search, MapPin,
  Loader2, ChevronRight, Sparkles, ExternalLink,
  Trash2, Database, Cpu, BookOpen,
  Square, Globe, AlertCircle, Briefcase, BookMarked, Gavel, LogOut,
  CheckCircle, Clock, ListChecks, ScrollText,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  uploadDocument, queryRAG, getStatus, clearStore,
  getLawyerRecommendations, translateText, textToSpeech,
  getPlainLanguage,
} from './services/api';
import {
  useDebounce,
  useStableCallback,
} from './utils/performance';
import useAuthStore from './store/useAuthStore';

/* ───────────────────────── Utility ───────────────────────── */
const cn = (...inputs) => twMerge(clsx(inputs));

/* ──────────────────────── Constants ──────────────────────── */
const PIPELINE_STEPS = [
  { icon: Upload, label: 'Upload' },
  { icon: FileText, label: 'Extract' },
  { icon: Cpu, label: 'Chunk' },
  { icon: Database, label: 'Embed' },
  { icon: BookOpen, label: 'Store' },
  { icon: Sparkles, label: 'LLM RAG' },
];

const LANGUAGES = [
  { value: 'hindi', label: 'हिंदी Hindi' },
  { value: 'telugu', label: 'తెలుగు Telugu' },
  { value: 'tamil', label: 'தமிழ் Tamil' },
  { value: 'kannada', label: 'ಕನ್ನಡ Kannada' },
  { value: 'malayalam', label: 'മലയാളം Malayalam' },
  { value: 'bengali', label: 'বাংলা Bengali' },
  { value: 'marathi', label: 'मराठी Marathi' },
  { value: 'gujarati', label: 'ગુજરાતી Gujarati' },
];

const PRACTICE_AREAS = [
  'Criminal Law', 'Property Law', 'Family Law', 'Labour Law', 'Tax Law',
  'Corporate Law', 'Cyber Law', 'Environmental Law', 'Constitutional Law',
  'Civil Law', 'Banking Law', 'Insurance Law', 'Intellectual Property',
  'Immigration Law', 'Consumer Protection', 'Real Estate', 'Divorce',
  'Matrimonial', 'Cheque Bounce', 'Land Dispute', 'Bail', 'FIR',
  'Contract Law', 'Arbitration', 'Mediation', 'Company Law',
  'Motor Vehicle', 'Accident Claim', 'Employment Law', 'Tenant',
  'Landlord', 'Rent Agreement', 'Securities Law', 'Customs',
];

const VOICE_LANG_NAMES = {
  en: 'English', hi: 'Hindi', te: 'Telugu', ta: 'Tamil',
  kn: 'Kannada', ml: 'Malayalam', bn: 'Bengali', mr: 'Marathi', gu: 'Gujarati',
};

const SCRIPT_DETECTORS = [
  { regex: /[\u0900-\u097F]/, lang: 'Hindi/Marathi' },
  { regex: /[\u0C00-\u0C7F]/, lang: 'Telugu' },
  { regex: /[\u0B80-\u0BFF]/, lang: 'Tamil' },
  { regex: /[\u0C80-\u0CFF]/, lang: 'Kannada' },
  { regex: /[\u0D00-\u0D7F]/, lang: 'Malayalam' },
  { regex: /[\u0980-\u09FF]/, lang: 'Bengali' },
  { regex: /[\u0A80-\u0AFF]/, lang: 'Gujarati' },
];

/* ─────────────── Framer Motion Variants (slow, dignified) ── */
/* ─────────────── Framer Motion Variants (optimized) ─────── */
const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: { opacity: 0, y: -6, transition: { duration: 0.25 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

// Reduced motion variant for better perceived performance
const reducedFadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/* ══════════════════ Pure helper functions ══════════════════ */
function detectScriptLanguage(text) {
  for (const { regex, lang } of SCRIPT_DETECTORS) {
    if (regex.test(text)) return lang;
  }
  if (/[a-zA-Z]/.test(text)) return 'English';
  return '';
}

function detectPracticeAreaFromText(text) {
  const lower = text.toLowerCase();
  // Direct match against known practice areas
  for (const area of PRACTICE_AREAS) {
    if (lower.includes(area.toLowerCase())) return area;
  }
  // Keyword-based inference from document content
  const KEYWORD_MAP = [
    { keywords: ['fir', 'first information report', 'ipc', 'bns', 'cognizable', 'accused', 'complainant', 'police station', 'penal code', 'criminal', 'theft', 'robbery', 'assault', 'murder', 'cheating', 'fraud'], area: 'Criminal Law' },
    { keywords: ['sale deed', 'property', 'land', 'plot', 'registry', 'mutation', 'encumbrance', 'title deed', 'conveyance'], area: 'Property Law' },
    { keywords: ['divorce', 'maintenance', 'custody', 'alimony', 'matrimonial', 'marriage', 'dowry', 'domestic violence'], area: 'Family Law' },
    { keywords: ['employment', 'termination', 'wages', 'salary', 'employer', 'employee', 'labour', 'industrial dispute', 'workman'], area: 'Labour Law' },
    { keywords: ['income tax', 'gst', 'tax return', 'assessment', 'tax evasion', 'tax notice'], area: 'Tax Law' },
    { keywords: ['company', 'director', 'shareholder', 'incorporation', 'board meeting', 'memorandum', 'articles of association'], area: 'Corporate Law' },
    { keywords: ['contract', 'agreement', 'clause', 'indemnity', 'breach', 'consideration', 'party', 'parties', 'terms and conditions'], area: 'Contract Law' },
    { keywords: ['tenant', 'landlord', 'rent', 'lease', 'eviction', 'tenancy'], area: 'Real Estate' },
    { keywords: ['consumer', 'deficiency', 'service', 'product', 'complaint', 'unfair trade'], area: 'Consumer Protection' },
    { keywords: ['cheque', 'dishonour', 'bounce', 'negotiable instrument', 'section 138'], area: 'Cheque Bounce' },
    { keywords: ['bail', 'anticipatory bail', 'regular bail', 'interim bail', 'surety'], area: 'Bail' },
    { keywords: ['constitution', 'fundamental right', 'article 14', 'article 19', 'article 21', 'writ', 'habeas corpus'], area: 'Constitutional Law' },
    { keywords: ['cyber', 'online', 'data', 'it act', 'information technology', 'hacking', 'phishing'], area: 'Cyber Law' },
    { keywords: ['accident', 'motor vehicle', 'compensation', 'insurance claim', 'mact'], area: 'Accident Claim' },
    { keywords: ['arbitration', 'arbitral', 'tribunal', 'arbitrator'], area: 'Arbitration' },
    { keywords: ['intellectual property', 'patent', 'trademark', 'copyright'], area: 'Intellectual Property' },
    { keywords: ['environment', 'pollution', 'ngt', 'green tribunal'], area: 'Environmental Law' },
  ];
  for (const { keywords, area } of KEYWORD_MAP) {
    const matchCount = keywords.filter(kw => lower.includes(kw)).length;
    if (matchCount >= 2) return area;
  }
  // Single strong keyword match
  for (const { keywords, area } of KEYWORD_MAP) {
    if (keywords.some(kw => lower.includes(kw))) return area;
  }
  return '';
}

/* ══════════ Memoized Ornamental Divider Component ═════════ */
const OrnamentDivider = memo(() => (
  <div className="relative my-10 sm:my-12">
    <div className="ornament-rule" />
  </div>
));
OrnamentDivider.displayName = 'OrnamentDivider';

/* ══════════ Memoized Article Heading Component ════════════ */
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
        <p className="font-body text-[1.0625rem] text-ink-300 italic mt-1.5 leading-relaxed">{subtitle}</p>
      )}
    </div>
  </div>
));
ArticleHeading.displayName = 'ArticleHeading';

/* ══════════ Memoized Pipeline Steps ═══════════════════════ */
const PipelineSteps = memo(() => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.6, delay: 0.1 }}
    className="text-center mb-8"
  >
    <p className="font-accent text-[0.9375rem] tracking-[0.2em] uppercase text-gold-600 mb-5">
      Document Processing Pipeline
    </p>
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {PIPELINE_STEPS.map((step, i) => (
        <React.Fragment key={step.label}>
          <div className="flex items-center gap-2 px-3.5 py-2.5 border border-parchment-600/40 bg-parchment-50/60 font-accent text-[0.9rem] tracking-wider text-ink-300 rounded-sm">
            <step.icon className="w-4 h-4 text-gold-600" />
            {step.label}
          </div>
          {i < PIPELINE_STEPS.length - 1 && (
            <ChevronRight className="w-3.5 h-3.5 text-parchment-700" />
          )}
        </React.Fragment>
      ))}
    </div>
  </motion.div>
));
PipelineSteps.displayName = 'PipelineSteps';

/* ══════════ Memoized Skeleton Loader ══════════════════════ */
const _SKELETON_WIDTHS = ['92%', '88%', '95%', '83%', '90%', '60%'];
const SkeletonPulse = memo(({ lines = 3, className = '' }) => (
  <div className={cn('space-y-3 animate-pulse', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="h-4 bg-parchment-400/40 rounded-sm"
        style={{ width: i === lines - 1 ? '60%' : (_SKELETON_WIDTHS[i] || '90%') }}
      />
    ))}
  </div>
));
SkeletonPulse.displayName = 'SkeletonPulse';

/* ══════════ AI Feature Cards Component ════════════════════ */
const AIFeatureCards = memo(() => {
  const navigate = useNavigate();
  
  const features = [
    {
      id: 'case-strategy',
      title: 'Case Strategy Simulator',
      subtitle: 'AI-powered strategic analysis and litigation risk advisory',
      icon: Gavel,
      path: '/case-strategy',
      borderColor: 'border-gold-400/50',
      hoverBorder: 'hover:border-gold-500',
      iconBg: 'from-gold-100 to-gold-200',
      iconColor: 'text-gold-700',
    },
    {
      id: 'constitutional-intelligence',
      title: 'Constitutional Intelligence',
      subtitle: 'Mapping documents to constitutional provisions and rights',
      icon: BookMarked,
      path: '/constitutional-intelligence',
      borderColor: 'border-maroon-400/50',
      hoverBorder: 'hover:border-maroon-500',
      iconBg: 'from-maroon-100 to-maroon-200',
      iconColor: 'text-maroon-700',
    },
  ];

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={fadeIn}
      className="manuscript-frame rounded-sm p-7 sm:p-10"
    >
      <ArticleHeading
        title="AI Intelligence Features"
        subtitle="Advanced legal analysis powered by artificial intelligence"
        icon={Sparkles}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
        {features.map((feature) => (
          <motion.button
            key={feature.id}
            onClick={() => navigate(feature.path)}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={cn(
              'group relative flex flex-col items-center justify-center gap-4 p-8 sm:p-10',
              'rounded-sm border-2 bg-gradient-to-b from-parchment-50 to-parchment-100/50',
              'cursor-pointer transition-all duration-300',
              feature.borderColor,
              feature.hoverBorder,
              'hover:shadow-lg hover:bg-gradient-to-b hover:from-parchment-100 hover:to-parchment-200/60'
            )}
          >
            {/* Hover glow effect */}
            <span className="absolute inset-0 rounded-sm bg-gradient-to-r from-gold-400/10 via-gold-500/20 to-gold-400/10 blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className={cn(
              'relative w-14 h-14 rounded-sm border-2 flex items-center justify-center',
              'bg-gradient-to-br shadow-sm transition-all duration-300',
              feature.borderColor,
              feature.iconBg,
              'group-hover:shadow-md group-hover:scale-105'
            )}>
              <feature.icon className={cn('w-7 h-7', feature.iconColor)} />
            </div>
            
            <div className="relative text-center">
              <h3 className="font-display text-[1.125rem] sm:text-[1.25rem] font-semibold text-ink-500 tracking-tight">
                {feature.title}
              </h3>
              <p className="font-body text-[0.95rem] text-ink-300 mt-2 leading-relaxed">
                {feature.subtitle}
              </p>
            </div>

            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-200 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
});
AIFeatureCards.displayName = 'AIFeatureCards';

/* ══════════ Memoized Upload Stats ═════════════════════════ */
const UploadStats = memo(({ uploadResult }) => {
  const stats = useMemo(() => [
    { label: 'Filename', value: uploadResult.filename, icon: FileText },
    { label: 'Pages', value: uploadResult.pages, icon: BookOpen },
    { label: 'Chunks', value: uploadResult.num_chunks, icon: Cpu },
    { label: 'Vectors', value: uploadResult.total_vectors, icon: Database },
  ], [uploadResult.filename, uploadResult.pages, uploadResult.num_chunks, uploadResult.total_vectors]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-4"
    >
      {stats.map(({ label, value, icon: Icon }) => (
        <motion.div
          key={label}
          variants={reducedFadeIn}
          className="rounded-sm border border-gold-400/30 bg-gradient-to-b from-parchment-50 to-parchment-200/50 p-5 text-center"
        >
          <Icon className="w-5 h-5 text-gold-600 mx-auto mb-2.5" />
          <div className="font-display text-xl sm:text-2xl font-semibold text-ink-400 truncate">
            {value}
          </div>
          <div className="font-accent text-[0.8125rem] text-ink-300 tracking-[0.2em] uppercase mt-1.5">
            {label}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
});
UploadStats.displayName = 'UploadStats';

/* ══════════ Memoized Source Item ═══════════════════════════ */
const SourceItem = memo(({ src, index }) => (
  <div className="flex items-center gap-3.5 text-[1rem] bg-parchment-50/50 border border-parchment-600/20 rounded-sm px-4 py-3.5">
    <span className="w-9 h-9 rounded-sm bg-gradient-to-b from-gold-100 to-gold-200 border border-gold-400/30 flex items-center justify-center text-sm font-bold text-gold-700 font-accent shrink-0">
      {src.source_id}
    </span>
    <span className="font-body text-ink-300 truncate flex-1 italic">
      {src.document}
    </span>
    <span className="font-accent text-ink-300 text-[0.9rem] shrink-0">
      Page {src.page}
    </span>
    {src.rerank_score != null && (
      <span className="font-accent text-[0.875rem] text-gold-600 shrink-0 tabular-nums">
        {src.rerank_score.toFixed(4)}
      </span>
    )}
  </div>
));
SourceItem.displayName = 'SourceItem';

/* ══════════ Memoized Lawyer Card ══════════════════════════ */
const LawyerCard = memo(({ lawyer, index }) => (
  <motion.div
    variants={reducedFadeIn}
    className="manuscript-frame rounded-sm p-6 sm:p-7 hover:border-gold-400/50 transition-all duration-300"
  >
    <div className="flex items-start justify-between gap-5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3.5 mb-3.5">
          <span className="w-11 h-11 rounded-sm bg-gradient-to-br from-maroon-500 to-maroon-600 text-parchment-50 flex items-center justify-center text-[1rem] font-bold font-display shrink-0 shadow-sm">
            {lawyer.rank || index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[1.25rem] sm:text-[1.375rem] font-semibold text-ink-500 truncate">
              {lawyer.name}
            </h3>
            {lawyer.firm && (
              <p className="font-accent text-[1rem] text-gold-600 italic truncate">
                {lawyer.firm}
              </p>
            )}
          </div>
        </div>

        <div className="ml-[58px] space-y-2.5">
          <p className="font-body text-[1rem] text-ink-300 flex items-center gap-2">
            <MapPin className="w-4 h-4 shrink-0 text-parchment-700" />
            {lawyer.location}
          </p>
          <p className="font-body text-[1.0625rem] text-ink-300 leading-relaxed line-clamp-2">
            {lawyer.snippet}
          </p>
          {lawyer.explanation && (
            <p className="font-body text-[1rem] text-gold-700 italic flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-gold-500" />
              {lawyer.explanation}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 text-center space-y-2">
        <div
          className={cn(
            'font-display text-2xl font-bold px-5 py-2.5 rounded-sm border',
            lawyer.score >= 60
              ? 'text-gold-700 bg-gold-50/60 border-gold-400/40'
              : lawyer.score >= 35
                ? 'text-ink-300 bg-parchment-300/40 border-parchment-600/30'
                : 'text-ink-200 bg-parchment-200/40 border-parchment-500/20'
          )}
        >
          {lawyer.score}
        </div>
        <span className="font-accent text-[0.75rem] tracking-[0.2em] uppercase text-ink-200 block">
          Relevance
        </span>
        {lawyer.website && (
          <a
            href={lawyer.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-accent text-[0.875rem] text-gold-600 hover:text-maroon-500 transition-colors mt-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {lawyer.domain || 'Visit'}
          </a>
        )}
      </div>
    </div>
  </motion.div>
));
LawyerCard.displayName = 'LawyerCard';

/* ═══════════════════════════════════════════════════════════ */
/*                         APP                               */
/* ═══════════════════════════════════════════════════════════ */
function App() {
  const authUser = useAuthStore((s) => s.user);

  /* ── Upload state ── */
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadStage, setUploadStage] = useState(''); // 'reading' | 'extracting' | 'embedding' | 'analyzing'
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  /* ── Document Simplification state ── */
  const [simplifyLoading, setSimplifyLoading] = useState(false);
  const [simplifyResult, setSimplifyResult] = useState(null);
  const [simplifyError, setSimplifyError] = useState(null);

  /* ── Query state ── */
  const [question, setQuestion] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);
  const [queryError, setQueryError] = useState(null);

  /* ── Voice Input state ── */
  const [isRecording, setIsRecording] = useState(false);
  const [voiceInputLoading, setVoiceInputLoading] = useState(false);
  const [voiceInputError, setVoiceInputError] = useState(null);
  const [detectedLang, setDetectedLang] = useState('');
  const recognitionRef = useRef(null);

  /* ── Lawyer Discovery state ── */
  const [lawyerLoading, setLawyerLoading] = useState(false);
  const [lawyers, setLawyers] = useState([]);
  const [lawyerError, setLawyerError] = useState(null);
  const [practiceArea, setPracticeArea] = useState('');
  const [city, setCity] = useState('');

  /* ── Translation state ── */
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [targetLang, setTargetLang] = useState('hindi');
  const [translateError, setTranslateError] = useState(null);

  /* ── TTS state ── */
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState('');
  const [ttsError, setTtsError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  /* ── Status ── */
  const [status, setStatus] = useState(null);

  /* ── Inflight guard refs (prevent duplicate API calls) ── */
  const inflightUpload = useRef(false);
  const inflightQuery = useRef(false);
  const inflightTranslate = useRef(false);
  const inflightLawyers = useRef(false);

  /* ═══════════════ HANDLERS (logic unchanged) ═══════════════ */

  const handleSpeak = useCallback(async (textToSpeak, lang) => {
    if (!textToSpeak) return;
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }
    setTtsLoading(true);
    setTtsError(null);
    try {
      const result = await textToSpeech(textToSpeak, lang);
      const url = result.audio_url;
      setTtsAudioUrl(url);
      if (audioRef.current) {
        audioRef.current.src = url;
      } else {
        audioRef.current = new Audio(url);
      }
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => {
        setIsPlaying(false);
        setTtsError('Audio playback failed');
      };
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      setTtsError(err.message || 'Text-to-speech failed');
    } finally {
      setTtsLoading(false);
    }
  }, [isPlaying]);

  const handleTranslate = useCallback(async () => {
    if (!answer || inflightTranslate.current) return;
    inflightTranslate.current = true;
    setTranslateLoading(true);
    setTranslateError(null);
    setTranslatedText('');
    setTtsAudioUrl('');
    setTtsError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    try {
      const result = await translateText(answer, targetLang);
      setTranslatedText(result.translated_text);
    } catch (err) {
      setTranslateError(err.message || 'Translation failed. Please try again.');
    } finally {
      setTranslateLoading(false);
      inflightTranslate.current = false;
    }
  }, [answer, targetLang]);

  const startRecording = useCallback(() => {
    setVoiceInputError(null);
    setDetectedLang('');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceInputError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = '';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let finalTranscript = '';
    let interimTranscript = '';

    recognition.onresult = (event) => {
      finalTranscript = '';
      interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      const combined = (finalTranscript + interimTranscript).trim();
      if (combined) setQuestion(combined);
      const text = (finalTranscript + interimTranscript).trim();
      if (text) {
        const detected = detectScriptLanguage(text);
        if (detected) setDetectedLang(detected);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (finalTranscript.trim()) setQuestion(finalTranscript.trim());
    };

    recognition.onerror = (event) => {
      setIsRecording(false);
      if (event.error === 'not-allowed') {
        setVoiceInputError('Microphone access denied. Please allow mic permission.');
      } else if (event.error === 'no-speech') {
        setVoiceInputError('No speech detected. Please try again.');
      } else if (event.error === 'language-not-supported') {
        recognition.lang = 'en-IN';
        recognition.start();
        return;
      } else {
        setVoiceInputError(`Speech recognition error: ${event.error}`);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || inflightUpload.current) return;
    inflightUpload.current = true;
    setUploadLoading(true);
    setUploadError(null);
    setUploadResult(null);
    setSimplifyResult(null);
    setSimplifyError(null);
    setAnswer(null);
    setSources([]);
    setLawyers([]);
    try {
      // Stage 1: Upload + extract + embed on backend
      setUploadStage('extracting');
      const result = await uploadDocument(file);
      setUploadResult(result);
      setUploadStage('indexing');
      const s = await getStatus();
      setStatus(s);
      
      // Stage 2: Auto-trigger document simplification
      setUploadStage('analyzing');
      setSimplifyLoading(true);
      try {
        const simplifyRes = await getPlainLanguage('', result.filename || '');
        setSimplifyResult(simplifyRes);

        // Auto-detect practice area from simplified content
        const docType = simplifyRes?.structured?.document_type || '';
        const summary = simplifyRes?.structured?.plain_english_summary || '';
        const rawSnippet = (simplifyRes?.raw_text || '').slice(0, 3000);
        const detectionText = `${docType} ${summary} ${rawSnippet}`;
        const detected = detectPracticeAreaFromText(detectionText);
        if (detected) setPracticeArea(detected);
      } catch (simplifyErr) {
        setSimplifyError(simplifyErr.message || 'Document analysis failed');
      } finally {
        setSimplifyLoading(false);
      }
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploadLoading(false);
      setUploadStage('');
      inflightUpload.current = false;
    }
  }, []);

  const handleQuery = useCallback(async (e) => {
    e.preventDefault();
    if (!question.trim() || inflightQuery.current) return;
    inflightQuery.current = true;
    setQueryLoading(true);
    setQueryError(null);
    try {
      const result = await queryRAG(question.trim());
      setAnswer(result.answer);
      setSources(result.sources || []);
      const combined = `${question} ${result.answer}`;
      const detected = detectPracticeAreaFromText(combined);
      if (detected && !practiceArea) setPracticeArea(detected);
    } catch (err) {
      setQueryError(err.message || 'Query failed');
    } finally {
      setQueryLoading(false);
      inflightQuery.current = false;
    }
  }, [question, practiceArea]);

  const handleDiscoverLawyers = useCallback(async (e) => {
    e.preventDefault();
    if (!practiceArea.trim() || !city.trim() || inflightLawyers.current) return;
    inflightLawyers.current = true;
    setLawyerLoading(true);
    setLawyerError(null);
    setLawyers([]);
    try {
      const result = await getLawyerRecommendations({
        practice_area: practiceArea.trim(),
        preferred_city: city.trim(),
        keywords: [],
        max_results: 10,
      });
      setLawyers(result.lawyers || []);
    } catch (err) {
      setLawyerError(err.message || 'Lawyer discovery failed');
    } finally {
      setLawyerLoading(false);
      inflightLawyers.current = false;
    }
  }, [practiceArea, city]);

  const handleClear = useCallback(async () => {
    try {
      await clearStore();
    } catch (err) {
      console.error('Clear store failed:', err);
    }
    setUploadResult(null);
    setSimplifyResult(null);
    setSimplifyError(null);
    setAnswer(null);
    setSources([]);
    setStatus(null);
    setQuestion('');
    setLawyers([]);
    setPracticeArea('');
    setCity('');
    setTranslatedText('');
    setTranslateError(null);
    setTtsAudioUrl('');
    setTtsError(null);
    setIsPlaying(false);
  }, []);

  const onQuestionChange = useCallback((e) => setQuestion(e.target.value), []);
  const onPracticeAreaChange = useCallback((e) => setPracticeArea(e.target.value), []);
  const onCityChange = useCallback((e) => setCity(e.target.value), []);
  const onTargetLangChange = useCallback((e) => {
    setTargetLang(e.target.value);
    setTranslatedText('');
  }, []);
  const onSpeakClick = useCallback(() => handleSpeak(translatedText, targetLang), [handleSpeak, translatedText, targetLang]);

  /* ── Memoized derived data ── */
  const selectedLangLabel = useMemo(
    () => LANGUAGES.find((l) => l.value === targetLang)?.label || '',
    [targetLang]
  );

  const showClearBtn = uploadResult || lawyers.length > 0;

  /* ═══════════════════════ RENDER ════════════════════════════ */
  return (
    <div className="min-h-screen bg-parchment-200 text-ink-500 font-body selection:bg-gold-400/20">

      {/* ═══════════════════ GRAND HEADER ═══════════════════ */}
      <header className="sticky top-0 z-50 bg-parchment-200/95 backdrop-blur-sm border-b-2 border-gold-400/30">
        <div className="h-1 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />

        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-sm border-2 border-gold-400/50 bg-gradient-to-br from-maroon-500 to-maroon-600 flex items-center justify-center shadow-md">
              <Scale className="w-7 h-7 text-gold-100" />
            </div>
            <div>
              <h1 className="font-display text-[1.75rem] sm:text-[2rem] font-bold text-ink-500 tracking-tight leading-none">
                Samvidhaan AI
              </h1>
              <p className="font-accent text-[0.9rem] sm:text-[0.9375rem] text-ink-300 tracking-[0.15em] uppercase mt-1">
                Constitutional Document Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <a
              href="/case-strategy"
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-sm border border-gold-400/30 bg-gradient-to-b from-gold-50/50 to-parchment-200/50 font-accent text-[0.8125rem] tracking-[0.1em] uppercase text-gold-700 hover:border-gold-500/50 hover:bg-gold-50 transition-all duration-200"
            >
              <Sparkles className="w-4 h-4" />
              Case Strategy
            </a>
            {status && (
              <div className="hidden sm:flex items-center gap-2.5 font-accent text-[0.9rem] text-ink-300 bg-parchment-400/40 px-4 py-2.5 border border-gold-400/25 rounded-sm">
                <span className="w-2 h-2 rounded-full bg-gold-500" />
                <span>{status.total_vectors} Records</span>
                <span className="text-gold-600">&bull;</span>
                <span>{status.documents?.length || 0} Documents</span>
              </div>
            )}
            {showClearBtn && (
              <button
                onClick={handleClear}
                className="p-3 rounded-sm text-ink-200 hover:text-maroon-500 hover:bg-maroon-50 border border-transparent hover:border-maroon-200 transition-all duration-200"
                title="Clear all records"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            {/* User avatar + logout */}
            {authUser && (
              <div className="flex items-center gap-2.5 pl-2 border-l border-gold-400/25">
                {authUser.picture ? (
                  <img src={authUser.picture} alt="" className="w-8 h-8 rounded-full border border-gold-400/40" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-maroon-500 text-gold-100 flex items-center justify-center font-accent text-xs uppercase">
                    {(authUser.given_name || authUser.name || 'U')[0]}
                  </div>
                )}
                <button
                  onClick={() => { useAuthStore.getState().logout(); navigate('/login'); }}
                  className="p-2 rounded-sm text-ink-200 hover:text-maroon-500 hover:bg-maroon-50 border border-transparent hover:border-maroon-200 transition-all duration-200"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-gold-600/30 to-transparent" />
      </header>

      {/* ═══════════════════ MAIN MANUSCRIPT ═══════════════════ */}
      <main className="max-w-[1200px] mx-auto px-6 sm:px-10 py-12 sm:py-16">

        <PipelineSteps />

        <OrnamentDivider />

        {/* ═══ ARTICLE I — Document Submission ═══ */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="manuscript-frame rounded-sm p-7 sm:p-10"
        >
          <ArticleHeading
            number="I"
            title="Document Submission"
            subtitle="Submit an official document for archival processing"
            icon={Upload}
          />

          <label
            className={cn(
              'group flex flex-col items-center justify-center gap-4 rounded-sm border-2 border-dashed p-8 sm:p-12 cursor-pointer transition-all duration-500',
              uploadLoading
                ? 'border-gold-400/50 bg-gold-50/30'
                : 'border-parchment-600/50 hover:border-gold-400/60 hover:bg-gold-50/20'
            )}
          >
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp"
              onChange={handleUpload}
              disabled={uploadLoading}
              className="hidden"
            />
            {uploadLoading ? (
              <>
                <Loader2 className="w-9 h-9 text-gold-600 animate-spin" />
                <span className="font-accent text-[0.9rem] tracking-wider text-ink-300 uppercase">
                  {uploadStage === 'reading' && 'Reading document\u2026'}
                  {uploadStage === 'extracting' && 'Extracting & indexing\u2026'}
                  {uploadStage === 'indexing' && 'Building knowledge base\u2026'}
                  {uploadStage === 'analyzing' && 'Analyzing content\u2026'}
                  {!uploadStage && 'Processing\u2026'}
                </span>
                {/* Mini pipeline steps */}
                <div className="flex items-center gap-2 mt-2">
                  {['reading', 'extracting', 'indexing', 'analyzing'].map((step, idx) => {
                    const stages = ['reading', 'extracting', 'indexing', 'analyzing'];
                    const currentIdx = stages.indexOf(uploadStage);
                    const isDone = idx < currentIdx;
                    const isActive = idx === currentIdx;
                    return (
                      <div key={step} className="flex items-center gap-1.5">
                        <div className={cn(
                          'w-2 h-2 rounded-full transition-all duration-300',
                          isDone ? 'bg-gold-500 scale-100' : isActive ? 'bg-gold-400 animate-pulse scale-125' : 'bg-parchment-500/40 scale-75'
                        )} />
                        {idx < 3 && <div className={cn('w-4 h-px', isDone ? 'bg-gold-400' : 'bg-parchment-500/30')} />}
                      </div>
                    );
                  })}
                </div>
                <span className="font-body text-[0.8rem] text-ink-200 mt-1">
                  {uploadStage === 'extracting' ? 'OCR + text extraction in progress' : 'This typically takes a few seconds'}
                </span>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-sm border-2 border-parchment-600/40 bg-parchment-300/40 flex items-center justify-center group-hover:border-gold-400/50 transition-colors duration-500">
                  <Upload className="w-7 h-7 text-ink-200 group-hover:text-gold-600 transition-colors duration-500" />
                </div>
                <div className="text-center">
                  <span className="font-display text-[1.05rem] text-ink-400 font-medium">
                    Click to submit a document
                  </span>
                  <span className="block font-body text-[0.95rem] text-ink-300 mt-1.5 italic">
                    Accepted formats: PDF, PNG, JPG, TIFF, BMP, WebP
                  </span>
                </div>
              </>
            )}
          </label>

          {/* Upload Error */}
          <AnimatePresence>
            {uploadError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 flex items-center gap-3 text-[0.9rem] text-maroon-500 bg-maroon-50/60 border border-maroon-200/50 rounded-sm px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-body">{uploadError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload Result */}
          <AnimatePresence>
            {uploadResult && !uploadLoading && <UploadStats uploadResult={uploadResult} />}
          </AnimatePresence>
        </motion.section>

        {/* ═══ DOCUMENT SIMPLIFIER — Auto-triggered after upload ═══ */}
        <AnimatePresence>
          {(uploadResult || simplifyLoading) && (
            <>
              <OrnamentDivider />
              <motion.section
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={fadeIn}
                className="manuscript-frame rounded-sm p-7 sm:p-10"
              >
                <ArticleHeading
                  title="Dynamic Legal Document Simplifier"
                  subtitle="Intelligent document decoding — plain English summary with actionable insights"
                  icon={ScrollText}
                />

                {simplifyLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-4">
                    <Loader2 className="w-10 h-10 text-gold-600 animate-spin" />
                    <span className="font-accent text-[0.9rem] tracking-wider text-ink-300 uppercase">
                      Analyzing Document&hellip;
                    </span>
                    <span className="font-body text-[0.85rem] text-ink-300">
                      Extracting key clauses, obligations &amp; warnings
                    </span>
                    <SkeletonPulse lines={4} className="w-full max-w-xl mt-4" />
                  </div>
                ) : simplifyError ? (
                  <div className="flex items-center gap-3 text-[0.9rem] text-maroon-500 bg-maroon-50/60 border border-maroon-200/50 rounded-sm px-4 py-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="font-body">{simplifyError}</span>
                  </div>
                ) : simplifyResult?.structured ? (
                  <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
                    {/* Document Type Badge */}
                    {simplifyResult.structured.document_type && (
                      <motion.div variants={reducedFadeIn} className="flex items-center gap-2">
                        <span className="font-accent text-[0.85rem] tracking-[0.15em] uppercase text-ink-300">Document Type:</span>
                        <span className="px-3 py-1.5 rounded-sm bg-gold-100 border border-gold-400/40 font-accent text-[0.875rem] tracking-wider text-gold-700 uppercase">
                          {simplifyResult.structured.document_type}
                        </span>
                      </motion.div>
                    )}

                    {/* Plain English Summary */}
                    {simplifyResult.structured.plain_english_summary && (
                      <motion.div variants={reducedFadeIn} className="border border-gold-400/30 rounded-sm p-5 bg-gradient-to-b from-gold-50/50 to-parchment-50">
                        <h3 className="flex items-center gap-2 font-accent text-[0.875rem] tracking-[0.15em] uppercase text-gold-700 mb-3">
                          <FileText className="w-4 h-4" />
                          Plain English Summary
                        </h3>
                        <p className="font-body text-[1.05rem] text-ink-400 leading-[1.9]">
                          {simplifyResult.structured.plain_english_summary}
                        </p>
                      </motion.div>
                    )}

                    {/* Key Obligations */}
                    {simplifyResult.structured.key_obligations?.length > 0 && (
                      <motion.div variants={reducedFadeIn} className="border border-maroon-300/40 rounded-sm p-5 bg-gradient-to-b from-maroon-50/30 to-parchment-50">
                        <h3 className="flex items-center gap-2 font-accent text-[0.875rem] tracking-[0.15em] uppercase text-maroon-600 mb-3">
                          <ListChecks className="w-4 h-4" />
                          Key Obligations
                        </h3>
                        <ul className="space-y-2.5">
                          {simplifyResult.structured.key_obligations.map((item, i) => (
                            <li key={i} className="flex items-start gap-3 font-body text-[1rem] text-ink-400">
                              <CheckCircle className="w-4 h-4 text-maroon-500 shrink-0 mt-1" />
                              <span>{typeof item === 'string' ? item : item.obligation || item.description || JSON.stringify(item)}</span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}

                    {/* What You Must Do Next */}
                    {simplifyResult.structured.what_you_must_do_next?.length > 0 && (
                      <motion.div variants={reducedFadeIn} className="border border-gold-400/40 rounded-sm p-5 bg-gradient-to-b from-gold-100/40 to-parchment-50">
                        <h3 className="flex items-center gap-2 font-accent text-[0.875rem] tracking-[0.15em] uppercase text-gold-700 mb-3">
                          <ChevronRight className="w-4 h-4" />
                          What You Must Do Next
                        </h3>
                        <ol className="space-y-2.5 list-decimal list-inside">
                          {simplifyResult.structured.what_you_must_do_next.map((item, i) => (
                            <li key={i} className="font-body text-[1rem] text-ink-400 leading-relaxed">
                              {typeof item === 'string' ? item : item.action || item.step || JSON.stringify(item)}
                            </li>
                          ))}
                        </ol>
                      </motion.div>
                    )}

                    {/* Deadlines Extracted */}
                    {simplifyResult.structured.deadlines_extracted?.length > 0 && (
                      <motion.div variants={reducedFadeIn} className="border border-maroon-400/50 rounded-sm p-5 bg-gradient-to-b from-maroon-50/40 to-parchment-50">
                        <h3 className="flex items-center gap-2 font-accent text-[0.875rem] tracking-[0.15em] uppercase text-maroon-600 mb-3">
                          <Clock className="w-4 h-4" />
                          Deadlines Extracted
                        </h3>
                        <div className="space-y-3">
                          {simplifyResult.structured.deadlines_extracted.map((dl, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-parchment-100/60 rounded-sm border border-maroon-200/30">
                              <span className="w-8 h-8 rounded-sm bg-maroon-100 border border-maroon-300/50 flex items-center justify-center text-sm font-bold text-maroon-600 font-accent shrink-0">
                                {i + 1}
                              </span>
                              <div>
                                <span className="font-display text-[1rem] font-medium text-ink-500 block">
                                  {typeof dl === 'string' ? dl : dl.deadline || dl.date || 'Deadline'}
                                </span>
                                {typeof dl === 'object' && dl.description && (
                                  <span className="font-body text-[0.9rem] text-ink-300 block mt-1">{dl.description}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Overall Warnings */}
                    {simplifyResult.structured.overall_warnings && (
                      <motion.div variants={reducedFadeIn} className="border-2 border-maroon-400/60 rounded-sm p-5 bg-maroon-50/50">
                        <h3 className="flex items-center gap-2 font-accent text-[0.875rem] tracking-[0.15em] uppercase text-maroon-600 mb-3">
                          <AlertCircle className="w-4 h-4" />
                          Important Warnings
                        </h3>
                        <p className="font-body text-[1rem] text-maroon-700 leading-relaxed">
                          {simplifyResult.structured.overall_warnings}
                        </p>
                      </motion.div>
                    )}

                    {/* Simplified Explanations (collapsible) */}
                    {simplifyResult.structured.simplified_explanation?.length > 0 && (
                      <motion.div variants={reducedFadeIn} className="border border-parchment-600/30 rounded-sm p-5">
                        <h3 className="flex items-center gap-2 font-accent text-[0.875rem] tracking-[0.15em] uppercase text-ink-300 mb-4">
                          <BookOpen className="w-4 h-4" />
                          Clause-by-Clause Breakdown
                        </h3>
                        <div className="space-y-4">
                          {simplifyResult.structured.simplified_explanation.slice(0, 5).map((clause, i) => (
                            <div key={i} className="p-4 bg-parchment-50/60 rounded-sm border border-parchment-500/20">
                              {clause.original_clause && (
                                <p className="font-body text-[0.9rem] text-ink-200 italic border-l-2 border-gold-400/40 pl-3 mb-3">
                                  "{clause.original_clause.substring(0, 200)}{clause.original_clause.length > 200 ? '...' : ''}"
                                </p>
                              )}
                              {clause.simple_english && (
                                <p className="font-body text-[1rem] text-ink-400 mb-2">
                                  <span className="font-semibold text-gold-700">In Simple Terms:</span> {clause.simple_english}
                                </p>
                              )}
                              {clause.what_this_means_for_you && (
                                <p className="font-body text-[0.95rem] text-ink-300">
                                  <span className="font-semibold text-maroon-600">What This Means:</span> {clause.what_this_means_for_you}
                                </p>
                              )}
                              {clause.be_careful_warning && (
                                <p className="font-body text-[0.9rem] text-maroon-500 mt-2 flex items-start gap-2">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  {clause.be_careful_warning}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ) : simplifyResult?.raw_text ? (
                  <div className="font-body text-[1.05rem] text-ink-400 leading-[1.9] whitespace-pre-wrap p-5 bg-parchment-50/50 border border-parchment-600/20 rounded-sm">
                    {simplifyResult.raw_text}
                  </div>
                ) : null}
              </motion.section>
            </>
          )}
        </AnimatePresence>

        <OrnamentDivider />

        {/* ═══ ARTICLE II — Inquiry & Examination ═══ */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="manuscript-frame rounded-sm p-7 sm:p-10"
        >
          <ArticleHeading
            number="II"
            title="Inquiry &amp; Examination"
            subtitle="Pose questions upon the submitted document — type or speak in any Indian language"
            icon={MessageSquare}
          />

          <form onSubmit={handleQuery} className="space-y-4">
            <div className="flex gap-3.5">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={question}
                  onChange={onQuestionChange}
                  placeholder={uploadResult ? 'State your inquiry upon the document…' : 'Submit a document first…'}
                  disabled={queryLoading || !uploadResult || voiceInputLoading}
                  className="w-full input-formal rounded-sm px-5 py-4 pr-14 text-[1.125rem]"
                />
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={!uploadResult || queryLoading || voiceInputLoading}
                  className={cn(
                    'absolute right-3.5 top-1/2 -translate-y-1/2 p-2 rounded-sm transition-all duration-200',
                    isRecording
                      ? 'bg-maroon-500 text-parchment-50 shadow-md animate-pulse'
                      : 'text-ink-200 hover:text-gold-600 hover:bg-gold-50 disabled:opacity-20 disabled:hover:bg-transparent'
                  )}
                  title={isRecording ? 'Stop recording' : 'Voice input — speak in any language'}
                >
                  {isRecording ? (
                    <Square className="w-5 h-5" fill="currentColor" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
              </div>
              <button
                type="submit"
                disabled={queryLoading || !question.trim() || !uploadResult}
                className="btn-gold px-6 py-4 rounded-sm flex items-center gap-2.5 shrink-0"
              >
                {queryLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                <span className="hidden sm:inline">Submit</span>
              </button>
            </div>
          </form>

          {/* Recording indicator */}
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 flex items-center gap-3 text-[0.9rem] text-maroon-500 bg-maroon-50/50 border border-maroon-200/40 rounded-sm px-4 py-3"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-maroon-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-maroon-500" />
                </span>
                <span className="font-body italic">
                  Recording in session&hellip; speak in any language, then press stop.
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Detected language */}
          {detectedLang && !isRecording && !voiceInputLoading && (
            <div className="mt-3 inline-flex items-center gap-2 font-accent text-[0.8rem] tracking-wider text-gold-600 bg-gold-50/50 px-3 py-1.5 border border-gold-400/25 rounded-sm">
              <Globe className="w-3.5 h-3.5" />
              Language Detected: <span className="font-semibold">{detectedLang}</span>
            </div>
          )}

          {/* Query Skeleton */}
          {queryLoading && (
            <div className="mt-5 p-5 border border-parchment-600/20 rounded-sm bg-parchment-50/40">
              <SkeletonPulse lines={4} />
            </div>
          )}

          {/* Errors */}
          <AnimatePresence>
            {voiceInputError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3 text-[0.9rem] text-maroon-500 bg-maroon-50/50 border border-maroon-200/40 rounded-sm px-4 py-3 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {voiceInputError}
              </motion.p>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {queryError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3 text-[0.9rem] text-maroon-500 bg-maroon-50/50 border border-maroon-200/40 rounded-sm px-4 py-3 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {queryError}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ═══ ARTICLE III — Official Response ═══ */}
        <AnimatePresence>
          {answer && (
            <>
              <OrnamentDivider />

              <motion.section
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={fadeIn}
                className="manuscript-frame rounded-sm p-7 sm:p-10"
              >
                {/* Header + Translation Controls */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 mb-8">
                  <ArticleHeading
                    number="III"
                    title="Official Response"
                    icon={Sparkles}
                  />

                  <div className="flex items-center gap-2.5 shrink-0">
                    <select
                      value={targetLang}
                      onChange={onTargetLangChange}
                      className="input-formal rounded-sm px-3 py-2.5 text-[1rem] cursor-pointer font-accent"
                    >
                      {LANGUAGES.map((lang) => (
                        <option key={lang.value} value={lang.value}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleTranslate}
                      disabled={translateLoading}
                      className="btn-plaque px-4 py-2.5 rounded-sm flex items-center gap-2"
                    >
                      {translateLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Languages className="w-4 h-4" />
                      )}
                      {translateLoading ? 'Translating…' : 'Translate'}
                    </button>
                  </div>
                </div>

                {/* Answer Text */}
                <div className="font-body text-[1.125rem] sm:text-[1.1875rem] text-ink-400 leading-[1.9] whitespace-pre-wrap pl-6 border-l-[3px] border-gold-400/30">
                  {answer}
                </div>

                {/* Translation Error */}
                <AnimatePresence>
                  {translateError && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-5 text-[1rem] text-maroon-500 bg-maroon-50/50 border border-maroon-200/40 rounded-sm px-5 py-3.5 flex items-center gap-2.5"
                    >
                      <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                      {translateError}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Translated Text */}
                <AnimatePresence>
                  {translatedText && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-7 pt-7 border-t border-gold-400/20"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 font-accent text-[0.8rem] tracking-[0.15em] uppercase text-gold-600">
                          <Languages className="w-4 h-4" />
                          Translation — {selectedLangLabel}
                        </div>
                        <button
                          onClick={onSpeakClick}
                          disabled={ttsLoading}
                          className={cn(
                            'btn-plaque px-3 py-1.5 rounded-sm flex items-center gap-1.5 text-[0.75rem]',
                            isPlaying && 'border-maroon-400 bg-gradient-to-b from-maroon-100 to-maroon-200 text-maroon-700'
                          )}
                        >
                          {ttsLoading ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Loading…
                            </>
                          ) : isPlaying ? (
                            <>
                              <Square className="w-3 h-3" fill="currentColor" />
                              Stop
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              Speak Aloud
                            </>
                          )}
                        </button>
                      </div>
                      <div className="font-body text-[1.05rem] text-ink-400 leading-[1.9] whitespace-pre-wrap bg-gold-50/30 border border-gold-400/15 rounded-sm p-5 sm:p-6">
                        {translatedText}
                      </div>
                      {ttsError && (
                        <p className="mt-2 text-[0.8rem] text-maroon-500 flex items-center gap-1.5">
                          <AlertCircle className="w-3 h-3" />
                          {ttsError}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Sources */}
                {sources.length > 0 && (
                  <div className="mt-7 pt-7 border-t border-parchment-600/30">
                    <h3 className="font-accent text-[0.85rem] tracking-[0.2em] uppercase text-ink-300 mb-4">
                      Referenced Sources
                    </h3>
                    <div className="space-y-2.5">
                      {sources.map((src, i) => (
                        <SourceItem key={i} src={src} index={i} />
                      ))}
                    </div>
                  </div>
                )}
              </motion.section>
            </>
          )}
        </AnimatePresence>

        <OrnamentDivider />

        {/* ═══ AI INTELLIGENCE FEATURES ═══ */}
        <AIFeatureCards />

        <OrnamentDivider />

        {/* ═══ ARTICLE IV — Legal Counsel Discovery ═══ */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="manuscript-frame rounded-sm p-7 sm:p-10"
        >
          <ArticleHeading
            number="IV"
            title="Legal Counsel Discovery"
            subtitle="Locate distinguished legal professionals by area of practice"
            icon={Briefcase}
          />

          <form onSubmit={handleDiscoverLawyers} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block font-accent text-[0.9rem] tracking-[0.15em] uppercase text-ink-300 mb-2.5">
                  Area of Practice
                </label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-parchment-700 pointer-events-none" />
                  <input
                    type="text"
                    value={practiceArea}
                    onChange={onPracticeAreaChange}
                    placeholder="e.g. Criminal Law, Property Law"
                    className="w-full input-formal rounded-sm pl-11 pr-5 py-4 text-[1.125rem]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-accent text-[0.9rem] tracking-[0.15em] uppercase text-ink-300 mb-2.5">
                  City or Jurisdiction
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-parchment-700 pointer-events-none" />
                  <input
                    type="text"
                    value={city}
                    onChange={onCityChange}
                    placeholder="e.g. Delhi, Mumbai, Bangalore"
                    className="w-full input-formal rounded-sm pl-11 pr-5 py-4 text-[1.125rem]"
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={lawyerLoading || !practiceArea.trim() || !city.trim()}
              className="w-full btn-maroon px-6 py-4 rounded-sm flex items-center justify-center gap-2.5"
            >
              {lawyerLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Searching the Register&hellip;
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Discover Legal Counsel
                </>
              )}
            </button>
          </form>

          {/* Lawyer Skeleton */}
          {lawyerLoading && (
            <div className="mt-6 space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="border border-parchment-600/20 rounded-sm p-6 bg-parchment-50/40 animate-pulse">
                  <div className="flex items-center gap-3.5 mb-3.5">
                    <div className="w-11 h-11 rounded-sm bg-parchment-400/50" />
                    <div className="flex-1 space-y-2.5">
                      <div className="h-5 bg-parchment-400/40 rounded-sm w-52" />
                      <div className="h-4 bg-parchment-400/30 rounded-sm w-36" />
                    </div>
                  </div>
                  <div className="ml-[58px] space-y-2.5">
                    <div className="h-4 bg-parchment-400/30 rounded-sm w-40" />
                    <div className="h-4 bg-parchment-400/25 rounded-sm w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <AnimatePresence>
            {lawyerError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 text-[0.9rem] text-maroon-500 bg-maroon-50/50 border border-maroon-200/40 rounded-sm px-4 py-3 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {lawyerError}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ═══ Lawyer Results ═══ */}
        <AnimatePresence>
          {lawyers.length > 0 && (
            <>
              <OrnamentDivider />

              <motion.section initial="hidden" animate="visible" variants={stagger}>
                <div className="flex items-baseline gap-4 mb-7">
                  <h2 className="font-display text-[1.5rem] sm:text-[1.625rem] font-semibold text-ink-500">
                    Register of Counsel
                  </h2>
                  <span className="font-accent text-[0.875rem] tracking-wider text-gold-600 border border-gold-400/30 bg-gold-50/40 px-3 py-1 rounded-sm">
                    {practiceArea} &bull; {city} &bull; {lawyers.length} found
                  </span>
                </div>

                <div className="space-y-5">
                  {lawyers.map((lawyer, i) => (
                    <LawyerCard key={i} lawyer={lawyer} index={i} />
                  ))}
                </div>
              </motion.section>
            </>
          )}
        </AnimatePresence>
      </main>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="mt-20">
        <div className="h-px bg-gradient-to-r from-transparent via-gold-400/30 to-transparent" />
        <div className="max-w-[1200px] mx-auto px-6 py-10 text-center">
          <p className="font-accent text-[0.9rem] tracking-[0.2em] uppercase text-ink-300">
            &copy; {new Date().getFullYear()} Samvidhaan AI &mdash; Constitutional Document Intelligence
          </p>
          <p className="font-accent text-[0.875rem] tracking-wider text-ink-200 mt-2.5">
            Powered by CODESKAD
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
