import React, { useCallback, useRef } from 'react';
import { Mic, Upload, Loader2, AlertCircle, FileAudio } from 'lucide-react';
import useStore from '../store/useStore';
import { transcribeVoice } from '../services/api';

export default function VoiceSection() {
    const { voiceTranscript, voiceLoading, voiceError, setVoice, setVoiceLoading, setVoiceError } = useStore();
    const fileRef = useRef(null);

    const handleFile = useCallback(async (file) => {
        if (!file) return;
        setVoiceLoading(true);
        setVoiceError(null);
        try {
            const result = await transcribeVoice(file);
            setVoice(result);
        } catch (err) {
            setVoiceError(err.message || 'Transcription failed');
        } finally {
            setVoiceLoading(false);
        }
    }, [setVoice, setVoiceLoading, setVoiceError]);

    const onFileSelect = useCallback((e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Mic className="w-5 h-5 text-indigo-600" />
                Voice Transcription
            </h2>

            <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 hover:bg-gray-50 transition-all"
            >
                <input
                    ref={fileRef}
                    type="file"
                    accept=".mp3,.wav,.m4a,.ogg,.flac,.webm"
                    onChange={onFileSelect}
                    className="hidden"
                />

                {voiceLoading ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                        <p className="text-sm text-gray-500">Transcribing audio…</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <FileAudio className="w-10 h-10 text-gray-400" />
                        <p className="text-sm text-gray-600">
                            <span className="text-indigo-600 font-medium">Click to upload</span> an audio file
                        </p>
                        <p className="text-xs text-gray-400">MP3, WAV, M4A, OGG, FLAC, WebM</p>
                    </div>
                )}
            </div>

            {/* Error */}
            {voiceError && (
                <div className="mt-4 flex items-start gap-2 text-red-600 bg-red-50 rounded-lg p-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm">{voiceError}</p>
                </div>
            )}

            {/* Result */}
            {voiceTranscript && !voiceLoading && (
                <div className="mt-4 space-y-3">
                    <div className="bg-gray-50 rounded-xl p-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-1">Transcript</h3>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {voiceTranscript.transcript}
                        </p>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                        <span>Language: <strong>{voiceTranscript.detected_language}</strong></span>
                        <span>Duration: <strong>{voiceTranscript.duration_sec}s</strong></span>
                    </div>
                    {voiceTranscript.summary && (
                        <div className="bg-indigo-50 rounded-xl p-4">
                            <h3 className="text-sm font-medium text-indigo-700 mb-1">Summary</h3>
                            <p className="text-sm text-gray-700">{voiceTranscript.summary}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
