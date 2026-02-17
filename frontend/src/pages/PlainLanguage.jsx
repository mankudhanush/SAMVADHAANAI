import React, { useEffect } from 'react';
import { useLegal } from '../context/LegalContext';
import { FileText, Loader2, BookOpen, AlertTriangle } from 'lucide-react';

const PlainLanguage = () => {
    const { fetchSimplification, simplification, loading, currentDocument, error } = useLegal();

    useEffect(() => {
        if (currentDocument && !simplification && !loading.simplify) {
            fetchSimplification();
        }
    }, [currentDocument]);

    // ── empty state ──
    if (!currentDocument) {
        return (
            <div className="text-center p-12 text-gray-500">
                <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-xl">Upload a document first.</p>
                <p className="text-sm mt-2">Go to "Document Upload" and analyze a file.</p>
            </div>
        );
    }

    // ── loading state ──
    if (loading.simplify) {
        return (
            <div className="text-center py-20">
                <Loader2 size={48} className="animate-spin mx-auto text-accent mb-4" />
                <h3 className="text-xl font-bold text-gray-900">Simplifying Legalese...</h3>
                <p className="text-gray-500 mt-2">This may take a moment for large documents.</p>
            </div>
        );
    }

    // ── error state ──
    if (!simplification && error) {
        return (
            <div className="text-center p-12 text-gray-500">
                <AlertTriangle size={48} className="mx-auto mb-4 text-amber-400" />
                <p className="text-xl">Could not simplify this document.</p>
                <p className="text-sm mt-2">{error}</p>
                <button onClick={fetchSimplification} className="btn-primary mt-4">Retry</button>
            </div>
        );
    }

    if (!simplification) return null;

    // ── parse response ──
    // Backend returns: { raw_text, structured: { document_type, simplified_explanation, ... }, chunk_count }
    const structured = simplification.structured || null;
    const rawText = simplification.raw_text || '';

    // If the LLM didn't return valid JSON inside structured, show raw_text
    if (!structured || !structured.simplified_explanation) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Plain Language View</h2>
                    <p className="text-gray-500">Simplified explanation of <span className="font-semibold">{currentDocument.filename}</span></p>
                </div>
                <div className="card-base p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Simplified Explanation</h3>
                    <div className="prose prose-sm max-w-none bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <pre className="whitespace-pre-wrap font-sans text-gray-700">{rawText}</pre>
                    </div>
                </div>
            </div>
        );
    }

    // ── structured view ──
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Plain Language View</h2>
                <p className="text-gray-500">
                    Simplified explanation of <span className="font-semibold">{currentDocument.filename}</span>
                    {structured.document_type && <span className="ml-2 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">{structured.document_type}</span>}
                </p>
            </div>

            {/* Overall Warnings */}
            {structured.overall_warnings && (
                <div className="p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-r-lg">
                    <h4 className="font-bold flex items-center gap-2">
                        <BookOpen size={18} /> Key Warnings
                    </h4>
                    <p className="mt-1">{structured.overall_warnings}</p>
                </div>
            )}

            {/* Simplified Clauses */}
            <div className="grid gap-6">
                {structured.simplified_explanation.map((item, idx) => (
                    <div key={idx} className="card-base p-6">
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Original Text</h4>
                        <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 font-mono mb-4 border border-gray-200">
                            "{item.original_clause}"
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-bold text-primary mb-1">Simple Meaning</h4>
                                <p className="text-gray-800">{item.simple_english}</p>
                            </div>
                            <div>
                                <h4 className="font-bold text-emerald-600 mb-1">What This Means For You</h4>
                                <p className="text-gray-700">{item.what_this_means_for_you || item.real_life_meaning}</p>
                            </div>
                        </div>

                        {item.be_careful_warning && (
                            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-100">
                                <strong>⚠ Be Careful:</strong> {item.be_careful_warning}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Key Legal Terms */}
            {structured.key_legal_terms && structured.key_legal_terms.length > 0 && (
                <div className="card-base p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Key Legal Terms Explained</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        {structured.key_legal_terms.map((term, idx) => (
                            <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <p className="font-bold text-gray-900">{term.term}</p>
                                <p className="text-sm text-gray-600 mt-1">{term.simple_meaning}</p>
                                <p className="text-xs text-gray-500 mt-1 italic">{term.real_life_meaning}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlainLanguage;
