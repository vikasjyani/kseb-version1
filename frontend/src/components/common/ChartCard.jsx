// File: frontend/src/components/common/ChartCard.jsx
import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ message = "Loading data..." }) => (
    <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
            <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                <div className="absolute inset-0 w-10 h-10 animate-ping text-blue-400 opacity-20">
                    <Loader2 className="w-full h-full" />
                </div>
            </div>
            <span className="text-sm font-medium text-slate-600">{message}</span>
        </div>
    </div>
);


const ChartCard = ({ title, description, icon: Icon, color, isLoading, children }) => {
    const colorClasses = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
        yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600' },
        green: { bg: 'bg-green-50', text: 'text-green-600' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
        rose: { bg: 'bg-rose-50', text: 'text-rose-600' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
    };

    const colors = colorClasses[color] || colorClasses.blue;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 ${colors.bg} rounded-xl`}>
                    <Icon className={`w-7 h-7 ${colors.text}`} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
                    <p className="text-sm text-slate-500 mt-1">{description}</p>
                </div>
            </div>
            {isLoading ? (
                <div className="p-12">
                    <LoadingSpinner message={`Loading ${title.toLowerCase()}...`} />
                </div>
            ) : (
                children
            )}
        </div>
    );
};

export default ChartCard;
