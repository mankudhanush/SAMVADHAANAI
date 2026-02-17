import React, { useCallback, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import useStore from '../store/useStore';
import { uploadDocument } from '../services/api';

export default function UploadSection() {
    const { currentDocument, uploadLoading, uploadError, setDocument, setUploadLoading, setUploadError } = useStore();
    const [dragActive, setDragActive] = useState(false);

    const handleFile = useCallback(async (file) => {
        if (!file) return;
        setUploadLoading(true);
        setUploadError(null);
        try {
            const result = await uploadDocument(file);
            setDocument(result);
        } catch (err) {
            setUploadError(err.message || 'Upload failed');
        } finally {
            setUploadLoading(false);
        }
    }, [setDocument, setUploadLoading, setUploadError]);

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const onDragOver = useCallback((e) => {
        e.preventDefault();
        setDragActive(true);
    }, []);

    const onDragLeave = useCallback(() => setDragActive(false), []);

    const onFileSelect = useCallback((e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Document Upload
            </h2>

            {/* Drop zone */}
            <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`
                    relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                    ${dragActive
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}
                `}
                onClick={() => document.getElementById('file-input')?.click()}
            >
                <input
                    id="file-input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp"
                    onChange={onFileSelect}
                    className="hidden"
                />

                {uploadLoading ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                        <p className="text-sm text-gray-500">Processing document…</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <FileText className="w-10 h-10 text-gray-400" />
                        <p className="text-sm text-gray-600">
                            Drag & drop a document here, or <span className="text-indigo-600 font-medium">click to browse</span>
                        </p>
                        <p className="text-xs text-gray-400">PDF, PNG, JPG, TIFF, BMP, WebP</p>
                    </div>
                )}
            </div>

            {/* Error */}
            {uploadError && (
                <div className="mt-4 flex items-start gap-2 text-red-600 bg-red-50 rounded-lg p-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm">{uploadError}</p>
                </div>
            )}

            {/* Success */}
            {currentDocument && !uploadLoading && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-700 mb-2">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium text-sm">Document processed successfully</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <span>File: <strong>{currentDocument.filename}</strong></span>
                        <span>Pages: <strong>{currentDocument.pages}</strong></span>
                        <span>Chunks: <strong>{currentDocument.num_chunks}</strong></span>
                        <span>Vectors: <strong>{currentDocument.total_vectors}</strong></span>
                    </div>
                </div>
            )}
        </div>
    );
}
