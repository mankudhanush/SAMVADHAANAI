import React from 'react';
import RiskGauge from '../components/RiskGauge';
import { Gavel, DollarSign, AlertOctagon, TrendingUp, Scale, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { useLegal } from '../context/LegalContext';

const RiskScore = () => {
    const { analysisResults, currentDocument } = useLegal();

    if (!analysisResults) {
        return (
            <div className="text-center p-12 text-gray-500">
                <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-xl">No Risk Score Available</p>
                <p className="text-sm mt-2">Upload and analyze a document first.</p>
            </div>
        );
    }

    const rawText = analysisResults.answer || '';

    // Parse risk score from RAG response text
    const scoreMatch = rawText.match(/(?:Overall\s+)?Risk\s+Score[:\s]*(\d+)/i);
    const compositeScore = scoreMatch ? parseInt(scoreMatch[1]) : 50;

    // Parse fairness from RAG response text
    const fairnessMatch = rawText.match(/Fairness\s+Assessment[:\s]*(.*?)(?:\n|$)/i);
    const fairness = fairnessMatch ? fairnessMatch[1].trim() : 'Could not determine';

    const getColor = (val) => {
        if (val < 30) return 'bg-emerald-500';
        if (val < 70) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const getRiskLabel = (val) => {
        if (val < 20) return { text: 'Low Risk', color: 'text-emerald-600' };
        if (val < 50) return { text: 'Moderate Risk', color: 'text-amber-600' };
        if (val < 75) return { text: 'Considerable Risk', color: 'text-orange-600' };
        return { text: 'Critical Risk', color: 'text-red-600' };
    };

    const label = getRiskLabel(compositeScore);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Legal Risk Score Analysis</h2>
                <p className="text-gray-500">
                    Risk breakdown for <span className="font-semibold text-gray-700">{currentDocument?.filename || 'Document'}</span>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Score */}
                <div className="lg:col-span-1 card-base p-8 flex flex-col items-center justify-center text-center bg-gradient-to-b from-white to-gray-50">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Composite Risk Score</h3>
                    <RiskGauge score={compositeScore} />
                    <p className="mt-4 text-sm text-gray-600 px-4">
                        This document carries a <span className={clsx('font-bold', label.color)}>{label.text}</span>.
                    </p>
                    {fairness && (
                        <p className="mt-2 text-xs text-gray-500">Fairness: {fairness}</p>
                    )}
                </div>

                {/* Detailed Analysis */}
                <div className="lg:col-span-2 card-base p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">AI Risk Assessment</h3>
                    <div className="prose prose-sm max-w-none h-80 overflow-y-auto bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <pre className="whitespace-pre-wrap font-sans text-gray-700">{rawText}</pre>
                    </div>
                </div>
            </div>

            {/* Urgency Section */}
            {compositeScore >= 50 && (
                <div className="card-base p-6 bg-red-50 border border-red-100">
                    <div className="flex items-start gap-4">
                        <div className="bg-red-100 p-3 rounded-full text-red-600">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">
                                Urgency Assessment: {compositeScore >= 75 ? 'Critical' : 'High'}
                            </h3>
                            <p className="text-gray-700 mt-1">
                                Based on the risk analysis, legal counsel is recommended before proceeding.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RiskScore;
