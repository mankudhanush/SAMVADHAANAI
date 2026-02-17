import React, { useState, useCallback } from 'react';
import { MessageSquare, Send, Loader2, AlertCircle, FileText } from 'lucide-react';
import useStore from '../store/useStore';
import { queryRAG } from '../services/api';

export default function QuerySection() {
    const { ragResult, ragLoading, ragError, setRagResult, setRagLoading, setRagError, sessionId, currentDocument } = useStore();
    const [question, setQuestion] = useState('');

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!question.trim()) return;

        setRagLoading(true);
        setRagError(null);
        try {
            const result = await queryRAG(question.trim(), sessionId);
            setRagResult(result);
        } catch (err) {
            setRagError(err.message || 'Query failed');
        } finally {
            setRagLoading(false);
        }
    }, [question, sessionId, setRagResult, setRagLoading, setRagError]);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                Ask a Question
            </h2>

            {!currentDocument && (
                <div className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3 mb-4">
                    Upload a document first to ask questions.
                </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g., What are the key risks in this document?"
                    disabled={ragLoading}
                    className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={ragLoading || !question.trim()}
                    className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    {ragLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Ask
                </button>
            </form>

            {/* Error */}
            {ragError && (
                <div className="mt-4 flex items-start gap-2 text-red-600 bg-red-50 rounded-lg p-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm">{ragError}</p>
                </div>
            )}

            {/* Result */}
            {ragResult && !ragLoading && (
                <div className="mt-4 space-y-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Answer</h3>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {ragResult.answer}
                        </div>
                    </div>

                    {ragResult.sources?.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Sources</h3>
                            <div className="space-y-2">
                                {ragResult.sources.map((src, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs bg-gray-50 rounded-lg p-3">
                                        <FileText className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-medium text-gray-700">
                                                [{src.source_id}] {src.document} — Page {src.page}
                                            </span>
                                            <span className="ml-2 text-gray-400">
                                                Score: {src.rerank_score?.toFixed(4)}
                                            </span>
                                            <p className="text-gray-500 mt-1">{src.chunk_preview}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
