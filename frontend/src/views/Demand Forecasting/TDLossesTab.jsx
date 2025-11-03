
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Chart from 'react-apexcharts';
import { FiSettings, FiBarChart2, FiTrash2, FiPlusCircle, FiSave, FiLoader } from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';

const generateId = () => `id_${Math.random().toString(36).substr(2, 9)}`;

const TDLossesTab = ({ projectPath, scenario }) => {
    const [lossPoints, setLossPoints] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isInitialSave, setIsInitialSave] = useState(true);

    useEffect(() => {
        if (!projectPath || !scenario) {
            setLossPoints([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        axios.get(`/project/scenarios/${scenario}/td-losses`, { params: { projectPath } })
            .then(res => {
                if (res.data.success && res.data.data && res.data.data.length > 0) {
                    setLossPoints(res.data.data.map(p => ({ ...p, id: generateId() })));
                    setIsInitialSave(false);
                } else {
                    setLossPoints([
                        { id: generateId(), year: new Date().getFullYear(), loss: 15 },
                    ]);
                    setIsInitialSave(true);
                }
            })
            .catch(err => {
                console.error("Error loading T&D losses:", err);
                toast.error('Could not load existing data. Starting fresh.');
                setLossPoints([
                    { id: generateId(), year: new Date().getFullYear(), loss: 15 },
                ]);
                setIsInitialSave(true);
            })
            .finally(() => setIsLoading(false));
    }, [projectPath, scenario]);

    const handlePointChange = (id, field, value) => {
        setLossPoints(points =>
            points.map(p => (p.id === id ? { ...p, [field]: value === '' ? '' : Number(value) } : p))
        );
    };

    const handleAddPoint = () => {
        const lastYear = lossPoints.length > 0 ? Math.max(...lossPoints.map(p => p.year || 0)) : new Date().getFullYear();
        setLossPoints(points => [...points, { id: generateId(), year: lastYear + 1, loss: '' }]);
    };

    const handleDeletePoint = (id) => {
        setLossPoints(points => points.filter(p => p.id !== id));
    };

    const handleSaveChanges = () => {
        setIsSaving(true);
        const pointsToSave = lossPoints.map(({ id, ...rest }) => rest);
        
        const toastPromise = axios.post(`/project/scenarios/${scenario}/td-losses`, { projectPath, lossPoints: pointsToSave });

        toast.promise(toastPromise, {
            loading: 'Saving...',
            success: (res) => {
                if (res.data.success) {
                    const message = isInitialSave ? 'Saved successfully!' : 'Changes saved successfully!';
                    setIsInitialSave(false);
                    return message;
                }
                throw new Error(res.data.message || 'Could not save changes.'); 
            },
            error: (err) => {
                console.error("Error saving T&D losses:", err);
                return err.response?.data?.message || 'Error: Could not save changes.';
            }
        }).finally(() => {
            setIsSaving(false);
        });
    };

    const chartData = useMemo(() => {
        const sortedPoints = [...lossPoints]
            .filter(p => p.year && (p.loss || p.loss === 0))
            .sort((a, b) => a.year - b.year);
        
        const series = [{
            name: 'Loss Percentage',
            data: sortedPoints.map(p => p.loss),
        }];

        const options = {
            chart: { type: 'area', height: 350, toolbar: { show: false }, background: 'transparent' },
            dataLabels: { enabled: false },
            stroke: { curve: 'straight', width: 3, colors: ['#EF4444'] }, 
            fill: {
                type: 'gradient',
                gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.1, stops: [0, 90, 100], colorStops: [{ offset: 0, color: "#F87171", opacity: 0.6 }, { offset: 100, color: "#FEF2F2", opacity: 0.1 }] }
            },
            markers: {
                size: 6,
                colors: ["#FFF"],
                strokeColors: '#EF4444',
                strokeWidth: 3,
                hover: { size: 8 }
            },
            xaxis: {
                categories: sortedPoints.map(p => p.year),
                labels: { style: { colors: '#6B7280' } },
                axisBorder: { show: false },
                axisTicks: { show: false },
            },
            yaxis: {
                title: { text: 'Loss Percentage (%)', style: { color: '#6B7280', fontSize: '12px' } },
                labels: { style: { colors: '#6B7280' } }
            },
            grid: {
                borderColor: '#e5e7eb',
                strokeDashArray: 4,
            },
            tooltip: { theme: 'light' },
            title: {
                text: 'T&D Losses Preview',
                align: 'left',
                style: { fontSize: '16px', fontWeight: 'bold', color: '#374151' }
            },
        };
        return { series, options };
    }, [lossPoints]);

    if (isLoading) {
        return (
            <div className="w-full flex justify-center items-center p-10 bg-white rounded-xl border">
                <FiLoader className="animate-spin text-blue-500" size={40} />
                <span className="ml-4 text-slate-600">Loading T&D Configuration...</span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm p-3">
           
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <FiSettings className="text-blue-600" />
                            T&D Losses Configuration
                        </h3>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSaveChanges}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:bg-slate-400 text-sm"
                            >
                                {isSaving ? <FiLoader className="animate-spin" /> : <FiSave />}
                                {isSaving ? 'Saving...' : (isInitialSave ? 'Save' : 'Save Changes')}
                            </button>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg">
                        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-2">
                            {lossPoints.map((point) => (
                                <div key={point.id} className="bg-white p-2 rounded-lg border border-slate-300 flex items-center gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs text-slate-500 font-semibold">Year</label>
                                        <input type="number" value={point.year} onChange={(e) => handlePointChange(point.id, 'year', e.target.value)} className="w-full bg-white border border-slate-300 rounded-md p-1.5 mt-1 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 text-sm" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs text-slate-500 font-semibold">Loss %</label>
                                        <input type="number" value={point.loss} onChange={(e) => handlePointChange(point.id, 'loss', e.target.value)} className="w-full bg-white border border-slate-300 rounded-md p-1.5 mt-1 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 text-sm" />
                                    </div>
                                    <button onClick={() => handleDeletePoint(point.id)} className="bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 rounded-md p-2.5 self-end transition-colors" title="Delete Point">
                                        <FiTrash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleAddPoint} className="w-full flex items-center justify-center gap-2 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors mt-2 text-sm">
                            <FiPlusCircle size={16} />
                            Add Data Point
                        </button>
                    </div>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <FiBarChart2 className="text-blue-600" />
                        Preview
                    </h3>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <Chart options={chartData.options} series={chartData.series} type="area" height={350} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TDLossesTab;