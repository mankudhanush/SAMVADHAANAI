import axios from 'axios';

// In dev mode, Vite proxy handles /api → http://localhost:8000
// In production, set VITE_API_BASE_URL to the backend origin
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 300000, // 5 min timeout for large document processing / AI analysis
});

// Response interceptor for structured error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const detail = error.response?.data?.detail;
        const message =
            (typeof detail === 'object' ? detail?.message : detail) ||
            error.response?.data?.message ||
            error.message ||
            'An unknown error occurred';
        console.error('API Error:', message);
        const enrichedError = new Error(message);
        enrichedError.status = error.response?.status;
        return Promise.reject(enrichedError);
    }
);

// ─── Document Upload ─────────────────────────────────────────
// ─── Document Upload ─────────────────────────────────────────
export const uploadDocument = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    // Large PDFs (300+ pages) can take several minutes for OCR + embedding
    const response = await api.post('/api/upload', formData, {
        timeout: 600000, // 10 min for large document processing
    });
    return response.data;
};

// ─── RAG Query ───────────────────────────────────────────────
export const queryRAG = async (question, sessionId = 'default') => {
    const response = await api.post('/api/query', {
        question,
        session_id: sessionId,
    });
    return response.data;
};

// ─── Document Analysis ──────────────────────────────────────
export const analyzeDocument = async () => {
    const response = await api.post('/api/analyze');
    return response.data;
};

// ─── Web Search ─────────────────────────────────────────────
export const webSearch = async (query, maxResults = 5) => {
    const response = await api.post('/api/web-search', {
        query,
        max_results: maxResults,
    });
    return response.data;
};

// ─── Voice Transcription ────────────────────────────────────
export const transcribeVoice = async (audioFile) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    const response = await api.post('/api/voice', formData);
    return response.data;
};

// ─── Risk Analysis (via RAG prompt — legacy) ────────────────
export const analyzeRisk = async (sessionId = 'default') => {
    const prompt = `Analyze this document. PERFORM A FULL CONTRACT RISK ANALYSIS (TYPE D).
Identify structural details, risky clauses, penalties, and missing elements.
Provide an overall risk score (0-100) and a fairness assessment.
Format your answer exactly as requested in the system prompt for TYPE D.`;
    return queryRAG(prompt, sessionId);
};

// ─── Plain Language (simplifier) ─────────────────────────────
export const getPlainLanguage = async (targetLanguage = '', documentName = '') => {
    // Map-reduce simplification on large docs may need multiple LLM calls
    const response = await api.post('/api/simplify', {
        target_language: targetLanguage,
        document_name: documentName,
    }, {
        timeout: 600000, // 10 min for large document simplification
    });
    return response.data;
};

// ─── Lawyer Discovery ────────────────────────────────────────
export const getLawyerRecommendations = async (criteria) => {
    const response = await api.post('/api/discover-lawyers', criteria);
    return response.data;
};

// ─── Translate ────────────────────────────────────────────────
export const translateText = async (text, targetLanguage) => {
    const response = await api.post('/api/translate', {
        text,
        target_language: targetLanguage,
    });
    return response.data;
};

// ─── Text-to-Speech ──────────────────────────────────────────
export const textToSpeech = async (text, language) => {
    const response = await api.post('/api/tts', {
        text,
        language,
    });
    return response.data;
};

// ─── Speech-to-Text (voice input for questions) ──────────────
export const speechToText = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    const response = await api.post('/api/speech-to-text', formData);
    return response.data;
};

// ─── Status ──────────────────────────────────────────────────
export const getStatus = async () => {
    const response = await api.get('/api/status');
    return response.data;
};

// ─── Clear Store ─────────────────────────────────────────────
export const clearStore = async () => {
    const response = await api.post('/api/clear');
    return response.data;
};
// ─── AI Case Strategy Simulator ──────────────────────────
export const simulateCaseStrategy = async (caseDescription, caseType, jurisdiction = null, mode = 'citizen') => {
    const response = await api.post('/api/case-strategy', {
        case_description: caseDescription,
        case_type: caseType,
        jurisdiction: jurisdiction || undefined,
        mode: mode,
    });
    return response.data;
};

// ─── Constitutional Intelligence Engine ──────────────────
export const analyzeConstitutionalIntelligence = async (documentText, mode = 'citizen') => {
    const response = await api.post('/api/constitutional-intelligence', {
        document_text: documentText,
        mode: mode,
    });
    return response.data;
};

export default api;
