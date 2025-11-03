

import React, { useState, useEffect } from 'react';
import { FiX, FiCheckSquare, FiSquare } from 'react-icons/fi';
import { FaBalanceScale } from 'react-icons/fa';

const CompareScenarioModal = ({ isOpen, onClose, scenarios, currentScenario, onCompare }) => {

  const [selectedToCompare, setSelectedToCompare] = useState([]);


  useEffect(() => {
    if (isOpen) {
      setSelectedToCompare([]);
    }
  }, [isOpen]);


  const handleToggleScenario = (scenarioName) => {
    setSelectedToCompare(prev =>
      prev.includes(scenarioName)
        ? prev.filter(s => s !== scenarioName)
        : [...prev, scenarioName]
    );
  };

  const handleCompareClick = () => {
    onCompare(selectedToCompare);
    onClose();
  };


  const otherScenarios = scenarios.filter(s => s !== currentScenario);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col p-8 m-4 border border-slate-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-4 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <FaBalanceScale className="text-blue-600" />
            Compare Scenarios
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
            <FiX size={24} className="text-slate-600" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto py-6">
          <p className="text-slate-600 mb-4">
            You are currently viewing the <strong className="text-slate-800">{currentScenario}</strong> scenario. Select one or more other scenarios to compare against it.
          </p>
          {otherScenarios.length > 0 ? (
            <div className="space-y-3">
              {otherScenarios.map(scenario => (
                <div
                  key={scenario}
                  onClick={() => handleToggleScenario(scenario)}
                  className="flex items-center p-4 rounded-lg border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all"
                >
                  {selectedToCompare.includes(scenario) ? (
                    <FiCheckSquare size={20} className="text-blue-600 mr-4" />
                  ) : (
                    <FiSquare size={20} className="text-slate-400 mr-4" />
                  )}
                  <span className="font-semibold text-slate-700">{scenario}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-10">No other scenarios are available to compare.</p>
          )}
        </div>

        <div className="flex justify-end items-center pt-6 border-t border-slate-200 space-x-4">
          <button onClick={onClose} className="px-6 py-2 bg-slate-200 text-slate-800 font-bold rounded-lg hover:bg-slate-300 transition-all">
            Cancel
          </button>
          <button
            onClick={handleCompareClick}
            disabled={selectedToCompare.length === 0}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-all disabled:bg-slate-400 disabled:cursor-not-allowed">
            Compare
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompareScenarioModal;