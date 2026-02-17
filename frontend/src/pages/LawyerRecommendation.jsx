import React, { useState } from 'react';
import LawyerCard from '../components/LawyerCard';
import { ToggleLeft, ToggleRight, Scale, CheckCircle, Search, Loader2 } from 'lucide-react';
import { useLegal } from '../context/LegalContext';

const LawyerRecommendation = () => {
    const { fetchLawyers, lawyers, loading } = useLegal();
    const [city, setCity] = useState('Mumbai');
    const [practiceArea, setPracticeArea] = useState('Corporate Law');

    const handleSearch = async () => {
        await fetchLawyers({
            practice_area: practiceArea,
            preferred_city: city,
            keywords: [],
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Lawyer Recommendations</h2>
                    <p className="text-gray-500">AI-matched legal experts based on analysis.</p>
                </div>
            </div>

            <div className="card-base p-6 bg-blue-50 border border-blue-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City (e.g. Delhi)"
                        className="p-2 rounded border border-gray-300"
                    />
                    <select
                        value={practiceArea}
                        onChange={(e) => setPracticeArea(e.target.value)}
                        className="p-2 rounded border border-gray-300"
                    >
                        <option>Corporate Law</option>
                        <option>Criminal Law</option>
                        <option>Property Law</option>
                        <option>Family Law</option>
                        <option>Intellectual Property</option>
                    </select>
                    <button
                        onClick={handleSearch}
                        disabled={loading.lawyers}
                        className="btn-primary flex items-center justify-center gap-2"
                    >
                        {loading.lawyers ? <Loader2 className="animate-spin" /> : <Search size={18} />}
                        Find Lawyers
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {loading.lawyers ? (
                    <div className="text-center py-12">
                        <Loader2 size={40} className="animate-spin mx-auto text-accent mb-4" />
                        <p className="text-gray-500">Searching for top legal experts...</p>
                    </div>
                ) : lawyers && lawyers.length > 0 ? (
                    lawyers.map((lawyer, idx) => (
                        // Adapter for backend response format to LawyerCard props
                        <LawyerCard key={idx} lawyer={{
                            name: lawyer.name || "Legal Expert",
                            image: lawyer.image,
                            location: lawyer.location || city,
                            rating: lawyer.rating || 4.5,
                            reviews: lawyer.reviews || 0,
                            specialty: lawyer.practice_area || practiceArea,
                            experience: lawyer.experience || "10+ Years",
                            tags: lawyer.tags || [],
                            matchScore: lawyer.match_score || 90
                        }} />
                    ))
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        <p>No lawyers found yet. Try adjusting your search.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LawyerRecommendation;
