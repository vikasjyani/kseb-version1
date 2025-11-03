

import React, { createContext, useState, useContext, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';

// Create the context
const ProcessContext = createContext();

// Custom hook to use the context easily
export const useProcess = () => useContext(ProcessContext);

// The provider component that will wrap your app
export const ProcessProvider = ({ children, navigateTo }) => {
    const [status, setStatus] = useState('idle'); // idle, running, success, error
    const [title, setTitle] = useState('Process');
    const [progress, setProgress] = useState({ percentage: 0, message: 'Waiting...' });
    const [taskProgress, setTaskProgress] = useState({ current: 0, total: 0, unit: 'Steps' });
    const [logs, setLogs] = useState([]);
    const [result, setResult] = useState(null);

    // Store EventSource reference to enable cleanup
    const eventSourceRef = useRef(null);

    // Cleanup EventSource on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, []);

    const startProcess = useCallback(async (endpoint, payload, options = {}) => {
        // Close any existing EventSource before starting a new one
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        setStatus('running');
        setTitle(options.title || 'Processing...');
        setLogs([]);
        setResult(null);
        setProgress({ percentage: 0, message: 'Initiating process...' });
        setTaskProgress({ current: 0, total: 0, unit: options.unit || 'Steps' });

        try {
            await axios.post(endpoint, payload);
            const eventSource = new EventSource(options.sseEndpoint || '/project/generation-status');
            eventSourceRef.current = eventSource; // Store reference for cleanup

            eventSource.onopen = () => {
                setLogs(prev => [...prev, { type: 'info', text: 'Connection to server established. Waiting for process to start...', time: new Date().toLocaleTimeString() }]);

                setProgress(prev => ({ ...prev, percentage: 5, message: 'Connection established...' }));
            };

            eventSource.onmessage = (event) => {
                const eventData = JSON.parse(event.data);

                if (eventData.type === 'log') {
                    const logMessage = eventData.data.trim();
                    if (options.logParser) {
                        const parsed = options.logParser(logMessage);
                        if (parsed) {
                            if(parsed.progress) {
                                setProgress(prev => ({ ...prev, ...parsed.progress }));
                            }
                            if(parsed.taskProgress) {
                                setTaskProgress(prev => ({ ...prev, ...parsed.taskProgress }));
                            }
                            if(parsed.log) {
                                setLogs(prev => [...prev, { ...parsed.log, time: new Date().toLocaleTimeString() }]);
                            }
                        }
                    } else {
                        setLogs(prev => [...prev, { type: 'info', text: logMessage, time: new Date().toLocaleTimeString() }]);
                    }

                } else if (eventData.type === 'result') {
                    setResult(eventData.data);
                    setStatus('success');
                    setProgress({ percentage: 100, message: 'Process Completed Successfully!' });
                    setLogs(prev => [...prev, { type: 'success', text: '✅ Process completed successfully!', time: new Date().toLocaleTimeString() }]);
                    eventSource.close();
                    eventSourceRef.current = null;

                } else if (eventData.type === 'error') {
                    setStatus('error');
                    setProgress(prev => ({ ...prev, message: eventData.message || 'An unknown error occurred.' }));
                    setLogs(prev => [...prev, { type: 'error', text: `❌ Process failed: ${eventData.message}`, time: new Date().toLocaleTimeString() }]);
                    eventSource.close();
                    eventSourceRef.current = null;

                } else if (eventData.type === 'done') {
                    if (status !== 'error') {
                         setStatus('success');
                         setProgress({ percentage: 100, message: 'Process finished.' });
                    }
                    eventSource.close();
                    eventSourceRef.current = null;
                }
            };

            eventSource.onerror = () => {
                setStatus('error');
                setProgress(prev => ({ ...prev, message: 'Connection to server lost.' }));
                setLogs(prev => [...prev, { type: 'error', text: 'Connection to the server was lost.', time: new Date().toLocaleTimeString() }]);
                eventSource.close();
                eventSourceRef.current = null;
            };

        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Failed to start process.';
            setStatus('error');
            setProgress({ percentage: 0, message: errorMsg });
            setLogs(prev => [...prev, { type: 'error', text: errorMsg, time: new Date().toLocaleTimeString() }]);
        }
    }, []);

    const resetProcess = () => {
        setStatus('idle');
        setProgress({ percentage: 0, message: 'Waiting...' });
        setLogs([]);
        setResult(null);
    };

    const value = {
        status,
        title,
        progress,
        taskProgress,
        logs,
        result,
        startProcess,
        resetProcess,
        navigateTo,
    };

    return (
        <ProcessContext.Provider value={value}>
            {children}
        </ProcessContext.Provider>
    );
};