

import React, { useState, useEffect, useRef } from 'react';
import { GoProject } from "react-icons/go";
import { FiBell, FiSettings } from 'react-icons/fi';
import { useProcess } from './ProcessContext'; 

const TopBar = ({ activeProject }) => {
    const { status, title, progress, taskProgress } = useProcess();
    const [isProgressPanelOpen, setIsProgressPanelOpen] = useState(false);
    const panelRef = useRef(null);
    const prevStatusRef = useRef(status);
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (panelRef.current && !panelRef.current.contains(event.target)) {
                setIsProgressPanelOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [panelRef]);

    // Effect to auto-open the panel ONCE when the process starts
    useEffect(() => {
        if (status === 'running' && prevStatusRef.current !== 'running') {
            setIsProgressPanelOpen(true);
        }
        prevStatusRef.current = status;
    }, [status]);
    
   
    const clampedPercentage = Math.min(100, Math.max(0, Math.round(progress.percentage)));

    const ProgressPanel = () => {
        if (!isProgressPanelOpen) return null;

        if (status === 'idle') {
             return (
                <div ref={panelRef} className="absolute top-12 right-0 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 p-4 text-center text-slate-400">
                    No active processes.
                </div>
            );
        }

        const getShortMessage = () => {
            if (status === 'running') {
                const match = progress.message.match(/Processing FY\d+/);
                return match ? match[0] : 'Processing...';
            }
            return progress.message;
        };

        return (
            <div
                ref={panelRef}
                className="absolute top-12 right-0 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden text-slate-300 animate-fade-in-down"
            >
                <div className="p-4 border-b border-slate-700">
                    <h3 className="font-bold text-white">{title}</h3>
                    <p className="text-sm text-slate-400 mt-1 capitalize">{status}</p>
                </div>
                
                <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-400">Current Task:</span>
                        <span className="font-bold text-white truncate max-w-[150px]">{getShortMessage()}</span>
                    </div>
                     <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-400">{taskProgress.unit} Processed:</span>
                        <span className="font-bold text-white">{taskProgress.current || 0} / {taskProgress.total || 0}</span>
                    </div>
                    <div>
                        <div className="w-full bg-slate-700 rounded-full h-2 mb-1">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${clampedPercentage}%` }}
                            ></div>
                        </div>
                        <div className="text-right text-xs font-semibold text-blue-400">
                            {clampedPercentage}%
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <header className="fixed top-0 left-0 right-0 bg-slate-800 border-b border-slate-700 h-16 flex items-center justify-between px-6 z-40">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-slate-700 rounded-lg">
                    <GoProject size={20} className="text-blue-300" />
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-sm font-bold text-indigo-400">Active Project:</p>
                    <h1 
                        className="text-base font-bold text-white tracking-tight truncate max-w-sm"
                        title={activeProject ? activeProject.name : 'No Project Loaded'}
                    >
                        {activeProject ? activeProject.name : 'No Project Loaded'}
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-5">
                <div className="relative">
                    <button 
                        onClick={() => setIsProgressPanelOpen(prev => !prev)}
                        className="relative p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
                    >
                        {status === 'running' ? (
                            <div className="relative w-5 h-5 flex items-center justify-center">
                                <svg className="absolute w-full h-full" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.9155" className="stroke-current text-slate-600" strokeWidth="4" fill="transparent" />
                                    <circle cx="18" cy="18" r="15.9155" className="stroke-current text-blue-500 transition-all duration-300" strokeWidth="4" fill="transparent"
                                        strokeDasharray={`${clampedPercentage}, 100`}
                                        transform="rotate(-90 18 18)"
                                    />
                                </svg>
                                <FiBell size={12} className="text-slate-400" />
                            </div>
                        ) : (
                             <FiBell size={20} />
                        )}
                    </button>
                    <ProgressPanel />
                </div>
                
                <button className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200">
                    <FiSettings size={20} />
                </button>
            </div>
        </header>
    );
};

export default TopBar;