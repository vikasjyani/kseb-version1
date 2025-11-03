
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Palette, Loader2, CheckCircle } from 'lucide-react'; 
import { useSettingsStore } from '../store/settingsStore';

const Settings = ({ activeProject }) => {
    const { colorConfig, fetchColorConfig, updateColor, saveColorConfig } = useSettingsStore();
    const [sectors, setSectors] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        if (activeProject?.path) {
            const projectPath = activeProject.path;
            axios.get(`/project/sectors?projectPath=${encodeURIComponent(projectPath)}`)
                .then((res) => {
                    const fetchedSectors = res.data.sectors || [];
                    setSectors(fetchedSectors);
                    fetchColorConfig(projectPath, fetchedSectors);
                })
                .catch((err) => {
                    console.error('Error fetching sectors:', err);
                    
                });
        } else {
            setSectors([]);
        }
    }, [activeProject, fetchColorConfig]);

    const handleSave = async () => {
        if (!activeProject?.path) return;
        setIsSaving(true);
        setIsSaved(false);
        try {
            await saveColorConfig(activeProject.path);
            setIsSaved(true); 
            setTimeout(() => {
                setIsSaved(false);
            }, 2000);
        } catch (err) {
            console.error("Save failed:", err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex h-screen w-full flex-col bg-gray-50">
            
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-indigo-100 p-2">
                        <Palette className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h1 className="text-xl font-semibold text-gray-800">Color Configuration</h1>
                </div>
                
                <button
                    onClick={handleSave}
                    disabled={isSaving || isSaved || !activeProject?.path}
                    className={`flex items-center justify-center w-32 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 ${
                        isSaved ? 'bg-green-500' :
                        isSaving ? 'cursor-not-allowed bg-gray-400' :
                        !activeProject?.path ? 'cursor-not-allowed bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                >
                    {isSaved ? (
                        <CheckCircle size={16} />
                    ) : isSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Save size={16} />
                    )}
                    <span className="ml-2 whitespace-nowrap">
                        {isSaved ? 'Saved!' : isSaving ? 'Saving...' : 'Save Settings'}
                    </span>
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-6">
                <div className="mx-auto max-w-7xl space-y-8">
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                        {/* Sector Colors Section */}
                        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg">
                            <h2 className="mb-6 text-xl font-bold text-gray-800">Sector Colors</h2>
                            {sectors.length === 0 ? (
                                <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4">
                                    <p className="text-center text-gray-500">
                                        {activeProject ? "Loading sectors..." : "Load a project to configure colors."}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {sectors.map((sector) => (
                                        <div key={sector} className="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-100">
                                            <input
                                                type="color"
                                                value={colorConfig.sectors[sector] || '#000000'}
                                                onChange={(e) => updateColor('sectors', sector, e.target.value)}
                                                className="h-10 w-10 cursor-pointer rounded-full border-2 border-white shadow-sm transition-transform duration-200 hover:scale-110"
                                            />
                                            <span className="truncate text-sm font-medium text-gray-700 group-hover:text-indigo-600">
                                                {sector}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Model Colors Section */}
                        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg">
                            <h2 className="mb-6 text-xl font-bold text-gray-800">Model Colors</h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {Object.entries(colorConfig.models).map(([model, color]) => (
                                    <div key={model} className="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-100">
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => updateColor('models', model, e.target.value)}
                                            className="h-10 w-10 cursor-pointer rounded-full border-2 border-white shadow-sm transition-transform duration-200 hover:scale-110"
                                        />
                                        <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600">
                                            {model}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Settings;