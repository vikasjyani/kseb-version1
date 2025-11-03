
import React, { useEffect, useState, useRef } from 'react';
import { Loader, CheckCircle, XCircle, FileText, Server, Zap, Check, Terminal } from 'lucide-react';

const ForecastProgress = ({ scenarioName, onComplete, onClose }) => {
    const [overallProgress, setOverallProgress] = useState(0);
    const [message, setMessage] = useState('Waiting for the process to start...');
    const [status, setStatus] = useState('running');
    const [sectorStatuses, setSectorStatuses] = useState([]);
    const [totalSectors, setTotalSectors] = useState(0);
    const [logs, setLogs] = useState([]);
    const [finalResult, setFinalResult] = useState(null);
    const logContainerRef = useRef(null);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    useEffect(() => {
        const eventSource = new EventSource('/project/forecast-progress');
        const addLog = (type, text) => {
            setLogs(prev => [...prev, { type, text, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }]);
        };

        eventSource.onopen = () => addLog('info', 'Connection to server established. Waiting for process to start...');

        eventSource.addEventListener('progress', (event) => {
            const data = JSON.parse(event.data);
            setOverallProgress(data.progress || 0);
            setMessage(data.message || 'Processing...');
            if (data.total_sectors) {
                setTotalSectors(prev => {
                    // Only log when we first receive the total sectors count
                    if (prev === 0 && data.total_sectors > 0) {
                        addLog('info', `Forecast initialized for ${data.total_sectors} sectors.`);
                    }
                    return data.total_sectors;
                });
            }
            if(data.step && data.message && data.sector) {
                 addLog('progress', `(${data.sector}) - ${data.message}`);
            }
        });

        eventSource.addEventListener('sector_completed', (event) => {
            const data = JSON.parse(event.data);
            setSectorStatuses(prev => [...prev, { name: data.sector, status: 'completed' }]);
            addLog('success', `Sector '${data.sector}' processed successfully.`);
        });

        eventSource.addEventListener('sector_failed', (event) => {
            const data = JSON.parse(event.data);
            setSectorStatuses(prev => [...prev, { name: data.sector, status: 'failed', error: data.error }]);
            addLog('error', `Sector '${data.sector}' failed: ${data.error}`);
        });

        eventSource.addEventListener('end', (event) => {
            const data = JSON.parse(event.data);
            if (data.status === 'completed') {
                setStatus('completed');
                setMessage('Forecast process finished!');
                setOverallProgress(100);
                setFinalResult(data.result);

                // Log detailed results if available
                if (data.result) {
                    const result = data.result;
                    const successfulSectors = result.successful_sectors || 0;
                    const failedSectors = result.failed_sectors || 0;
                    addLog('success', `✅ Forecast completed: ${successfulSectors} sectors successful, ${failedSectors} failed.`);

                    // Log any failed sectors
                    if (result.results) {
                        const failedResults = result.results.filter(r => r.status === 'failed');
                        failedResults.forEach(failed => {
                            addLog('error', `❌ Sector '${failed.sector}' failed: ${failed.error}`);
                        });
                    }
                } else {
                    addLog('success', '✅ Forecast process completed successfully.');
                }
            } else {
                setStatus('failed');
                setMessage(data.error || 'Forecast failed');
                addLog('error', `❌ Forecast failed: ${data.error || 'An unknown error occurred.'}`);
            }
            eventSource.close();
        });

        eventSource.onerror = () => {
            setStatus('failed');
            setMessage('A connection error occurred.');
            addLog('error', 'Connection to the server was lost.');
            eventSource.close();
        };

        // Cleanup function to close EventSource when component unmounts
        return () => {
            eventSource.close();
        };
    }, []); // Empty dependency array - only create EventSource once on mount

    const getStatusIcon = (size = 'w-8 h-8') => {
        if (status === 'running') return <Loader className={`${size} text-blue-500 animate-spin`} />;
        if (status === 'completed') return <CheckCircle className={`${size} text-green-500`} />;
        if (status === 'failed') return <XCircle className={`${size} text-red-500`} />;
    };
    
    const getLogIcon = (logType) => {
        if (logType === 'success') return <Check size={14} className="text-green-400 flex-shrink-0" />;
        if (logType === 'error') return <XCircle size={14} className="text-red-400 flex-shrink-0" />;
        if (logType === 'progress') return <Zap size={14} className="text-blue-400 flex-shrink-0" />;
        return <Server size={14} className="text-slate-500 flex-shrink-0" />;
    };
    
    // Use final results if available, otherwise fall back to sector statuses
    const getSuccessCount = () => {
        if (finalResult && finalResult.results) {
            return finalResult.results.filter(r => r.status === 'completed').length;
        }
        return sectorStatuses.filter(s => s.status === 'completed').length;
    };

    const getFailedCount = () => {
        if (finalResult && finalResult.results) {
            return finalResult.results.filter(r => r.status === 'failed').length;
        }
        return sectorStatuses.filter(s => s.status === 'failed').length;
    };

    const getTotalCount = () => {
        if (finalResult && finalResult.total_sectors !== undefined) {
            return finalResult.total_sectors;
        }
        return totalSectors;
    };

    const successCount = getSuccessCount();
    const failedCount = getFailedCount();
    const totalCount = getTotalCount();

    return (
        <div className="fixed inset-0 z-50 bg-slate-100 p-4 font-sans flex items-center justify-center">
            <div className="w-full max-w-7xl h-full bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
                
                <header className="flex-shrink-0 text-center p-4 border-b border-slate-200">
                    <div className="flex justify-center items-center gap-3">
                        {getStatusIcon()}
                        <h1 className="text-2xl font-bold text-slate-800">
                            {status === 'completed' ? 'Forecast Completed' : status === 'failed' ? 'Forecast Failed' : 'Forecasting in Progress'}
                        </h1>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                        Scenario: <span className="font-semibold text-slate-700">{scenarioName}</span>
                    </p>
                </header>

                
                <main className="flex-grow p-4 flex flex-col gap-4 overflow-hidden">
                    <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <h2 className="font-semibold text-sm text-slate-700">Overall Progress</h2>
                                    <span className="text-lg font-bold text-blue-600">{Math.round(overallProgress)}%</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2.5 mt-1 overflow-hidden">
                                    <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${overallProgress}%` }}></div>
                                </div>
                            </div>
                             <div className="bg-slate-100 p-3 rounded-lg text-center">
                                 <p className="text-sm text-slate-600 font-medium">{message}</p>
                             </div>
                        </div>
                         <div className="border border-slate-200 rounded-lg p-3">
                             <h3 className="text-base font-bold text-slate-800 mb-2">Processing Summary</h3>
                             <div className="flex justify-around bg-slate-100 p-2 rounded-md">
                                 <div className="text-center"><p className="font-bold text-xl text-slate-700">{totalCount}</p><p className="text-xs text-slate-500">Total Sectors</p></div>
                                 <div className="text-center"><p className="font-bold text-xl text-green-600">{successCount}</p><p className="text-xs text-green-500">Succeeded</p></div>
                                 <div className="text-center"><p className="font-bold text-2xl text-red-600">{failedCount}</p><p className="text-sm text-red-500">Failed</p></div>
                             </div>
                         </div>
                    </div>
                    
                    <div className="flex-grow flex flex-col bg-slate-900 text-white rounded-lg overflow-hidden">
                        <h3 className="text-base font-semibold p-3 border-b border-slate-700 flex-shrink-0 flex items-center gap-2">
                            <Terminal size={16} />
                            Live Event Log
                        </h3>
                        <div ref={logContainerRef} className="flex-grow p-3 space-y-2 overflow-y-auto text-xs font-mono">
                            {logs.map((log, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <span className="text-slate-500">{log.time}</span>
                                    <div className="mt-0.5">{getLogIcon(log.type)}</div>
                                    <p className={`flex-1 break-words ${log.type === 'error' ? 'text-red-400' : 'text-slate-300'}`}>{log.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>

                <footer className="pt-3 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0 p-3">
                    {status !== 'running' && (
                        <button onClick={onClose} className="text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg px-6 py-2 transition-all">
                            Close
                        </button>
                    )}
                    <button
                        onClick={() => onComplete(scenarioName)}
                        disabled={status !== 'completed'}
                        className="flex items-center gap-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-6 py-2 transition-all disabled:bg-blue-300 disabled:cursor-not-allowed">
                        <FileText size={16} />
                        Proceed to Demand Visualization
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ForecastProgress;
