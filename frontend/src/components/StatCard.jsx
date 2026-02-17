import React from 'react';
import { clsx } from 'clsx';

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color = "blue" }) => {
    const colorMap = {
        blue: "bg-blue-50 text-blue-600",
        green: "bg-green-50 text-green-600",
        red: "bg-red-50 text-red-600",
        amber: "bg-amber-50 text-amber-600",
        purple: "bg-purple-50 text-purple-600",
    };

    return (
        <div className="card-base p-6 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
                </div>
                <div className={clsx("p-3 rounded-lg", colorMap[color])}>
                    <Icon size={24} />
                </div>
            </div>

            {trend && (
                <div className="flex items-center gap-2 text-sm">
                    <span className={clsx(
                        "font-medium",
                        trend === 'up' ? "text-green-600" : "text-red-600"
                    )}>
                        {trend === 'up' ? '↑' : '↓'} {trendValue}
                    </span>
                    <span className="text-gray-400">vs last month</span>
                </div>
            )}
        </div>
    );
};

export default StatCard;
