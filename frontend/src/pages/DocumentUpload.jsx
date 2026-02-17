import React, { useState } from 'react';
import UploadZone from '../components/UploadZone';
import { FileText, Loader2, CheckCircle, AlertTriangle, XCircle, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { useLegal } from '../context/LegalContext';

const ALLOWED_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/tiff',
    'image/bmp',
    'image/webp',
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const DocumentUpload = ({ onAnalyzeConfig }) => {
    const { processDocument, runRiskAnalysis, loading, error, setError, currentDocument } = useLegal();
    const [file, setFile] = useState(null);
    const [step, setStep] = useState('idle'); // idle | uploading | analyzing | done | error

    const validate = (f) => {
        if (!ALLOWED_TYPES.includes(f.type)) {
            setError(`Unsupported file type "${f.type}". Use PDF or image files.`);
            return false;
        }
        if (f.size > MAX_FILE_SIZE) {
            setError(`File too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max 20 MB.`);
            return false;
        }
        return true;
    };

    const handleFileSelect = (f) => {
        setFile(f);
        setError(null);
        setStep('idle');
    };

    const handleAnalysis = async () => {
        if (!file) return;
        if (!validate(file)) return;

        try {
            setStep('uploading');
            await processDocument(file);

            setStep('analyzing');
            await runRiskAnalysis();

            setStep('done');
            setTimeout(() => {
                onAnalyzeConfig && onAnalyzeConfig('risk-scanner');
            }, 800);
        } catch (err) {
            setStep('error');
        }
    };

    const progressPercent =
        step === 'idle' ? 0 :
            step === 'uploading' ? 35 :
                step === 'analyzing' ? 70 :
                    step === 'done' ? 100 : 0;

    const stepLabel =
        step === 'uploading' ? 'Uploading & Extracting Text via OCR...' :
            step === 'analyzing' ? 'Running AI Risk Analysis (this may take a minute)...' :
                step === 'done' ? 'Analysis Complete!' : '';

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Upload Document</h2>
                <p className="text-gray-500">Upload your contract or legal document for AI-powered risk analysis.</p>
            </div>

            <div className="card-base p-8">
                {/* Error banner */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-2">
                            <XCircle size={20} />
                            <span className="text-sm">{error}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleAnalysis} className="text-sm font-medium flex items-center gap-1 hover:underline">
                                <RotateCcw size={14} /> Retry
                            </button>
                            <button onClick={() => { setError(null); setStep('idle'); }} className="text-sm font-medium hover:underline ml-2">
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                {/* Upload Zone */}
                <UploadZone onFileSelect={handleFileSelect} />

                {/* Analyze Button */}
                {file && step === 'idle' && !error && (
                    <div className="mt-6 flex justify-end animate-fade-in">
                        <button
                            onClick={handleAnalysis}
                            disabled={loading.upload || loading.risk}
                            className="btn-primary flex items-center gap-2 px-8 py-3 text-lg disabled:opacity-50"
                        >
                            Analyze Document
                        </button>
                    </div>
                )}

                {/* Progress */}
                {(step === 'uploading' || step === 'analyzing' || step === 'done') && (
                    <div className="mt-8 animate-fade-in">
                        <div className="flex justify-between text-sm font-medium text-gray-900 mb-2">
                            <span className="flex items-center gap-2">
                                {step === 'done'
                                    ? <CheckCircle className="text-emerald-500" size={16} />
                                    : <Loader2 className="animate-spin text-accent" size={16} />}
                                {stepLabel}
                            </span>
                            <span>{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                                className={clsx(
                                    "h-2.5 rounded-full transition-all duration-500 ease-out",
                                    step === 'done' ? "bg-emerald-500" : "bg-accent"
                                )}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-4 text-sm text-gray-500">
                            <div className={clsx("flex items-center gap-2", progressPercent >= 35 ? "text-emerald-600" : "text-gray-400")}>
                                <CheckCircle size={14} /> OCR Extraction
                            </div>
                            <div className={clsx("flex items-center gap-2", progressPercent >= 70 ? "text-emerald-600" : "text-gray-400")}>
                                <CheckCircle size={14} /> Risk Analysis
                            </div>
                            <div className={clsx("flex items-center gap-2", progressPercent >= 100 ? "text-emerald-600" : "text-gray-400")}>
                                <CheckCircle size={14} /> Report Ready
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Feature cards */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                        <FileText size={20} />
                    </div>
                    <h3 className="font-semibold text-gray-900">Smart Extraction</h3>
                    <p className="text-sm text-gray-600 mt-2">OCR + text extraction from PDFs and images.</p>
                </div>
                <div className="bg-amber-50 p-6 rounded-xl border border-amber-100">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 mb-4">
                        <AlertTriangle size={20} />
                    </div>
                    <h3 className="font-semibold text-gray-900">Risk Detection</h3>
                    <p className="text-sm text-gray-600 mt-2">Flags high-risk clauses and missing protections.</p>
                </div>
                <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 mb-4">
                        <FileText size={20} />
                    </div>
                    <h3 className="font-semibold text-gray-900">Compliance Check</h3>
                    <p className="text-sm text-gray-600 mt-2">Alignment with local and international laws.</p>
                </div>
            </div>
        </div>
    );
};

export default DocumentUpload;
