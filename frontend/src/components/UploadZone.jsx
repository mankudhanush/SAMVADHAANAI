import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, X } from 'lucide-react';
import { clsx } from 'clsx';

const UploadZone = ({ onFileSelect }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    };

    const handleFile = (file) => {
        setSelectedFile(file);
        if (onFileSelect) onFileSelect(file);
    };

    const removeFile = (e) => {
        e.stopPropagation();
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (onFileSelect) onFileSelect(null); // Reset parent state
    };

    return (
        <div className="w-full">
            <div
                className={clsx(
                    "relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 flex flex-col items-center justify-center text-center group cursor-pointer",
                    isDragOver
                        ? "border-accent bg-accent/5 scale-[1.01]"
                        : "border-gray-300 hover:border-accent hover:bg-gray-50",
                    selectedFile ? "bg-emerald-50 border-emerald-200" : ""
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                    accept=".pdf,.docx,.txt,.jpg,.png"
                />

                {selectedFile ? (
                    <div className="flex flex-col items-center animate-fade-in">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                            <CheckCircle size={32} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">{selectedFile.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <button
                            onClick={removeFile}
                            className="mt-4 px-4 py-2 bg-white text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <X size={16} /> Remove File
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-accent mb-4 group-hover:scale-110 transition-transform duration-300">
                            <Upload size={32} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Drag & Drop your document here
                        </h3>
                        <p className="text-sm text-gray-500 max-w-xs mx-auto mb-6">
                            Supported formats: PDF, DOCX, Images (Max 25MB)
                        </p>
                        <button className="btn-primary">
                            Browse Files
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default UploadZone;
