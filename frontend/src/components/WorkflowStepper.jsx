// import React from 'react';
// import { VscGraph } from "react-icons/vsc";
// import { TbActivityHeartbeat } from "react-icons/tb";
// import { BarChart3 } from "lucide-react";
// import { FiGrid } from "react-icons/fi";

// const WorkflowStepper = ({ selected, setSelected, activeProject }) => {
//     const workflowSteps = [
//         { name: "Demand Projection", icon: <VscGraph size={22} /> },
//         { name: "Demand Visualization", icon: <TbActivityHeartbeat size={22} /> },
//         { name: "Generate Profiles", icon: <BarChart3 size={22} /> },
//         { name: "Analyze Profiles", icon: <TbActivityHeartbeat size={22} /> },
//         { name: "Model Config", icon: <FiGrid size={22} /> },
//         { name: "View Results", icon: <TbActivityHeartbeat size={22} /> },
//     ];

//     const currentIndex = workflowSteps.findIndex(step => step.name === selected);

//     if (currentIndex === -1 || !activeProject) {
//         return null; 
//     }

//     return (
        
//         <div className="h-full bg-slate-900 text-slate-300 flex flex-col items-center w-20 border-l border-slate-700/50 pt-4">
//             <nav className="space-y-3">
//                 {workflowSteps.map((step, index) => {
//                     const isCompleted = index < currentIndex;
//                     const isCurrent = index === currentIndex;

//                     let statusClasses = "hover:bg-slate-700/50 hover:text-white"; 
//                     if (isCurrent) {
//                         statusClasses = "bg-indigo-500/10 text-indigo-300"; 
//                     } else if (isCompleted) {
//                         statusClasses = "bg-green-500/10 text-green-300";
//                     }

//                     return (
//                         <div key={step.name} className="flex flex-col items-center">
//                             <button
//                                 onClick={() => setSelected(step.name)}
//                                 title={step.name}
//                                 className={`flex items-center justify-center w-14 h-14 p-2 rounded-lg text-sm font-medium transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-500 ${statusClasses}`}
//                             >
//                                 {step.icon}
//                             </button>
                            
                            
//                             {index < workflowSteps.length - 1 && (
//                                 <div className={`h-6 w-1 my-1 rounded-full ${isCompleted || isCurrent ? 'bg-green-500/50' : 'bg-slate-700'}`}></div>
//                             )}
//                         </div>
//                     );
//                 })}
//             </nav>
//         </div>
//     );
// };

// export default WorkflowStepper;

import React from 'react';
import { VscGraph } from "react-icons/vsc";
import { TbActivityHeartbeat } from "react-icons/tb";
import { BarChart3 } from "lucide-react";
import { FiGrid } from "react-icons/fi";

const WorkflowStepper = ({ selected, setSelected, activeProject }) => {
    const workflowSteps = [
        { name: "Demand Projection", icon: <VscGraph size={20} /> },
        { name: "Demand Visualization", icon: <TbActivityHeartbeat size={20} /> },
        { name: "Generate Profiles", icon: <BarChart3 size={20} /> },
        { name: "Analyze Profiles", icon: <TbActivityHeartbeat size={20} /> },
        { name: "Model Config", icon: <FiGrid size={20} /> },
        { name: "View Results", icon: <TbActivityHeartbeat size={20} /> },
    ];

    const currentIndex = workflowSteps.findIndex(step => step.name === selected);

    if (currentIndex === -1 || !activeProject) {
        return null;
    }

    return (
        // Padding wahi rakhi hai (pt-4, pb-4)
        <div className="h-full bg-slate-900 text-slate-300 w-20 border-l border-slate-700/50 overflow-y-auto flex flex-col items-center pt-4 pb-4">
            {/* Spacing ko thoda badha diya hai (space-y-1.5) */}
            <nav className="space-y-1.5">
                {workflowSteps.map((step, index) => {
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;

                    return (
                        <div key={step.name} className="flex flex-col items-center">
                            <button
                                onClick={() => setSelected(step.name)}
                                title={step.name}
                                // Button size wahi rakha hai (w-16, py-3)
                                className={`flex flex-col items-center justify-center w-16 h-auto py-3 px-1 rounded-lg transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                                    isCurrent
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/50 ring-2 ring-indigo-400"
                                        : isCompleted
                                        ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                                        : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                                }`}
                            >
                                {step.icon}
                                {/* Font size wahi rakha hai (text-[10px], mt-2) */}
                                <span className="text-[10px] font-semibold mt-2 leading-tight text-center">
                                    {step.name}
                                </span>
                            </button>

                            {index < workflowSteps.length - 1 && (
                                <div
                                    // Connector margin ko thoda badha diya hai (my-1.5)
                                    className={`h-4 w-0.5 my-1.5 rounded-full ${
                                        isCompleted || isCurrent ? 'bg-green-500' : 'bg-slate-700'
                                    }`}
                                ></div>
                            )}
                        </div>
                    );
                })}
            </nav>
        </div>
    );
};

export default WorkflowStepper;