import React, { useState, useEffect, useMemo } from 'react';
import {
    FolderPlus,
    FolderClock,
    Trash2,
    Folder,
    Rocket,
    TrendingUp,
    BarChart3,
    BrainCircuit,
    ChevronRight,
    Search,
    ChevronDown,
    Sparkles,
    LineChart,
    Zap,
    Settings,
    Grid,
    CheckCircle2,
    Circle,
    Activity,
    Box,
} from 'lucide-react';

const Home = ({ setSelected, activeProject, setActiveProject }) => {
    const [recentProjects, setRecentProjects] = useState([]);
    const [showConfirm, setShowConfirm] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [sortBy, setSortBy] = useState('lastOpened');
    const [searchTerm, setSearchTerm] = useState('');


    useEffect(() => {
        try {
            const projects = JSON.parse(localStorage.getItem('recentProjects')) || [];
            setRecentProjects(projects);
        } catch (error) {
            console.error("Failed to parse projects from storage", error);
            setRecentProjects([]);
        }
    }, [activeProject]);

    const filteredAndSortedProjects = useMemo(() => {
        return recentProjects
            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.path.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                if (sortBy === 'name') {
                    return a.name.localeCompare(b.name);
                }

                return new Date(b.lastOpened) - new Date(a.lastOpened);
            });
    }, [recentProjects, sortBy, searchTerm]);

    const handleOpen = (project) => {
        const updatedProject = { ...project, lastOpened: new Date().toISOString() };


        const existingIndex = recentProjects.findIndex(p => p.path === updatedProject.path);

        let updatedList;
        if (existingIndex > -1) {

            const temp = [...recentProjects];
            temp.splice(existingIndex, 1);
            updatedList = [updatedProject, ...temp];
        } else {

            updatedList = [updatedProject, ...recentProjects];
        }

        localStorage.setItem('recentProjects', JSON.stringify(updatedList));
        sessionStorage.setItem('activeProject', JSON.stringify(updatedProject));
        setActiveProject(updatedProject);
        setRecentProjects(updatedList);
        setSelected('Demand Projection');
    };

    const handleDeleteClick = (project) => {
        setProjectToDelete(project);
        setShowConfirm(true);
    };

    const handleConfirmDelete = () => {
        if (!projectToDelete) return;
        const updated = recentProjects.filter((p) => p.id !== projectToDelete.id);
        localStorage.setItem('recentProjects', JSON.stringify(updated));
        setRecentProjects(updated);
        if (activeProject && activeProject.id === projectToDelete.id) {
            sessionStorage.removeItem('activeProject');
            setActiveProject(null);
        }
        setShowConfirm(false);
        setProjectToDelete(null);
    };

    const formatLastOpened = (isoString) => {
        if (!isoString) return 'Not available';
        const date = new Date(isoString);
        return date.toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: 'numeric', minute: '2-digit',
        });
    };

    const ActionCard = ({ icon, title, description, onClick }) => (
        <button
            onClick={onClick}
            className="group relative w-full text-left bg-gradient-to-br from-white to-slate-50 p-4 rounded-xl border border-slate-200/80 shadow-lg shadow-slate-200/60 hover:shadow-indigo-200/80 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 transform hover:-translate-y-1"
        >
            <div className="flex items-center">
                <div className="flex-shrink-0 bg-indigo-100 text-indigo-600 p-2.5 rounded-lg transition-all duration-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:scale-110 group-hover:rotate-[-6deg]">
                    {icon}
                </div>
                <div className="ml-3">
                    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                </div>
            </div>
        </button>
    );

    const WorkspaceCard = ({ icon, title, description, onClick, disabled }) => {
        const baseClasses = "group text-left p-3 rounded-lg transition-all duration-200 border w-full flex items-center justify-between";
        const enabledClasses = "bg-white hover:bg-slate-50/80 hover:border-slate-300 cursor-pointer shadow-sm hover:shadow-md";
        const disabledClasses = "bg-slate-100/80 opacity-70 cursor-not-allowed border-slate-200";

        return (
            <button onClick={onClick} disabled={disabled} className={`${baseClasses} ${disabled ? disabledClasses : enabledClasses}`}>
                <div className="flex items-center">
                    <div className={`flex-shrink-0 mr-3 p-2 rounded-lg transition-colors duration-200 ${disabled ? 'bg-slate-200 text-slate-500' : 'bg-indigo-100 text-indigo-600'}`}>
                        {icon}
                    </div>
                    <div>
                        <p className={`font-semibold text-sm ${disabled ? 'text-slate-500' : 'text-slate-900'}`}>{title}</p>
                        <p className="text-xs text-slate-500">{description}</p>
                    </div>
                </div>
                {!disabled && <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-1" />}
            </button>
        );
    };

    return (
        <div className="w-full min-h-screen bg-slate-50 text-slate-800 font-sans">
            <div className="absolute inset-0 z-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]"></div>
            <div className="relative z-10 w-full h-full p-4 sm:p-6 max-w-screen-2xl mx-auto">

                <header className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl border border-slate-200/80 p-5 rounded-2xl shadow-lg shadow-slate-200/60">
                        <div className="flex items-center gap-3">
                            <Sparkles className="w-8 h-8 text-indigo-500" />
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Energy Futures Platform</h1>
                                <p className="text-sm text-slate-600 mt-1">
                                    Start by creating a new project or opening a recent one.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className={`p-5 rounded-2xl flex flex-col justify-center transition-all duration-300 ${activeProject ? 'bg-gradient-to-br from-indigo-600 to-slate-800 shadow-lg shadow-indigo-300/50' : 'bg-gradient-to-br from-slate-700 to-slate-800 shadow-md shadow-slate-300/50'}`}>
                        {activeProject ? (
                            <div>
                                <p className='text-xs text-indigo-200 font-semibold uppercase tracking-wider'>Active Project</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></span>
                                    <p className='font-semibold text-lg text-white truncate' title={activeProject.name}>{activeProject.name}</p>
                                </div>
                            </div>
                        ) : (
                            <div className='text-center'>
                                <p className='text-sm font-medium text-slate-200'>No Active Project</p>
                                <p className='text-xs text-slate-400 mt-1'>Load or create one to begin.</p>
                            </div>
                        )}
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <main className="lg:col-span-2 flex flex-col gap-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <ActionCard icon={<FolderPlus size={20} />} title="Create New Project" description="Start a fresh workspace." onClick={() => setSelected('Create Project')} />
                            <ActionCard icon={<Folder size={20} />} title="Load Existing Project" description="Open a project from disk." onClick={() => setSelected('Load Project')} />
                        </div>
                        <div className="bg-white/70 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-lg shadow-slate-200/60">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                                    <FolderClock size={20} className="text-indigo-600" />
                                    Recent Projects
                                </h2>
                                <div className='flex items-center gap-2'>
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="Search projects..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-slate-100 border border-slate-300/70 text-slate-700 text-xs font-medium rounded-lg pl-8 pr-2 py-2.5 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div className="relative">
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value)}
                                            className="appearance-none bg-slate-100 border border-slate-300/70 text-slate-700 text-xs font-medium rounded-lg pl-3 pr-7 py-2.5 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-indigo-500"
                                        >
                                            <option value="lastOpened">Last Opened</option>
                                            <option value="name">Name (A-Z)</option>
                                        </select>
                                        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-auto max-h-72">
                                <table className="w-full text-left">
                                    <thead className="border-b-2 border-slate-200 bg-slate-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Project Name</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Last Opened</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/80">
                                        {filteredAndSortedProjects.length > 0 ? (
                                            filteredAndSortedProjects.map((project) => (
                                                <tr key={project.id} className={`transition-colors duration-150 ${activeProject?.id === project.id ? 'bg-indigo-50/80' : 'hover:bg-slate-50/70'}`}>
                                                    <td className="px-3 py-3 align-top">
                                                        <div className="flex items-center gap-2">

                                                            {activeProject?.path === project.path && (
                                                                <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0 animate-pulse"></span>
                                                            )}
                                                            <p className="font-semibold text-sm text-slate-900 truncate">{project.name}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate mt-1">
                                                            <Folder size={12} className="flex-shrink-0" />
                                                            <span className="truncate">{project.path}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap align-top">{formatLastOpened(project.lastOpened)}</td>
                                                    <td className="px-3 py-3 align-top">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button onClick={() => handleDeleteClick(project)} title="Remove from list" className="p-1.5 rounded-md text-slate-500 hover:bg-red-100 hover:text-red-600 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors duration-150">
                                                                <Trash2 size={14} />
                                                            </button>
                                                            <button onClick={() => handleOpen(project)} className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ring-offset-2 transition-all duration-150 transform hover:scale-105">
                                                                Open
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="3" className="p-4">
                                                    <div className="text-center text-slate-500 py-10 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                                                        <Search size={32} className="mx-auto text-slate-400 mb-2" />
                                                        <h3 className="text-sm font-semibold text-slate-600">No Projects Found</h3>
                                                        <p className="text-xs mt-1">Adjust your search or create a new project.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </main>
                    <aside className="lg:col-span-1 flex flex-col gap-6">
                        {/* Workflow Guide */}
                        <div className="bg-white/70 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-lg shadow-slate-200/60">
                            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-200">
                                <Rocket size={20} className="text-indigo-600" />
                                <h3 className="text-lg font-bold text-slate-800">Complete Workflow</h3>
                            </div>
                            <div className="flex flex-col gap-4">
                                {/* Demand Forecasting Section */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp size={14} className="text-indigo-600" />
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Demand Forecasting</h4>
                                    </div>
                                    <div className="flex flex-col gap-1.5 ml-5 border-l-2 border-slate-200 pl-3">
                                        <WorkspaceCard
                                            icon={<Activity size={14} />}
                                            title="Demand Projection"
                                            description="Configure & run forecast"
                                            onClick={() => setSelected('Demand Projection')}
                                            disabled={!activeProject}
                                        />
                                        <WorkspaceCard
                                            icon={<LineChart size={14} />}
                                            title="Demand Visualization"
                                            description="View forecast results"
                                            onClick={() => setSelected('Demand Visualization')}
                                            disabled={!activeProject}
                                        />
                                    </div>
                                </div>

                                {/* Load Profiles Section */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <BarChart3 size={14} className="text-indigo-600" />
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Load Profiles</h4>
                                    </div>
                                    <div className="flex flex-col gap-1.5 ml-5 border-l-2 border-slate-200 pl-3">
                                        <WorkspaceCard
                                            icon={<Zap size={14} />}
                                            title="Generate Profiles"
                                            description="Create hourly profiles"
                                            onClick={() => setSelected('Generate Profiles')}
                                            disabled={!activeProject}
                                        />
                                        <WorkspaceCard
                                            icon={<Activity size={14} />}
                                            title="Analyze Profiles"
                                            description="View profile analytics"
                                            onClick={() => setSelected('Analyze Profiles')}
                                            disabled={!activeProject}
                                        />
                                    </div>
                                </div>

                                {/* PyPSA Suite Section */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <BrainCircuit size={14} className="text-indigo-600" />
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">PyPSA Suite</h4>
                                    </div>
                                    <div className="flex flex-col gap-1.5 ml-5 border-l-2 border-slate-200 pl-3">
                                        <WorkspaceCard
                                            icon={<Settings size={14} />}
                                            title="Model Config"
                                            description="Configure PyPSA model"
                                            onClick={() => setSelected('Model Config')}
                                            disabled={!activeProject}
                                        />
                                        <WorkspaceCard
                                            icon={<Box size={14} />}
                                            title="View Results"
                                            description="PyPSA optimization results"
                                            onClick={() => setSelected('View Results')}
                                            disabled={!activeProject}
                                        />
                                    </div>
                                </div>

                                {/* System Section */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Grid size={14} className="text-indigo-600" />
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">System</h4>
                                    </div>
                                    <div className="flex flex-col gap-1.5 ml-5 border-l-2 border-slate-200 pl-3">
                                        <WorkspaceCard
                                            icon={<Settings size={14} />}
                                            title="Settings"
                                            description="App preferences"
                                            onClick={() => setSelected('Settings')}
                                            disabled={false}
                                        />
                                        <WorkspaceCard
                                            icon={<Grid size={14} />}
                                            title="Other Tools"
                                            description="Additional utilities"
                                            onClick={() => setSelected('Other Tools')}
                                            disabled={false}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Tip Card */}
                        {!activeProject && (
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-200/80 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 bg-amber-100 p-2 rounded-lg">
                                        <Sparkles size={16} className="text-amber-600" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-900 mb-1">Getting Started</h4>
                                        <p className="text-xs text-amber-700 leading-relaxed">
                                            Create or load a project to unlock all features. Most tools require an active project to function.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
            {showConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300 animate-fadeIn">
                    <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md text-center transform transition-all duration-300 animate-scaleIn">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                            <Trash2 className="h-6 w-6 text-red-600" />
                        </div>
                        <h2 className="mt-4 text-lg font-bold text-slate-900">Remove Project</h2>
                        <p className="text-sm text-slate-600 my-2">
                            Are you sure you want to remove "<strong>{projectToDelete?.name}</strong>"?
                        </p>
                        <div className="bg-slate-100 p-3 rounded-lg text-xs text-slate-700 mt-4 text-left">
                            <strong>Note:</strong> This action only removes the project from this list. It will not delete any files from your computer.
                        </div>
                        <div className="flex justify-center gap-4 mt-6">
                            <button onClick={() => setShowConfirm(false)} className="font-semibold px-6 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleConfirmDelete} className="font-semibold px-6 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm transition-colors">
                                Yes, Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;