import React from 'react';
import RiskGauge from '../components/RiskGauge';
import DataTable from '../components/DataTable';
import RiskBadge from '../components/RiskBadge';
import { AlertCircle, ChevronRight, FileText } from 'lucide-react';
import { useLegal } from '../context/LegalContext';

const RiskScanner = () => {
    const { analysisResults, currentDocument } = useLegal();

    // Parse RAG Type D response structure
    // Expecting format from system prompt in backend/config.py
    // Note: Backend returns text, we might need to parse sections if it's not JSON
    // For this integration, we'll assume the backend actually returns the JSON structure 
    // or we perform client-side regex parsing if it returns text.
    // Given the backend instructions were to "Perform FULL 6-STEP CONTRACT RISK ANALYSIS",
    // and the model returns text, we'll need to robustly display it or parse it.

    // NOTE: Ideally backend should output JSON. If it outputs text, we display it.
    // For this step, we will check if analysisResults.answer contains JSON or structured text.

    const renderContent = () => {
        if (!analysisResults) {
            return (
                <div className="text-center p-12 text-gray-500">
                    <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-xl">No analysis data found.</p>
                    <p className="text-sm">Please upload and analyze a document first.</p>
                </div>
            );
        }

        // Simple display for text-based RAG response if JSON parsing isn't strictly enforced on backend
        const rawText = analysisResults.answer || "";

        // Extract score if possible (e.g. "Overall Risk Score: 75/100")
        const scoreMatch = rawText.match(/Overall Risk Score:\s*(\d+)/i);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 50; // Default to medium if not found

        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Risk Analysis Report</h2>
                        <p className="text-gray-500">Analysis for <span className="font-semibold text-gray-700">{currentDocument?.filename || "Document"}</span></p>
                    </div>
                    <button className="btn-primary">Export Report</button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Score Card */}
                    <div className="card-base p-6 flex flex-col items-center justify-center text-center">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Overall Risk Score</h3>
                        <RiskGauge score={score} />
                        <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700 text-left w-full">
                            <div className="flex items-start gap-2">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                <p className="font-semibold">AI Assessment</p>
                            </div>
                            <p className="mt-1 text-xs">Based on contract structure and clause analysis.</p>
                        </div>
                    </div>

                    {/* Analysis Text Card */}
                    <div className="lg:col-span-2 card-base p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Detailed Analysis</h3>
                        <div className="prose prose-sm max-w-none prose-indigo h-96 overflow-y-auto bg-gray-50 p-4 rounded-lg border border-gray-100">
                            <pre className="whitespace-pre-wrap font-sans text-gray-700">{rawText}</pre>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return renderContent();
};

export default RiskScanner;
