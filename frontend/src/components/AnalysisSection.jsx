import React, { useCallback } from 'react';
import { Shield, Loader2, AlertCircle, AlertTriangle, FileCheck } from 'lucide-react';
import useStore from '../store/useStore';
import { analyzeDocument } from '../services/api';

export default function AnalysisSection() {
    const { analysisResult, analysisLoading, analysisError, setAnalysis, setAnalysisLoading, setAnalysisError, currentDocument } = useStore();

    const handleAnalyze = useCallback(async () => {
        setAnalysisLoading(true);
        setAnalysisError(null);
        try {
            const result = await analyzeDocument();
            setAnalysis(result);
        } catch (err) {
            setAnalysisError(err.message || 'Analysis failed');
        } finally {
            setAnalysisLoading(false);
        }
    }, [setAnalysis, setAnalysisLoading, setAnalysisError]);

    const renderSection = (title, icon, data) => {
        if (!data) return null;
        const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        return (
            <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    {icon}
                    {title}
                </h3>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed overflow-auto max-h-60">
                    {content}
                </pre>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Document Analysis
            </h2>

            {!currentDocument && (
                <div className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3 mb-4">
                    Upload a document first to run analysis.
                </div>
            )}

            <button
                onClick={handleAnalyze}
                disabled={analysisLoading || !currentDocument}
                className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
                {analysisLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing…
                    </>
                ) : (
                    <>
                        <Shield className="w-4 h-4" />
                        Run Full Analysis
                    </>
                )}
            </button>

            {/* Error */}
            {analysisError && (
                <div className="mt-4 flex items-start gap-2 text-red-600 bg-red-50 rounded-lg p-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm">{analysisError}</p>
                </div>
            )}

            {/* Results */}
            {analysisResult && !analysisLoading && (
                <div className="mt-4 space-y-3">
                    {renderSection('Risks', <AlertTriangle className="w-4 h-4 text-red-500" />, analysisResult.risks)}
                    {renderSection('Key Clauses', <FileCheck className="w-4 h-4 text-blue-500" />, analysisResult.key_clauses)}
                    {renderSection('Summary', <FileCheck className="w-4 h-4 text-green-500" />, analysisResult.summary)}
                    {renderSection('Classification', <Shield className="w-4 h-4 text-purple-500" />, analysisResult.classification)}
                </div>
            )}
        </div>
    );
}
