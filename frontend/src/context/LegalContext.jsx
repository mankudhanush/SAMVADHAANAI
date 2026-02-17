import React, { createContext, useContext, useState, useCallback } from 'react';
import {
    uploadDocument,
    analyzeRisk,
    getPlainLanguage,
    getLawyerRecommendations,
    getStatus,
} from '../services/api';

const LegalContext = createContext(null);

export const useLegal = () => {
    const ctx = useContext(LegalContext);
    if (!ctx) throw new Error('useLegal must be used inside LegalProvider');
    return ctx;
};

export const LegalProvider = ({ children }) => {
    // ── state ──────────────────────────────────────────────────
    const [currentDocument, setCurrentDocument] = useState(null);
    const [sessionId, setSessionId] = useState('default');
    const [analysisResults, setAnalysisResults] = useState(null);
    const [simplification, setSimplification] = useState(null);
    const [lawyers, setLawyers] = useState(null);
    const [status, setStatus] = useState(null);

    const [loading, setLoading] = useState({
        upload: false,
        risk: false,
        simplify: false,
        lawyers: false,
    });

    const [error, setError] = useState(null);

    // ── helpers ────────────────────────────────────────────────
    const setLoadingKey = (key, val) =>
        setLoading((prev) => ({ ...prev, [key]: val }));

    const handleError = (err) => {
        const msg = err?.message || String(err);
        setError(msg);
        console.error('[LegalContext]', msg);
    };

    // ── actions ────────────────────────────────────────────────
    const processDocument = useCallback(async (file) => {
        setLoadingKey('upload', true);
        setError(null);
        try {
            const res = await uploadDocument(file);
            setCurrentDocument({ ...res, file });
            setSessionId(res.filename || 'default');
            // clear stale data from previous document
            setAnalysisResults(null);
            setSimplification(null);
            setLawyers(null);
            return res;
        } catch (err) {
            handleError(err);
            throw err;
        } finally {
            setLoadingKey('upload', false);
        }
    }, []);

    const runRiskAnalysis = useCallback(async () => {
        setLoadingKey('risk', true);
        setError(null);
        try {
            const res = await analyzeRisk(sessionId);
            setAnalysisResults(res);
            return res;
        } catch (err) {
            handleError(err);
            throw err;
        } finally {
            setLoadingKey('risk', false);
        }
    }, [sessionId]);

    const fetchSimplification = useCallback(async () => {
        setLoadingKey('simplify', true);
        setError(null);
        try {
            const res = await getPlainLanguage();
            setSimplification(res);
            return res;
        } catch (err) {
            handleError(err);
        } finally {
            setLoadingKey('simplify', false);
        }
    }, []);

    const fetchLawyers = useCallback(async (criteria) => {
        setLoadingKey('lawyers', true);
        setError(null);
        try {
            const res = await getLawyerRecommendations(criteria);
            // backend may return { lawyers: [...] } or an array directly
            const list = Array.isArray(res) ? res : res?.lawyers || res?.results || [];
            setLawyers(list);
            return list;
        } catch (err) {
            handleError(err);
        } finally {
            setLoadingKey('lawyers', false);
        }
    }, []);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await getStatus();
            setStatus(res);
            return res;
        } catch (err) {
            handleError(err);
        }
    }, []);

    // ── value ──────────────────────────────────────────────────
    const value = {
        currentDocument,
        sessionId,
        analysisResults,
        simplification,
        lawyers,
        status,
        loading,
        error,
        processDocument,
        runRiskAnalysis,
        fetchSimplification,
        fetchLawyers,
        fetchStatus,
        setError,
    };

    return (
        <LegalContext.Provider value={value}>{children}</LegalContext.Provider>
    );
};
