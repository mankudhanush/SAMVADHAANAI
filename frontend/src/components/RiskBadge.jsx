import React from 'react';
import { clsx } from 'clsx';

const RiskBadge = ({ level }) => {
    const styles = {
        Low: "bg-emerald-100 text-emerald-800 border-emerald-200",
        Medium: "bg-amber-100 text-amber-800 border-amber-200",
        High: "bg-orange-100 text-orange-800 border-orange-200",
        Critical: "bg-red-100 text-red-800 border-red-200",
    };

    const defaultStyle = "bg-gray-100 text-gray-800 border-gray-200";

    return (
        <span className={clsx(
            "px-2.5 py-0.5 rounded-full text-xs font-medium border",
            styles[level] || defaultStyle
        )}>
            {level}
        </span>
    );
};

export default RiskBadge;
