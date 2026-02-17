import React, { useState, useCallback } from 'react';
import { Globe, Search, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import useStore from '../store/useStore';
import { webSearch } from '../services/api';

export default function WebSearchSection() {
    const { searchResults, searchLoading, searchError, setSearch, setSearchLoading, setSearchError } = useStore();
    const [query, setQuery] = useState('');

    const handleSearch = useCallback(async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setSearchLoading(true);
        setSearchError(null);
        try {
            const result = await webSearch(query.trim());
            setSearch(result);
        } catch (err) {
            setSearchError(err.message || 'Search failed');
        } finally {
            setSearchLoading(false);
        }
    }, [query, setSearch, setSearchLoading, setSearchError]);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-600" />
                Web Search
            </h2>

            <form onSubmit={handleSearch} className="flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search the web for legal information…"
                    disabled={searchLoading}
                    className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={searchLoading || !query.trim()}
                    className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Search
                </button>
            </form>

            {/* Error */}
            {searchError && (
                <div className="mt-4 flex items-start gap-2 text-red-600 bg-red-50 rounded-lg p-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm">{searchError}</p>
                </div>
            )}

            {/* Results */}
            {searchResults && !searchLoading && (
                <div className="mt-4 space-y-3">
                    {searchResults.results?.length > 0 ? (
                        searchResults.results.map((r, i) => (
                            <div key={i} className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors">
                                <a
                                    href={r.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                                >
                                    {r.title}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                                <p className="text-xs text-gray-500 mt-1 truncate">{r.url}</p>
                                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{r.snippet}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No results found.</p>
                    )}
                </div>
            )}
        </div>
    );
}
