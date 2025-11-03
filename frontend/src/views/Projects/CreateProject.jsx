


import React, { useState, useRef, useMemo, useEffect } from 'react';
import { FolderPlus, FolderSearch, AlertTriangle, Info, Loader2, FileText, CheckCircle, Edit2, XCircle, ArrowRight, Folder, Home } from 'lucide-react';
import axios from 'axios';

const CreateProject = ({ setSelected, setActiveProject }) => {

    const [projectName, setProjectName] = useState(() => sessionStorage.getItem('createProject_projectName') || '');
    const [projectLocation, setProjectLocation] = useState(() => sessionStorage.getItem('createProject_projectLocation') || '');
    const [description, setDescription] = useState(() => sessionStorage.getItem('createProject_description') || '');


    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [touched, setTouched] = useState({ name: false, location: false });


    const [showSuccess, setShowSuccess] = useState(() => {
        return sessionStorage.getItem('createProject_showSuccess') === 'true';
    });

    const [newProjectData, setNewProjectData] = useState(() => {
        const savedData = sessionStorage.getItem('createProject_newProjectData');
        return savedData ? JSON.parse(savedData) : null;
    });

    const [activeStep, setActiveStep] = useState(1);

    const [locationStatus, setLocationStatus] = useState({
        isChecking: false,
        isValid: null,
        message: '',
    });

    const folderInputRef = useRef(null);

    const isNameInvalid = touched.name && projectName.trim() === '';
    const isLocationInvalid = touched.location && (projectLocation.trim() === '' || locationStatus.isValid === false);


    useEffect(() => {
        sessionStorage.setItem('createProject_projectName', projectName);
        sessionStorage.setItem('createProject_projectLocation', projectLocation);
        sessionStorage.setItem('createProject_description', description);
    }, [projectName, projectLocation, description]);


    useEffect(() => {
        sessionStorage.setItem('createProject_showSuccess', showSuccess);
        if (showSuccess && newProjectData) {
            sessionStorage.setItem('createProject_newProjectData', JSON.stringify(newProjectData));
        } else if (!showSuccess) {
            sessionStorage.removeItem('createProject_newProjectData');
        }
    }, [showSuccess, newProjectData]);


    useEffect(() => {
        if (!touched.location || !projectLocation.trim()) {
            setLocationStatus({ isChecking: false, isValid: null, message: '' });
            return;
        }
        setLocationStatus({ isChecking: true, isValid: null, message: '' });
        const handler = setTimeout(async () => {
            try {
                const encodedPath = encodeURIComponent(projectLocation.trim());
                await axios.get(`/project/check-directory?path=${encodedPath}`);
                setLocationStatus({ isChecking: false, isValid: true, message: 'Valid directory.' });
            } catch (err) {
                const errorMessage = err.response?.data?.message || 'Invalid or non-existent path.';
                setLocationStatus({ isChecking: false, isValid: false, message: errorMessage });
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [projectLocation, touched.location]);


    const resetFormAndStorage = () => {
        setProjectName('');
        setProjectLocation('');
        setDescription('');
        setTouched({ name: false, location: false });
        setLocationStatus({ isChecking: false, isValid: null, message: '' });
        sessionStorage.removeItem('createProject_projectName');
        sessionStorage.removeItem('createProject_projectLocation');
        sessionStorage.removeItem('createProject_description');
    };


    const clearAllStateAndStorage = () => {
        resetFormAndStorage();
        setShowSuccess(false);
        setNewProjectData(null);
        sessionStorage.removeItem('createProject_showSuccess');
        sessionStorage.removeItem('createProject_newProjectData');
    };

    const handleCreate = async () => {
        setError('');
        setTouched({ name: true, location: true });

        if (!projectName.trim() || !projectLocation.trim() || locationStatus.isValid === false) {
            setError(locationStatus.message || 'Project Name and a valid Parent Folder Path are required.');
            return;
        }
        setIsLoading(true);

        try {
            const response = await axios.post('/project/create', {
                name: projectName.trim(),
                location: projectLocation.trim(),
                description: description.trim()
            });

            if (response.data.success) {
                const newProject = {
                    id: `proj_${Date.now()}`,
                    name: projectName.trim(),
                    path: response.data.path,
                    lastOpened: new Date().toISOString()
                };
                const existing = JSON.parse(localStorage.getItem('recentProjects')) || [];
                const updated = [newProject, ...existing.filter(p => p.path !== newProject.path)];
                localStorage.setItem('recentProjects', JSON.stringify(updated));

                setActiveProject(newProject);
                sessionStorage.setItem('activeProject', JSON.stringify(newProject));


                setNewProjectData(newProject);
                setShowSuccess(true);
            }
        } catch (err) {
            const defaultError = 'An unexpected error occurred. Please check the server connection and try again.';
            const message = err.response?.data?.message || defaultError;
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToHome = () => {
        clearAllStateAndStorage();
        setSelected('Home');
    };

    const handleGoToProject = () => {
        clearAllStateAndStorage();
        setSelected('Demand Projection');
    };

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
            setProjectLocation(directoryPath);
            setTouched(prev => ({ ...prev, location: true }));
        }
    };

    const finalPath = useMemo(() => {
        if (!projectLocation.trim() || !projectName.trim()) return '';
        const cleanLocation = projectLocation.trim().replace(/[\\/]$/, '');
        const separator = cleanLocation.includes('\\') ? '\\' : '/';
        return `${cleanLocation}${separator}${projectName.trim()}`;
    }, [projectName, projectLocation]);

    const wizardSteps = [
        { id: 1, icon: <FileText />, title: 'Core Setup', description: 'Set project name and location.' },
        { id: 2, icon: <Edit2 />, title: 'Optional Details', description: 'Add a brief summary.' }
    ];

    const TreeItem = ({ icon, label, isLastInLevel = false, indentLevel = 0 }) => {
        const indentStyle = { paddingLeft: `${indentLevel * 20}px` };
        return (
            <div className="relative flex items-start gap-2 text-sm leading-tight" style={indentStyle}>
                {indentLevel > 0 && (
                    <span className="absolute top-0 left-0 h-full w-px bg-slate-300" style={{ left: `${(indentLevel - 1) * 20 + 8}px` }} />
                )}
                <span className="relative z-10 text-slate-400 font-mono">{isLastInLevel ? '└─' : '├─'}</span>
                <div className="relative z-10 flex items-center gap-1.5 truncate">
                    {icon}
                    <span className="text-slate-800 font-semibold truncate" title={label}>{label}</span>
                </div>
            </div>
        );
    };

    if (showSuccess && newProjectData) {
        return (
            <div className="bg-slate-100 w-full h-full p-4 flex flex-col justify-center items-center font-sans">
                <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
                    <header className="p-4 text-center border-b border-slate-200">
                        <div className="inline-block bg-green-100 p-2 rounded-full">
                            <CheckCircle size={28} className="text-green-600" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mt-2">Project Initialized Successfully</h1>
                        <p className="text-sm text-gray-500">Your workspace is ready on your local machine.</p>
                    </header>
                    <main className="flex-grow p-4 bg-white space-y-3 overflow-y-auto">
                        <section className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Project Workspace</h2>
                            <p className="text-lg font-bold text-blue-700 truncate" title={newProjectData?.name}>{newProjectData?.name}</p>
                            <p className="text-sm text-gray-600 font-mono font-normal bg-slate-200 p-2 rounded mt-2 break-words">{newProjectData?.path}</p>
                        </section>
                        <section className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Directory Structure</h3>
                            <div className="font-mono space-y-1.5 text-sm text-gray-800">
                                <div className="flex items-center gap-2.5 font-bold text-base">
                                    <Folder size={18} className="text-yellow-500" />
                                    <span>{newProjectData?.name}/</span>
                                </div>
                                <TreeItem icon={<Folder size={16} className="text-yellow-500" />} label="inputs/" indentLevel={1} />
                                <TreeItem icon={<FileText size={15} className="text-green-700" />} label="input_demand_file.xlsx" indentLevel={2} />
                                <TreeItem icon={<FileText size={15} className="text-green-700" />} label="load_curve_template.xlsx" indentLevel={2} />
                                <TreeItem icon={<FileText size={15} className="text-green-700" />} label="pypsa_input_template.xlsx" indentLevel={2} isLastInLevel />
                                <TreeItem icon={<Folder size={16} className="text-yellow-500" />} label="results/" indentLevel={1} />
                                <TreeItem icon={<Folder size={16} className="text-slate-500" />} label="demand_forecasts/" indentLevel={2} />
                                <TreeItem icon={<Folder size={16} className="text-slate-500" />} label="load_profiles/" indentLevel={2} />
                                <TreeItem icon={<Folder size={16} className="text-slate-500" />} label="pypsa_optimization/" indentLevel={2} isLastInLevel />
                            </div>
                        </section>
                    </main>
                    <footer className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-2">
                        <button onClick={handleBackToHome} className="flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition">
                            <Home size={16} /> Back to Home
                        </button>
                        <button onClick={handleGoToProject} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow">
                            Proceed to Demand Projection <ArrowRight size={18} />
                        </button>
                    </footer>
                </div>
            </div>
        );
    }


    return (
        <div className="w-full h-full bg-slate-50 text-slate-800 font-sans overflow-hidden">
            <div className="absolute inset-0 z-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]"></div>
            <div className="relative z-10 w-full h-full p-4 sm:p-6 max-w-screen-2xl mx-auto flex gap-6">
                <aside className="w-full max-w-sm flex-shrink-0 bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 flex flex-col rounded-2xl shadow-lg">
                    <div className="flex-grow">
                        <h2 className="text-2xl font-bold text-slate-100 mb-2">Project Setup Wizard</h2>
                        <p className="text-slate-400 text-base mb-8">Follow the steps to get started.</p>
                        <ul className="space-y-5">
                            {wizardSteps.map(step => (
                                <li key={step.id} className="flex items-start gap-4">
                                    <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center transition-colors duration-300 ${activeStep === step.id ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                                        {React.cloneElement(step.icon, { size: 18 })}
                                    </div>
                                    <div>
                                        <h3 className={`font-bold transition-colors duration-300 ${activeStep === step.id ? 'text-white' : 'text-slate-300'}`}>{step.title}</h3>
                                        <p className="text-slate-400 text-sm">{step.description}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="flex-shrink-0 bg-black/20 backdrop-blur-sm p-4 rounded-lg border border-white/10">
                        <div className="flex items-start gap-3">
                            <Info size={24} className="text-slate-400 mt-1 flex-shrink-0" />
                            <div>
                                <h4 className="font-semibold text-slate-200">How to Set the Path</h4>
                                <ol className="list-decimal pl-5 mt-2 space-y-2 text-sm text-slate-400">
                                    <li>Open your <strong>File Explorer</strong>.</li>
                                    <li>Navigate to where you want to <strong>create</strong> the project (e.g., `D:\My Work`).</li>
                                    <li>Click the address bar at the top to highlight the path.</li>
                                    <li>Copy (Ctrl+C) and paste (Ctrl+V) it into the "Parent Folder Path" field.</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </aside>
                <main className="flex-grow bg-white/70 backdrop-blur-xl p-6 sm:p-8 flex flex-col overflow-hidden rounded-2xl shadow-lg">
                    <div className="flex-grow overflow-y-auto pr-4 -mr-4 space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-start gap-4 text-sm mr-4">
                                <AlertTriangle className="w-5 h-5 mt-0.5 text-red-600 flex-shrink-0" />
                                <div>
                                    <p className="font-bold">Error</p>
                                    <p>{error}</p>
                                </div>
                            </div>
                        )}
                        <section onFocus={() => setActiveStep(1)} className="mr-4">
                            <h3 className="text-xl font-bold text-slate-800 mb-4 border-b pb-3 flex items-center gap-3">
                                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">1</span>
                                Core Setup
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="projectName" className="block text-sm font-semibold text-slate-600 mb-2">Project Name <span className="text-red-500">*</span></label>
                                    <input id="projectName" type="text" placeholder="e.g., Statewide Solar Grid Expansion 2025" value={projectName} onChange={e => setProjectName(e.target.value)} onBlur={() => setTouched(prev => ({ ...prev, name: true }))} className={`w-full text-base p-3 rounded-md border-2 transition-all ${isNameInvalid ? 'border-red-500 bg-red-50/50' : 'border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} />
                                </div>
                                <div>
                                    <label htmlFor="projectLocation" className="block text-sm font-semibold text-slate-600 mb-2">Parent Folder Path <span className="text-red-500">*</span></label>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-grow">
                                            <input
                                                id="projectLocation"
                                                type="text"
                                                placeholder="e.g., C:\Users\YourName\Documents"
                                                value={projectLocation}
                                                onChange={e => setProjectLocation(e.target.value)}
                                                onBlur={() => setTouched(prev => ({ ...prev, location: true }))}
                                                className={`w-full text-sm p-3 rounded-md border-2 font-mono transition-all pr-10 ${isLocationInvalid ? 'border-red-500 bg-red-50/50'
                                                        : locationStatus.isValid === true ? 'border-green-500 bg-green-50/50'
                                                            : 'border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                                                    }`}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-5">
                                                {locationStatus.isChecking && <Loader2 size={16} className="animate-spin text-slate-400" />}
                                                {locationStatus.isValid === false && <XCircle size={16} className="text-red-500" />}
                                                {locationStatus.isValid === true && <CheckCircle size={16} className="text-green-600" />}
                                            </div>
                                        </div>
                                        <input type="file" ref={folderInputRef} onChange={handleFolderSelected} className="hidden" />
                                        <button onClick={handleBrowseClick} className="flex-shrink-0 flex items-center gap-2 text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-md px-4 py-3 transition-colors">
                                            <FolderSearch size={16} /> Browse
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>
                        <section onFocus={() => setActiveStep(2)} className="mr-4">
                            <h3 className="text-xl font-bold text-slate-800 mb-4 border-b pb-3 flex items-center gap-3">
                                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">2</span>
                                Optional Details
                            </h3>
                            <div>
                                <label htmlFor="description" className="block text-sm font-semibold text-slate-600 mb-2">Project Description</label>
                                <textarea id="description" placeholder="A brief summary of the project's goals and scope." value={description} onChange={e => setDescription(e.target.value)} className="w-full text-base p-3 rounded-md border-2 border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" rows="4" />
                            </div>
                        </section>
                    </div>
                    <footer className="flex-shrink-0 flex justify-end items-center gap-4 pt-4 mt-6 border-t border-slate-200">
                        <button onClick={() => setSelected('Home')} className="font-semibold text-slate-600 px-6 py-2.5 rounded-md hover:bg-slate-100 transition-colors" disabled={isLoading}>
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            className="w-48 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-wait rounded-md px-6 py-2.5 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 flex items-center justify-center gap-2"
                            disabled={isLoading || !projectName.trim() || !projectLocation.trim()}
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <FolderPlus size={20} />}
                            {isLoading ? 'Creating...' : 'Create Project'}
                        </button>
                    </footer>
                </main>
            </div>
        </div>
    );
};

export default CreateProject;