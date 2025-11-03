


import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Save, Loader2, Settings, Database, Zap, TrendingUp, Archive, Sliders, CheckCircle, AlertCircle, RotateCcw, Info } from 'lucide-react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';



const Tooltip = ({ text, children }) => (
  <div className="relative flex items-center group">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs text-white bg-gray-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
      {text}
    </div>
  </div>
);

const SectionCard = ({ title, subtitle, icon: Icon, children }) => (
  <section className="bg-white rounded-xl shadow-md border border-slate-200">
    <div className="p-5 border-b border-slate-200">
      <div className="flex items-center">
        <div className="bg-blue-100 p-2.5 rounded-lg mr-4">
          <Icon className="w-6 h-6 text-blue-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
    </div>
    <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
      {children}
    </div>
  </section>
);

const FormField = ({ label, tooltip, children, className = '', error }) => (
  <div className={className}>
    <label className="flex items-center text-sm font-medium text-slate-700 mb-1.5">
      <span className="mr-1.5">{label}</span>
      {tooltip && (
        <Tooltip text={tooltip}>
          <Info className="w-4 h-4 text-slate-400 cursor-help" />
        </Tooltip>
      )}
    </label>
    {children}
    {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
  </div>
);

const ToggleSwitch = ({ name, value, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={value}
    onClick={() => onChange({ target: { name, value: !value, type: 'checkbox' } })}
    className={`${value ? 'bg-blue-600' : 'bg-slate-200'
      } relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
  >
    <span className={`${value ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out`} />
  </button>
);



const ModelConfig = () => {
  const initialFormData = useRef({
    committable: true,
    monthlyConstraints: false,
    monthlyConstraintType: 'Daily',
    monthlyConstraintCycles: 24,
    co2Constraints: false,
    batteryCycle: true,
    storageDischarging: 'Least cost',
    runPypsaModelOn: 'All Snapshots',
    solver: 'Highs',
    multiYearInvestment: 'No',
    generatorRetirements: false,
    storageRetirements: false,
    batteryCycleCost: false,
    generatorCluster: true,
    weightings: '1',
    rollingHorizon: false,
  }).current;

  const [scenarioName, setScenarioName] = useState('National_Grid_Projection_2026');
  const [baseYear, setBaseYear] = useState('2026');
  const [projectPath, setProjectPath] = useState('');
  const [formData, setFormData] = useState(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errors, setErrors] = useState({});
  const [logs, setLogs] = useState("");
  const [isRunning, setIsRunning] = useState(false);


  useEffect(() => {
    try {
      const currentProject = JSON.parse(localStorage.getItem('currentProject') || '{}');
      if (currentProject && currentProject.path) {
        setProjectPath(currentProject.path);
      } else {
        setErrors((prev) => ({ ...prev, projectPath: 'No active project found in localStorage.' }));
      }
    } catch (e) {
      setErrors((prev) => ({ ...prev, projectPath: 'Invalid project data in localStorage.' }));
    }
  }, []);

  const lastSavedState = useRef({ ...initialFormData, scenarioName, baseYear, projectPath });


  const hasChanges = useMemo(() => {
    const currentState = { ...formData, scenarioName, baseYear, projectPath };
    return JSON.stringify(currentState) !== JSON.stringify(lastSavedState.current);
  }, [formData, scenarioName, baseYear, projectPath]);

  useEffect(() => {
    if (formData.monthlyConstraints) {
      const cycleDefaults = { Daily: 24, Weekly: 168, Monthly: 730, Yearly: 8760 };
      setFormData((prev) => ({
        ...prev,
        monthlyConstraintCycles: cycleDefaults[prev.monthlyConstraintType] || 24,
      }));
    }
  }, [formData.monthlyConstraintType, formData.monthlyConstraints]);

  const handleChange = useCallback((e) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? value : e.target.value;

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }

    setFormData(prev => ({ ...prev, [name]: val }));
    setSaveSuccess(false);
  }, [errors]);

  const validate = () => {
    const newErrors = {};
    if (!scenarioName.trim()) {
      newErrors.scenarioName = 'Scenario Name is required.';
    }
    if (!baseYear.trim()) {
      newErrors.baseYear = 'Base Year is required.';
    }
    if (!projectPath) {
      newErrors.projectPath = 'Project Path is required.';
    }
    return newErrors;
  };

  const handleSave = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setErrors({});
    try {
      const newLastUpdated = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' });
      const configData = {
        projectPath,
        scenarioName,
        baseYear,
        lastUpdated: newLastUpdated,
        configuration: {
          coreSettings: {
            committable: formData.committable,
            monthlyConstraints: {
              enabled: formData.monthlyConstraints,
              type: formData.monthlyConstraintType,
              cycles: parseInt(formData.monthlyConstraintCycles, 10),
            },
            co2Constraints: formData.co2Constraints,
          },
          energyManagement: {
            batteryCycle: formData.batteryCycle,
            storageDischarging: formData.storageDischarging,
            runPypsaModelOn: formData.runPypsaModelOn,
          },
          optimization: {
            solver: formData.solver,
            multiYearInvestment: formData.multiYearInvestment,
            weightings: formData.weightings,
          },
          assetManagement: {
            generatorRetirements: formData.generatorRetirements,
            storageRetirements: formData.storageRetirements,
            generatorCluster: formData.generatorCluster,
          },
          advancedOptions: {
            batteryCycleCost: formData.batteryCycleCost,
            rollingHorizon: formData.rollingHorizon,
          },
        },
      };
      const response = await axios.post('/project/save-model-config', configData);
      if (response.data.success) {
        setLastUpdated(newLastUpdated);
        setSaveSuccess(true);
        toast.success('Configuration saved successfully! 🎉');
        lastSavedState.current = { ...formData, scenarioName, baseYear, projectPath };
      } else {
        setErrors({ api: response.data.message || 'Failed to save configuration.' });
        toast.error(response.data.message || 'Failed to save configuration.');
      }
    } catch (error) {
      setErrors({ api: error.response?.data?.message || 'An error occurred while saving the configuration.' });
      toast.error(error.response?.data?.message || 'An error occurred while saving the configuration.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleRevert = () => {
    setFormData(lastSavedState.current);
    setScenarioName(lastSavedState.current.scenarioName);
    setBaseYear(lastSavedState.current.baseYear);
    setProjectPath(lastSavedState.current.projectPath);
    setErrors({});
  };

  const handleRunModel = async () => {
    setIsRunning(true);
    setLogs("");
    toast.success('Model run started! 🚀');

    try {
      await axios.post('http://localhost:8000/project/run-pypsa-model', { projectPath, scenarioName });

      const eventSource = new EventSource('http://localhost:8000/project/pypsa-model-progress');

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          setLogs(data.log);
        } else if (data.type === 'end') {
          setIsRunning(false);
          eventSource.close();
          if (data.status === 'completed') {
            toast.success('Model run completed! 🎉');
          } else {
            toast.error(data.error || 'Model run failed.');
          }
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource failed:', error);
        toast.error('Failed to get real-time updates.');
        eventSource.close();
        setIsRunning(false);
      };

    } catch (error) {
      setIsRunning(false);
      toast.error(error.response?.data?.message || 'Failed to start model run.');
    }
  };

  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <div className="min-h-screen bg-slate-50 font-sans">

        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <header className="mb-4">
            <div className="flex items-center gap-3 mb-2">
              <Database className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Model Configuration</h1>
                <p className="text-md text-slate-600">Define parameters for the power system simulation.</p>
              </div>
            </div>
            {lastUpdated && (
              <div className="text-xs text-slate-700 bg-slate-200 px-3 py-1 rounded-full inline-block mt-2">
                Last Saved: {lastUpdated}
              </div>
            )}
            {errors.api && (
              <div className="text-xs text-red-600 bg-red-100 px-3 py-1 rounded-full inline-block mt-2">
                Error: {errors.api}
              </div>
            )}
            {errors.projectPath && (
              <div className="text-xs text-red-600 bg-red-100 px-3 py-1 rounded-full inline-block mt-2">
                Error: {errors.projectPath}
              </div>
            )}
          </header>

          <main className="space-y-5">
            <SectionCard title="Scenario Setup" subtitle="Define the name and base year for this configuration." icon={Settings}>
              <FormField label="Scenario Name" className="lg:col-span-2" error={errors.scenarioName}>
                <input
                  type="text"
                  value={scenarioName}
                  onChange={(e) => {
                    setScenarioName(e.target.value);
                    if (errors.scenarioName) setErrors(prev => ({ ...prev, scenarioName: undefined }));
                    setSaveSuccess(false);
                  }}
                  className={`w-full p-2 border-b-2 transition-colors ${errors.scenarioName ? 'border-red-500' : 'border-slate-200 focus:border-blue-500'} outline-none`}
                  placeholder="e.g., National_Grid_2026"
                />
              </FormField>
              <FormField label="Base Year" error={errors.baseYear}>
                <input
                  type="number"
                  value={baseYear}
                  onChange={(e) => {
                    setBaseYear(e.target.value);
                    if (errors.baseYear) setErrors(prev => ({ ...prev, baseYear: undefined }));
                    setSaveSuccess(false);
                  }}
                  className={`w-full p-2 border-b-2 transition-colors ${errors.baseYear ? 'border-red-500' : 'border-slate-200 focus:border-blue-500'} outline-none`}
                  placeholder="e.g., 2026"
                />
              </FormField>
              {errors.projectPath && (
                <FormField label="Project Path" error={errors.projectPath}>
                  <input type="text" value={projectPath} readOnly className="w-full p-2 border-b-2 border-red-500 outline-none bg-slate-100" />
                </FormField>
              )}
            </SectionCard>

            <SectionCard title="Core Settings" subtitle="Unit commitment and constraints." icon={Settings}>
              <FormField label="Committable"><ToggleSwitch name="committable" value={formData.committable} onChange={handleChange} /></FormField>
              <FormField label="Co₂ constraints"><ToggleSwitch name="co2Constraints" value={formData.co2Constraints} onChange={handleChange} /></FormField>
              <FormField label="Monthly constraints"><ToggleSwitch name="monthlyConstraints" value={formData.monthlyConstraints} onChange={handleChange} /></FormField>
              <div className={`lg:col-span-3 w-full transition-all duration-300 ease-in-out overflow-hidden ${formData.monthlyConstraints ? 'max-h-screen opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-4 bg-slate-50 rounded-lg">
                  <FormField label="Constraint Period">
                    <select name="monthlyConstraintType" value={formData.monthlyConstraintType} onChange={handleChange} className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm">
                      {['Daily', 'Weekly', 'Monthly', 'Yearly'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Number of Cycles">
                    <input type="number" name="monthlyConstraintCycles" value={formData.monthlyConstraintCycles} onChange={handleChange} className="w-full p-2 border-b-2 border-slate-200 focus:border-blue-500 outline-none" />
                  </FormField>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Energy Management" subtitle="Storage, dispatch, and modeling horizon." icon={Zap}>
              <FormField label="Battery Cycle"><ToggleSwitch name="batteryCycle" value={formData.batteryCycle} onChange={handleChange} /></FormField>
              <FormField label="Storage Charging/Discharging">
                <select name="storageDischarging" value={formData.storageDischarging} onChange={handleChange} className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                  {['Least cost', 'Solar and non solar hours'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </FormField>
              <FormField label="Run Pypsa Model on">
                <select name="runPypsaModelOn" value={formData.runPypsaModelOn} onChange={handleChange} className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                  {['All Snapshots', 'Peak week of Month', 'Custom days'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </FormField>
            </SectionCard>

            <SectionCard title="Optimization" subtitle="Solvers and investment strategies." icon={TrendingUp}>
              <FormField label="Solver">
                <select name="solver" value={formData.solver} onChange={handleChange} className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                  {['Highs', 'Gurobi', 'CPLEX', 'CBC'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </FormField>
              <FormField label="Multi Year Investment">
                <select name="multiYearInvestment" value={formData.multiYearInvestment} onChange={handleChange} className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                  <option value="No">No</option>
                  <option value="Only Capacity expansion on multi year">Only Capacity expansion on multi year</option>
                  <option value="ALL in One with multi year">ALL in One with multi year</option>
                </select>
              </FormField>
              <FormField label="Weightings">
                <select name="weightings" value={formData.weightings} onChange={handleChange} className="w-full p-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </FormField>
            </SectionCard>

            <SectionCard title="Asset Management" subtitle="Retirements and clustering." icon={Archive}>
              <FormField label="Generator Retirements"><ToggleSwitch name="generatorRetirements" value={formData.generatorRetirements} onChange={handleChange} /></FormField>
              <FormField label="Storage Retirements"><ToggleSwitch name="storageRetirements" value={formData.storageRetirements} onChange={handleChange} /></FormField>
              <FormField label="Generator Cluster" tooltip="Group similar generators to reduce model complexity."><ToggleSwitch name="generatorCluster" value={formData.generatorCluster} onChange={handleChange} /></FormField>
            </SectionCard>

            <SectionCard title="Advanced Options" subtitle="Costs and horizon modeling." icon={Sliders}>
              <FormField label="Battery Cycle Cost"><ToggleSwitch name="batteryCycleCost" value={formData.batteryCycleCost} onChange={handleChange} /></FormField>
              <FormField label="Rolling horizon" tooltip="Optimize the model in sequential, overlapping time windows."><ToggleSwitch name="rollingHorizon" value={formData.rollingHorizon} onChange={handleChange} /></FormField>
            </SectionCard>

            <SectionCard title="Model Execution" subtitle="Run the PyPSA model and view logs." icon={Zap}>
              <div className="lg:col-span-3">
                <button
                  onClick={handleRunModel}
                  disabled={isRunning || !scenarioName.trim() || !projectPath}
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 font-semibold rounded-lg transition-all duration-300 shadow-sm text-sm w-full text-center text-white
                  ${isRunning ? 'bg-slate-400' : 'bg-green-600 hover:bg-green-700'}
                  disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {isRunning ? <><Loader2 className="w-5 h-5 animate-spin" />Running Model...</> : 'Run PyPSA Model'}
                </button>
              </div>
              {logs && (
                <div className="lg:col-span-3 bg-slate-100 p-4 rounded-lg max-h-96 overflow-y-auto">
                  <h3 className="font-semibold text-slate-800 mb-2">Logs</h3>
                  <pre className="space-y-2 text-xs font-mono whitespace-pre-wrap">
                    {logs}
                  </pre>
                </div>
              )}
            </SectionCard>
          </main>

          <footer className="sticky bottom-0 bg-white/80 backdrop-blur-sm border-t border-slate-200 p-3">

            <div className="flex items-center justify-end px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !scenarioName.trim() || !baseYear.trim() || !projectPath}
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 font-semibold rounded-lg transition-all duration-300 shadow-sm text-sm w-40 text-center text-white
                  ${isSaving ? 'bg-slate-400' : ''}
                  ${!isSaving ? 'bg-blue-600 hover:bg-blue-700' : ''}
                  ${saveSuccess ? 'bg-green-600' : ''}
                  disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" />Saving...</>
                    : saveSuccess ? <><CheckCircle className="w-5 h-5" />Saved!</>
                      : <><Save className="w-5 h-5" />Save Changes</>
                  }
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
};

export default ModelConfig;