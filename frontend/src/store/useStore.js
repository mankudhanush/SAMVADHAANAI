import { create } from 'zustand';

const useStore = create((set) => ({
    // ── Document state ──────────────────────────────────────
    activeDocumentId: null,
    currentDocument: null,
    uploadLoading: false,
    uploadError: null,

    // ── RAG Query state ─────────────────────────────────────
    ragResult: null,
    ragLoading: false,
    ragError: null,

    // ── Analysis state ──────────────────────────────────────
    analysisResult: null,
    analysisLoading: false,
    analysisError: null,

    // ── Web Search state ────────────────────────────────────
    searchResults: null,
    searchLoading: false,
    searchError: null,

    // ── Voice state ─────────────────────────────────────────
    voiceTranscript: null,
    voiceLoading: false,
    voiceError: null,

    // ── Session ─────────────────────────────────────────────
    sessionId: 'default',

    // ── Actions ─────────────────────────────────────────────
    setDocument: (doc) =>
        set({
            currentDocument: doc,
            activeDocumentId: doc?.filename || null,
            // Clear stale results from previous document
            ragResult: null,
            analysisResult: null,
            searchResults: null,
            voiceTranscript: null,
        }),

    setUploadLoading: (val) => set({ uploadLoading: val }),
    setUploadError: (err) => set({ uploadError: err }),

    setRagResult: (result) => set({ ragResult: result, ragError: null }),
    setRagLoading: (val) => set({ ragLoading: val }),
    setRagError: (err) => set({ ragError: err, ragLoading: false }),

    setAnalysis: (result) => set({ analysisResult: result, analysisError: null }),
    setAnalysisLoading: (val) => set({ analysisLoading: val }),
    setAnalysisError: (err) => set({ analysisError: err, analysisLoading: false }),

    setSearch: (results) => set({ searchResults: results, searchError: null }),
    setSearchLoading: (val) => set({ searchLoading: val }),
    setSearchError: (err) => set({ searchError: err, searchLoading: false }),

    setVoice: (transcript) => set({ voiceTranscript: transcript, voiceError: null }),
    setVoiceLoading: (val) => set({ voiceLoading: val }),
    setVoiceError: (err) => set({ voiceError: err, voiceLoading: false }),

    setSessionId: (id) => set({ sessionId: id }),

    clearAll: () =>
        set({
            activeDocumentId: null,
            currentDocument: null,
            ragResult: null,
            analysisResult: null,
            searchResults: null,
            voiceTranscript: null,
            uploadError: null,
            ragError: null,
            analysisError: null,
            searchError: null,
            voiceError: null,
        }),
}));

export default useStore;
