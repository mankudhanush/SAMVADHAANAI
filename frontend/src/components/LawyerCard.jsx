import React from 'react';
import { MapPin, Star, Briefcase, Phone, Mail } from 'lucide-react';

const LawyerCard = ({ lawyer }) => {
    return (
        <div className="card-base p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="relative">
                <img
                    src={lawyer.image || "https://ui-avatars.com/api/?name=Lawyer&background=random"}
                    alt={lawyer.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md bg-gray-100"
                />
                <div className="absolute -bottom-2 -right-2 bg-accent text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                    {lawyer.matchScore}% Match
                </div>
            </div>

            <div className="flex-1">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{lawyer.name}</h3>
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                            <MapPin size={14} />
                            <span>{lawyer.location}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg text-sm font-medium mt-2 md:mt-0">
                        <Star size={14} className="fill-yellow-500 text-yellow-500" />
                        <span>{lawyer.rating}</span>
                        <span className="text-gray-400 font-normal">({lawyer.reviews} reviews)</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <Briefcase size={16} className="text-primary" />
                    <span>{lawyer.specialty}</span>
                    <span className="text-gray-300">|</span>
                    <span>{lawyer.experience} Experience</span>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    {lawyer.tags.map((tag, idx) => (
                        <span key={idx} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-md">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-2 w-full md:w-auto">
                <button className="btn-primary flex items-center justify-center gap-2">
                    <Phone size={18} />
                    Contact Now
                </button>
                <button className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                    <Mail size={18} />
                    Send Message
                </button>
            </div>
        </div>
    );
};

export default LawyerCard;
