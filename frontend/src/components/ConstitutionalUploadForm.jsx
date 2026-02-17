import React, { useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, Loader2 } from 'lucide-react';

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

function ConstitutionalUploadForm({ onSubmit, loading }) {
  const [text, setText] = useState('');

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (text.trim().length >= 20 && !loading) {
        onSubmit(text.trim());
      }
    },
    [text, loading, onSubmit]
  );

  const handlePaste = useCallback((e) => {
    // Allow default paste behavior
  }, []);

  return (
    <motion.form
      initial="hidden"
      animate="visible"
      variants={fadeIn}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Label */}
      <div className="flex items-center gap-3 mb-2">
        <FileText className="w-5 h-5 text-gold-600" />
        <label className="font-accent text-[0.9375rem] tracking-[0.15em] uppercase text-ink-400 font-medium">
          Legal Document Text
        </label>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          placeholder="Paste or type the legal document text here for constitutional analysis...&#10;&#10;The text should be at least 20 characters long."
          rows={10}
          disabled={loading}
          className="w-full px-5 py-4 rounded-sm border-2 border-gold-400/30 bg-parchment-100/60 text-ink-500 font-body text-[1rem] leading-relaxed resize-y
            placeholder:text-ink-200/60 placeholder:italic
            focus:outline-none focus:border-gold-500/60 focus:ring-1 focus:ring-gold-400/20
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200"
        />
        {text.length > 0 && (
          <span className={`absolute bottom-3 right-4 font-accent text-[0.75rem] tracking-wider ${text.trim().length >= 20 ? 'text-gold-600' : 'text-maroon-400'}`}>
            {text.trim().length} characters
          </span>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between">
        <p className="font-body text-[0.9rem] text-ink-300 italic">
          The engine will map your document to constitutional provisions
        </p>
        <button
          type="submit"
          disabled={loading || text.trim().length < 20}
          className="group relative inline-flex items-center gap-3 px-8 py-3.5 bg-gradient-to-b from-maroon-400 to-maroon-600 border-2 border-maroon-500 rounded-sm text-parchment-50 font-accent text-[0.9375rem] tracking-[0.15em] uppercase shadow-lg
            transition-all duration-300 hover:from-maroon-500 hover:to-maroon-700 hover:shadow-xl hover:scale-[1.02]
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analyzing Constitution…
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Invoke the Bench
            </>
          )}
        </button>
      </div>
    </motion.form>
  );
}

export default memo(ConstitutionalUploadForm);
