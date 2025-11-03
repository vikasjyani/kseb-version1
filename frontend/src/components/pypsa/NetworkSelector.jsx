import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, FileText, RefreshCw, Loader2, AlertCircle } from 'lucide-react';

const NetworkSelector = ({ projectPath, onSelect, selectedScenario, selectedNetwork }) => {
  const [scenarios, setScenarios] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  const [loadingNetworks, setLoadingNetworks] = useState(false);
  const [error, setError] = useState(null);

  // Fetch scenarios on mount
  useEffect(() => {
    if (projectPath) {
      fetchScenarios();
    }
  }, [projectPath]);

  // Fetch networks when scenario changes
  useEffect(() => {
    if (projectPath && selectedScenario) {
      fetchNetworks(selectedScenario);
    } else {
      setNetworks([]);
    }
  }, [projectPath, selectedScenario]);

  const fetchScenarios = async () => {
    setLoadingScenarios(true);
    setError(null);

    try {
      const response = await axios.get('/project/pypsa/scenarios', {
        params: { projectPath }
      });

      if (response.data.success) {
        setScenarios(response.data.scenarios || []);

        // Auto-select first scenario if available
        if (response.data.scenarios?.length > 0 && !selectedScenario) {
          onSelect(response.data.scenarios[0], null);
        }
      }
    } catch (err) {
      console.error('Error fetching scenarios:', err);
      setError('Failed to load scenarios');
    } finally {
      setLoadingScenarios(false);
    }
  };

  const fetchNetworks = async (scenario) => {
    setLoadingNetworks(true);
    setError(null);

    try {
      const response = await axios.get('/project/pypsa/networks', {
        params: {
          projectPath,
          scenarioName: scenario
        }
      });

      if (response.data.success) {
        setNetworks(response.data.networks || []);

        // Auto-select first network if available
        if (response.data.networks?.length > 0 && !selectedNetwork) {
          onSelect(scenario, response.data.networks[0].name);
        }
      }
    } catch (err) {
      console.error('Error fetching networks:', err);
      setError('Failed to load network files');
    } finally {
      setLoadingNetworks(false);
    }
  };

  const handleScenarioChange = (e) => {
    const scenario = e.target.value;
    onSelect(scenario, null);
  };

  const handleNetworkChange = (e) => {
    const network = e.target.value;
    onSelect(selectedScenario, network);
  };

  const handleRefresh = () => {
    fetchScenarios();
    if (selectedScenario) {
      fetchNetworks(selectedScenario);
    }
  };

  if (!projectPath) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600" />
        <p className="text-sm text-yellow-800">No active project. Please load or create a project first.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Folder className="w-5 h-5 text-blue-600" />
          Network Selection
        </h3>
        <button
          onClick={handleRefresh}
          disabled={loadingScenarios || loadingNetworks}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${(loadingScenarios || loadingNetworks) ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scenario Selector */}
        <div>
          <label htmlFor="scenario-select" className="block text-sm font-medium text-slate-700 mb-2">
            Scenario
          </label>
          <div className="relative">
            <select
              id="scenario-select"
              value={selectedScenario || ''}
              onChange={handleScenarioChange}
              disabled={loadingScenarios || scenarios.length === 0}
              className="w-full p-2.5 pr-10 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {loadingScenarios ? 'Loading scenarios...' :
                  scenarios.length === 0 ? 'No scenarios found' :
                    'Select a scenario'}
              </option>
              {scenarios.map((scenario) => (
                <option key={scenario} value={scenario}>
                  {scenario}
                </option>
              ))}
            </select>
            {loadingScenarios && (
              <Loader2 className="absolute right-3 top-3 w-5 h-5 animate-spin text-blue-600" />
            )}
          </div>
          {scenarios.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">{scenarios.length} scenario(s) available</p>
          )}
        </div>

        {/* Network File Selector */}
        <div>
          <label htmlFor="network-select" className="block text-sm font-medium text-slate-700 mb-2">
            Network File
          </label>
          <div className="relative">
            <select
              id="network-select"
              value={selectedNetwork || ''}
              onChange={handleNetworkChange}
              disabled={!selectedScenario || loadingNetworks || networks.length === 0}
              className="w-full p-2.5 pr-10 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedScenario ? 'Select scenario first' :
                  loadingNetworks ? 'Loading networks...' :
                    networks.length === 0 ? 'No network files found' :
                      'Select a network file'}
              </option>
              {networks.map((network) => (
                <option key={network.name} value={network.name}>
                  {network.name} ({network.size_mb.toFixed(1)} MB)
                </option>
              ))}
            </select>
            {loadingNetworks && (
              <Loader2 className="absolute right-3 top-3 w-5 h-5 animate-spin text-blue-600" />
            )}
          </div>
          {networks.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">{networks.length} network file(s) available</p>
          )}
        </div>
      </div>

      {/* Current Selection Display */}
      {selectedScenario && selectedNetwork && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <FileText className="w-4 h-4" />
            <span className="font-medium">Current Selection:</span>
            <span className="font-mono">{selectedScenario} / {selectedNetwork}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkSelector;
