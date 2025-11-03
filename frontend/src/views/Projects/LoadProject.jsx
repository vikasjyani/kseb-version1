

import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FolderSearch, AlertTriangle, Loader2, ClipboardCopy } from 'lucide-react';
import axios from 'axios';

const LoadProject = ({ setSelected, setActiveProject, activeProject }) => {
    const [projectPath, setProjectPath] = useState(() => {
        return sessionStorage.getItem('loadProject_projectPath') || '';
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const folderInputRef = useRef(null);

    useEffect(() => {
        sessionStorage.setItem('loadProject_projectPath', projectPath);
    }, [projectPath]);

    useEffect(() => {
        if (error) {
            setError('');
        }
    }, [projectPath]);

    const handleBrowseClick = () => {
        if (folderInputRef.current) {
            folderInputRef.current.setAttribute('webkitdirectory', 'true');
            folderInputRef.current.click();
        }
    };

    const handleFolderSelected = (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            const fullPath = files[0].path;
            const separator = fullPath.includes('\\') ? '\\' : '/';
            const directoryPath = fullPath.substring(0, fullPath.lastIndexOf(separator));
            setProjectPath(directoryPath);
        }
    };

    const handleLoad = async () => {
        const trimmedPath = projectPath.trim();

        if (!trimmedPath) {
            setError('Project path cannot be empty.');
            return;
        }

        
        if (activeProject && activeProject.path === trimmedPath) {
            setError('This project is already the active project.');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const response = await axios.post('/project/load', {
                project_path: trimmedPath
            });

            if (response.data.success) {
                const loadedProject = response.data.project;

                const existingRecentProjects = JSON.parse(localStorage.getItem('recentProjects')) || [];
                const existingProjectIndex = existingRecentProjects.findIndex(
                    p => p.path === loadedProject.path
                );

                let updatedRecentProjects;
                if (existingProjectIndex > -1) {
                    const projectToUpdate = { ...existingRecentProjects[existingProjectIndex], lastOpened: loadedProject.lastOpened };
                    const tempProjects = [...existingRecentProjects];
                    tempProjects.splice(existingProjectIndex, 1);
                    updatedRecentProjects = [projectToUpdate, ...tempProjects];
                } else {
                    updatedRecentProjects = [loadedProject, ...existingRecentProjects];
                }

                localStorage.setItem('recentProjects', JSON.stringify(updatedRecentProjects));
                sessionStorage.setItem('activeProject', JSON.stringify(loadedProject));
                setActiveProject(loadedProject);
                setSelected('Demand Projection');
                
                setProjectPath('');
                sessionStorage.removeItem('loadProject_projectPath');
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'A network error occurred or the backend is unavailable.');
        } finally {
            setIsLoading(false);
        }
    };

    const wizardSteps = [
        { id: 1, icon: <ClipboardCopy />, title: 'Provide Project Path', description: 'Paste or browse to your project folder.' },
    ];

    const isLoadButtonDisabled = isLoading || !projectPath.trim();

    return (
        <div className="w-full h-full bg-slate-50 text-slate-800 font-sans overflow-hidden">
            <div className="absolute inset-0 z-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]"></div>
            <div className="relative z-10 w-full h-full p-4 sm:p-6 max-w-screen-2xl mx-auto flex gap-6">

                <aside className="w-full max-w-sm flex-shrink-0 bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 flex flex-col rounded-2xl shadow-lg">
                    <div className="flex-grow">
                        <h2 className="text-2xl font-bold text-slate-100 mb-2">Project Loader</h2>
                        <p className="text-slate-400 text-base mb-10">Open an existing project from your machine.</p>
                        <ul className="space-y-6">
                            {wizardSteps.map(step => (
                                <li key={step.id} className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-indigo-600">
                                        {React.cloneElement(step.icon, { size: 20 })}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">{step.title}</h3>
                                        <p className="text-slate-400 text-sm">{step.description}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="flex-shrink-0 bg-black/20 backdrop-blur-sm p-4 rounded-lg border border-white/10">
                        <div className="flex items-start gap-3">
                            <FolderSearch size={24} className="text-slate-400 mt-1 flex-shrink-0" />
                            <div>
                                <h4 className="font-semibold text-slate-200">How to Find the Path</h4>
                                <ol className="list-decimal pl-5 mt-2 space-y-2 text-sm text-slate-400">
                                    <li>Click <strong>Browse</strong> and select your project folder.</li>
                                    <li>Alternatively, open your computer's <strong>File Explorer</strong>.</li>
                                    <li>Navigate to and open your specific project folder.</li>
                                    <li>Click the address bar at the top to highlight the full path.</li>
                                    <li>Copy (Ctrl+C) and paste (Ctrl+V) it here.</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </aside>

                <main className="flex-grow bg-white/70 backdrop-blur-xl p-6 sm:p-8 flex flex-col overflow-hidden rounded-2xl shadow-lg">
                    <header className="mb-6">
                        <h1 className="text-3xl font-bold text-slate-900">Load Your Workspace</h1>
                        <p className="text-slate-500 mt-2">Paste the full path to your project folder below or use the browse button.</p>
                    </header>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-start gap-4 text-sm mb-6">
                            <AlertTriangle className="w-5 h-5 mt-0.5 text-red-600 flex-shrink-0" />
                            <div>
                                <p className="font-bold">Could Not Load Project</p>
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label htmlFor="projectLocation" className="block text-sm font-semibold text-slate-600">
                            Full Project Folder Path <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                id="projectLocation"
                                type="text"
                                placeholder="e.g., C:\Users\YourName\Documents\Your_Project"
                                value={projectPath}
                                onChange={e => {
                                    setProjectPath(e.target.value);
                                }}
                                className={`flex-grow text-sm p-3 rounded-lg border-2 font-mono transition-all ${error ? 'border-red-500 bg-red-50/50' : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'}`}
                                disabled={isLoading}
                            />
                            <input type="file" ref={folderInputRef} onChange={handleFolderSelected} className="hidden" />
                            <button
                                onClick={handleBrowseClick}
                                className="flex-shrink-0 flex items-center gap-2 text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg px-4 py-3 transition-colors disabled:opacity-60"
                                disabled={isLoading}
                            >
                                <FolderSearch size={16} /> Browse
                            </button>
                        </div>
                    </div>
                    
                    <footer className="flex-shrink-0 flex justify-end items-center gap-4 pt-6 mt-6 border-t border-slate-200">
                        <button onClick={() => setSelected('Home')} className="font-semibold text-slate-600 px-6 py-2.5 rounded-lg hover:bg-slate-100 transition-colors" disabled={isLoading}>
                            Cancel
                        </button>
                        <button
                            onClick={handleLoad}
                            className="w-48 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-wait rounded-lg px-6 py-2.5 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 flex items-center justify-center gap-2"
                            disabled={isLoadButtonDisabled}
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <UploadCloud size={20} />}
                            {isLoading ? 'Loading...' : 'Load Project'}
                        </button>
                    </footer>
                </main>
            </div>
        </div>
    );
};

export default LoadProject;