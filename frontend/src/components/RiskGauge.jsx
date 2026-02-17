import React from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';

const RiskGauge = ({ score }) => {
    const data = [
        {
            name: 'Risk',
            value: score,
            fill: score > 75 ? '#DC2626' : score > 50 ? '#F59E0B' : '#10B981',
        },
    ];

    const getColor = (s) => {
        if (s > 75) return 'text-red-600';
        if (s > 50) return 'text-amber-500';
        return 'text-emerald-500';
    };

    return (
        <div className="relative h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="80%"
                    barSize={20}
                    data={data}
                    startAngle={180}
                    endAngle={0}
                >
                    <PolarAngleAxis
                        type="number"
                        domain={[0, 100]}
                        angleAxisId={0}
                        tick={false}
                    />
                    <RadialBar
                        background
                        clockWise
                        dataKey="value"
                        cornerRadius={10}
                    />
                </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center mt-4">
                <p className="text-gray-400 text-sm font-medium">Risk Score</p>
                <p className={`text-5xl font-bold ${getColor(score)}`}>{score}</p>
                <p className="text-sm font-medium text-gray-400 mt-1">/ 100</p>
            </div>
        </div>
    );
};

export default RiskGauge;
