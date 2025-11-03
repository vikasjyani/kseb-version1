


import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiX, FiChevronDown, FiSave } from 'react-icons/fi';
import { Loader2 } from 'lucide-react'; 

const ModelSelection = ({ isOpen, onClose, onSave, currentSelections, scenarioName, projectPath, sectors }) => {
  const [models, setModels] = useState({});
  const [selectedModels, setSelectedModels] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !scenarioName || !projectPath) return;

    setIsLoading(true);
    setError('');
    axios.get(`/project/scenarios/${scenarioName}/models`, { params: { projectPath } })
      .then(res => {
        if (res.data.success) {
          const fetchedModels = res.data.models || {};
          setModels(fetchedModels);

          const initialSelections = {};
          const hasExistingSelections = currentSelections && Object.keys(currentSelections).length > 0;

          for (const sector of sectors) {
            const options = fetchedModels[sector] || [];

            if (hasExistingSelections && currentSelections[sector] && options.includes(currentSelections[sector])) {
              initialSelections[sector] = currentSelections[sector];
            } else if (options.length > 0) {
              initialSelections[sector] = options.includes('WAM') ? 'WAM' : options[0];
            } else {
              initialSelections[sector] = '';
            }
          }
          setSelectedModels(initialSelections);
        } else {
          setError(res.data.message || 'Failed to fetch model data.');
        }
      })
      .catch(err => {
        console.error("Error fetching models:", err);
        setError('An error occurred while fetching model options.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, scenarioName, projectPath, sectors, currentSelections]);

  const handleSelectionChange = (sector, value) => {
    setSelectedModels(prev => ({ ...prev, [sector]: value }));
  };

  const handleSave = () => {
    if (onSave) {
      onSave(selectedModels);
    }
  };

  if (!isOpen) return null;

  return (
    
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      onClick={onClose}
    >
      
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-slate-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Model Selection for <span className="text-indigo-600">{scenarioName}</span></h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
            <FiX size={20} className="text-slate-600" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-full text-slate-500">
                <Loader2 className="animate-spin mr-2" />
                Loading model options...
            </div>
          ) : error ? (
            <div className="text-center text-red-600 bg-red-50 p-4 rounded-lg">{error}</div>
          ) : sectors.length > 0 ? (
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sectors.map(sector => (
                <div key={sector}>
                  <label className="text-base font-semibold text-slate-700 block mb-2">{sector}</label>
                  {(models[sector] && models[sector].length > 0) ? (
                    <div className="relative">
                      <select
                        value={selectedModels[sector] || ''}
                        onChange={(e) => handleSelectionChange(sector, e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:ring-0 transition appearance-none"
                      >
                        {models[sector].map(modelName => (
                          <option key={modelName} value={modelName}>{modelName}</option>
                        ))}
                      </select>
                      <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                    </div>
                  ) : (
                    <p className="text-slate-500 italic text-sm px-2">No model options found.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-500">No sectors found for this scenario.</div>
          )}
        </div>

        <div className="flex justify-end items-center px-6 py-4 bg-slate-50 border-t border-slate-200 space-x-3">
          <button onClick={onClose} className="px-5 py-2 bg-slate-200 text-slate-800 font-bold rounded-lg hover:bg-slate-300 transition-all text-sm">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isLoading || !!error} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-all disabled:bg-slate-400 disabled:cursor-not-allowed text-sm">
            <FiSave size={16} />
            Save Selections
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelSelection;
