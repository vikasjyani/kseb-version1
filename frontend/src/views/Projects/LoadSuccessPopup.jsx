
import React from 'react';
import { FaCheckCircle, FaFolderOpen } from 'react-icons/fa';
import { FiX } from 'react-icons/fi';

const LoadSuccessPopup = ({ projectPath, onClose, onGoToDashboard }) => {
  const projectName = projectPath.split(/[\\/]/).pop();
  const lastOpened = new Date().toLocaleString();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 ease-out">
        <div className="p-6 text-center">
          <FaCheckCircle size={56} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-extrabold text-slate-800">Project Loaded</h2>
          <p className="text-base text-slate-600 mt-2">
            Your project is ready to go.
          </p>
        </div>

        <div className="bg-slate-50 p-6 border-t border-b border-slate-200">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <FaFolderOpen size={40} className="text-blue-500" />
            </div>
            <div className="text-left flex-grow">
              <h3 className="text-lg font-bold text-slate-900">{projectName}</h3>
              <p className="text-sm text-slate-600 break-all">{projectPath}</p>
              <p className="text-xs text-slate-500 mt-2">
                <b>Last Opened:</b> {lastOpened}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 flex justify-end gap-4 bg-slate-50 rounded-b-2xl">
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
          >
            Close
          </button>
          <button 
            onClick={onGoToDashboard} 
            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoadSuccessPopup;