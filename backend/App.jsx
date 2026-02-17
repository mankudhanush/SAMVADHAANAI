import React, { useState, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale, Upload, FileText, MessageSquare, Send, Mic,
  Volume2, Languages, Search, MapPin,
  Loader2, ChevronRight, Sparkles, ExternalLink,
  Trash2, Database, Cpu, BookOpen,
  Square, Globe, AlertCircle, Briefcase,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  uploadDocument, queryRAG, getStatus, clearStore,
  getLawyerRecommendations, translateText, textToSpeech,
} from './services/api';

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
const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.4 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
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
  for (const area of PRACTICE_AREAS) {
    if (lower.includes(area.toLowerCase())) return area;
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
  <div className="flex items-start gap-3.5 sm:gap-4 mb-7">
    {Icon && (
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-sm border border-gold-400/40 bg-gradient-to-br from-gold-50 to-parchment-300 flex items-center justify-center shrink-0 shadow-sm">
        <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px] text-gold-600" />
      </div>
    )}
    <div>
      {number && (
        <span className="block font-accent text-[0.8rem] tracking-[0.25em] uppercase text-gold-600 mb-0.5">
          Article {number}
        </span>
      )}
      <h2 className="font-display text-[1.4rem] sm:text-[1.65rem] font-semibold text-ink-500 leading-snug">
        {title}
      </h2>
      {subtitle && (
        <p className="font-body text-[0.95rem] text-ink-200 italic mt-1 leading-relaxed">{subtitle}</p>
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
    transition={{ duration: 1.2, delay: 0.2 }}
    className="text-center mb-7"
  >
    <p className="font-accent text-[0.85rem] tracking-[0.2em] uppercase text-gold-600 mb-5">
      Document Processing Pipeline
    </p>
    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5">
      {PIPELINE_STEPS.map((step, i) => (
        <React.Fragment key={step.label}>
          <div className="flex items-center gap-1.5 px-3 py-2 border border-parchment-600/40 bg-parchment-50/60 font-accent text-[0.8rem] tracking-wider text-ink-300 rounded-sm">
            <step.icon className="w-3.5 h-3.5 text-gold-600" />
            {step.label}
          </div>
          {i < PIPELINE_STEPS.length - 1 && (
            <ChevronRight className="w-3 h-3 text-parchment-700" />
          )}
        </React.Fragment>
      ))}
    </div>
  </motion.div>
));
PipelineSteps.displayName = 'PipelineSteps';

/* ══════════ Memoized Skeleton Loader ══════════════════════ */
const SkeletonPulse = memo(({ lines = 3, className = '' }) => (
  <div className={cn('space-y-3 animate-pulse', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="h-4 bg-parchment-400/40 rounded-sm"
        style={{ width: i === lines - 1 ? '60%' : `${85 + Math.random() * 15}%` }}
      />
    ))}
  </div>
));
SkeletonPulse.displayName = 'SkeletonPulse';

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
      className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3"
    >
      {stats.map(({ label, value, icon: Icon }) => (
        <motion.div
          key={label}
          variants={fadeIn}
          className="rounded-sm border border-gold-400/30 bg-gradient-to-b from-parchment-50 to-parchment-200/50 p-4 text-center"
        >
          <Icon className="w-4 h-4 text-gold-600 mx-auto mb-2" />
          <div className="font-display text-lg sm:text-xl font-semibold text-ink-400 truncate">
            {value}
          </div>
          <div className="font-accent text-[0.7rem] text-ink-200 tracking-[0.2em] uppercase mt-1">
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
  <div className="flex items-center gap-3 text-[0.9rem] bg-parchment-50/50 border border-parchment-600/20 rounded-sm px-4 py-3">
    <span className="w-8 h-8 rounded-sm bg-gradient-to-b from-gold-100 to-gold-200 border border-gold-400/30 flex items-center justify-center text-xs font-bold text-gold-700 font-accent shrink-0">
      {src.source_id}
    </span>
    <span className="font-body text-ink-300 truncate flex-1 italic">
      {src.document}
    </span>
    <span className="font-accent text-ink-200 text-[0.8rem] shrink-0">
      Page {src.page}
    </span>
    {src.rerank_score != null && (
      <span className="font-accent text-[0.8rem] text-gold-600 shrink-0 tabular-nums">
        {src.rerank_score.toFixed(4)}
      </span>
    )}
  </div>
));
SourceItem.displayName = 'SourceItem';

/* ══════════ Memoized Lawyer Card ══════════════════════════ */
const LawyerCard = memo(({ lawyer, index }) => (
  <motion.div
    variants={fadeIn}
    className="manuscript-frame rounded-sm p-5 sm:p-6 hover:border-gold-400/50 transition-all duration-500"
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-10 h-10 rounded-sm bg-gradient-to-br from-maroon-500 to-maroon-600 text-parchment-50 flex items-center justify-center text-[0.9rem] font-bold font-display shrink-0 shadow-sm">
            {lawyer.rank || index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[1.15rem] sm:text-[1.25rem] font-semibold text-ink-500 truncate">
              {lawyer.name}
            </h3>
            {lawyer.firm && (
              <p className="font-accent text-[0.9rem] text-gold-600 italic truncate">
                {lawyer.firm}
              </p>
            )}
          </div>
        </div>

        <div className="ml-[52px] space-y-2">
          <p className="font-body text-[0.9rem] text-ink-200 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-parchment-700" />
            {lawyer.location}
          </p>
          <p className="font-body text-[0.9rem] text-ink-300 leading-relaxed line-clamp-2">
            {lawyer.snippet}
          </p>
          {lawyer.explanation && (
            <p className="font-body text-[0.9rem] text-gold-700 italic flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-gold-500" />
              {lawyer.explanation}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 text-center space-y-1.5">
        <div
          className={cn(
            'font-display text-2xl font-bold px-4 py-2 rounded-sm border',
            lawyer.score >= 60
              ? 'text-gold-700 bg-gold-50/60 border-gold-400/40'
              : lawyer.score >= 35
                ? 'text-ink-300 bg-parchment-300/40 border-parchment-600/30'
                : 'text-ink-200 bg-parchment-200/40 border-parchment-500/20'
          )}
        >
          {lawyer.score}
        </div>
        <span className="font-accent text-[0.65rem] tracking-[0.2em] uppercase text-ink-200 block">
          Relevance
        </span>
        {lawyer.website && (
          <a
            href={lawyer.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-accent text-[0.8rem] text-gold-600 hover:text-maroon-500 transition-colors mt-1"
          >
            <ExternalLink className="w-3 h-3" />
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
  /* ── Upload state ── */
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

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
    setAnswer(null);
    setSources([]);
    setLawyers([]);
    try {
      const result = await uploadDocument(file);
      setUploadResult(result);
      const s = await getStatus();
      setStatus(s);
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploadLoading(false);
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
    await clearStore();
    setUploadResult(null);
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

        <div className="max-w-[960px] mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-sm border-2 border-gold-400/50 bg-gradient-to-br from-maroon-500 to-maroon-600 flex items-center justify-center shadow-md">
              <Scale className="w-6 h-6 text-gold-100" />
            </div>
            <div>
              <h1 className="font-display text-[1.6rem] sm:text-[1.85rem] font-bold text-ink-500 tracking-tight leading-none">
                LegalWise
              </h1>
              <p className="font-accent text-[0.8rem] sm:text-[0.85rem] text-ink-200 tracking-[0.15em] uppercase mt-0.5">
                Constitutional Document Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {status && (
              <div className="hidden sm:flex items-center gap-2 font-accent text-[0.8rem] text-ink-200 bg-parchment-400/40 px-3.5 py-2 border border-gold-400/25 rounded-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />
                <span>{status.total_vectors} Records</span>
                <span className="text-gold-600">&bull;</span>
                <span>{status.documents?.length || 0} Documents</span>
              </div>
            )}
            {showClearBtn && (
              <button
                onClick={handleClear}
                className="p-2.5 rounded-sm text-ink-200 hover:text-maroon-500 hover:bg-maroon-50 border border-transparent hover:border-maroon-200 transition-all duration-300"
                title="Clear all records"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-gold-600/30 to-transparent" />
      </header>

      {/* ═══════════════════ MAIN MANUSCRIPT ═══════════════════ */}
      <main className="max-w-[960px] mx-auto px-5 sm:px-8 py-10 sm:py-14">

        <PipelineSteps />

        <OrnamentDivider />

        {/* ═══ ARTICLE I — Document Submission ═══ */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="manuscript-frame rounded-sm p-6 sm:p-9"
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
                  Processing Record&hellip;
                </span>
                <SkeletonPulse lines={2} className="w-48 mt-2" />
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
                  <span className="block font-body text-[0.9rem] text-ink-200 mt-1.5 italic">
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

        <OrnamentDivider />

        {/* ═══ ARTICLE II — Inquiry & Examination ═══ */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="manuscript-frame rounded-sm p-6 sm:p-9"
        >
          <ArticleHeading
            number="II"
            title="Inquiry &amp; Examination"
            subtitle="Pose questions upon the submitted document — type or speak in any Indian language"
            icon={MessageSquare}
          />

          <form onSubmit={handleQuery} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={question}
                  onChange={onQuestionChange}
                  placeholder={uploadResult ? 'State your inquiry upon the document…' : 'Submit a document first…'}
                  disabled={queryLoading || !uploadResult || voiceInputLoading}
                  className="w-full input-formal rounded-sm px-4 py-3.5 pr-12 text-[1.05rem]"
                />
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={!uploadResult || queryLoading || voiceInputLoading}
                  className={cn(
                    'absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-sm transition-all duration-300',
                    isRecording
                      ? 'bg-maroon-500 text-parchment-50 shadow-md animate-pulse'
                      : 'text-ink-200 hover:text-gold-600 hover:bg-gold-50 disabled:opacity-20 disabled:hover:bg-transparent'
                  )}
                  title={isRecording ? 'Stop recording' : 'Voice input — speak in any language'}
                >
                  {isRecording ? (
                    <Square className="w-4 h-4" fill="currentColor" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
              </div>
              <button
                type="submit"
                disabled={queryLoading || !question.trim() || !uploadResult}
                className="btn-gold px-5 py-3.5 rounded-sm flex items-center gap-2 shrink-0"
              >
                {queryLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
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
                className="manuscript-frame rounded-sm p-6 sm:p-9"
              >
                {/* Header + Translation Controls */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-7">
                  <ArticleHeading
                    number="III"
                    title="Official Response"
                    icon={Sparkles}
                  />

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={targetLang}
                      onChange={onTargetLangChange}
                      className="input-formal rounded-sm px-2.5 py-2 text-[0.9rem] cursor-pointer font-accent"
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
                      className="btn-plaque px-3.5 py-2 rounded-sm flex items-center gap-1.5"
                    >
                      {translateLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Languages className="w-3.5 h-3.5" />
                      )}
                      {translateLoading ? 'Translating…' : 'Translate'}
                    </button>
                  </div>
                </div>

                {/* Answer Text */}
                <div className="font-body text-[1.05rem] sm:text-[1.1rem] text-ink-400 leading-[1.9] whitespace-pre-wrap pl-5 border-l-[3px] border-gold-400/30">
                  {answer}
                </div>

                {/* Translation Error */}
                <AnimatePresence>
                  {translateError && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-4 text-[0.9rem] text-maroon-500 bg-maroon-50/50 border border-maroon-200/40 rounded-sm px-4 py-3 flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
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
                    <h3 className="font-accent text-[0.8rem] tracking-[0.2em] uppercase text-ink-200 mb-4">
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

        {/* ═══ ARTICLE IV — Legal Counsel Discovery ═══ */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="manuscript-frame rounded-sm p-6 sm:p-9"
        >
          <ArticleHeading
            number="IV"
            title="Legal Counsel Discovery"
            subtitle="Locate distinguished legal professionals by area of practice"
            icon={Briefcase}
          />

          <form onSubmit={handleDiscoverLawyers} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-accent text-[0.8rem] tracking-[0.15em] uppercase text-ink-200 mb-2">
                  Area of Practice
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-parchment-700 pointer-events-none" />
                  <input
                    type="text"
                    value={practiceArea}
                    onChange={onPracticeAreaChange}
                    placeholder="e.g. Criminal Law, Property Law"
                    className="w-full input-formal rounded-sm pl-10 pr-4 py-3.5 text-[1.05rem]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-accent text-[0.8rem] tracking-[0.15em] uppercase text-ink-200 mb-2">
                  City or Jurisdiction
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-parchment-700 pointer-events-none" />
                  <input
                    type="text"
                    value={city}
                    onChange={onCityChange}
                    placeholder="e.g. Delhi, Mumbai, Bangalore"
                    className="w-full input-formal rounded-sm pl-10 pr-4 py-3.5 text-[1.05rem]"
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={lawyerLoading || !practiceArea.trim() || !city.trim()}
              className="w-full btn-maroon px-5 py-3.5 rounded-sm flex items-center justify-center gap-2"
            >
              {lawyerLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching the Register&hellip;
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Discover Legal Counsel
                </>
              )}
            </button>
          </form>

          {/* Lawyer Skeleton */}
          {lawyerLoading && (
            <div className="mt-5 space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="border border-parchment-600/20 rounded-sm p-5 bg-parchment-50/40 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-sm bg-parchment-400/50" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-parchment-400/40 rounded-sm w-48" />
                      <div className="h-3 bg-parchment-400/30 rounded-sm w-32" />
                    </div>
                  </div>
                  <div className="ml-[52px] space-y-2">
                    <div className="h-3 bg-parchment-400/30 rounded-sm w-36" />
                    <div className="h-3 bg-parchment-400/25 rounded-sm w-full" />
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
                <div className="flex items-baseline gap-3 mb-6">
                  <h2 className="font-display text-[1.3rem] sm:text-[1.45rem] font-semibold text-ink-500">
                    Register of Counsel
                  </h2>
                  <span className="font-accent text-[0.8rem] tracking-wider text-gold-600 border border-gold-400/30 bg-gold-50/40 px-2.5 py-0.5 rounded-sm">
                    {practiceArea} &bull; {city} &bull; {lawyers.length} found
                  </span>
                </div>

                <div className="space-y-4">
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
      <footer className="mt-16">
        <div className="h-px bg-gradient-to-r from-transparent via-gold-400/30 to-transparent" />
        <div className="max-w-[960px] mx-auto px-6 py-8 text-center">
          <p className="font-accent text-[0.8rem] tracking-[0.2em] uppercase text-ink-200">
            &copy; {new Date().getFullYear()} LegalWise &mdash; Constitutional Document Intelligence
          </p>
          <p className="font-accent text-[0.7rem] tracking-wider text-parchment-700 mt-2">
            Powered by Retrieval-Augmented Generation &bull; Large Language Models
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
