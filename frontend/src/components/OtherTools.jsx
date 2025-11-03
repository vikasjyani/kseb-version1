import React from 'react';
// MODIFICATION: Replaced 'ChargingStation' with the correct 'PlugZap' icon
import { Sun, FlaskConical, PlugZap, Blocks } from 'lucide-react';

// A reusable card component for each tool
const ToolCard = ({ icon, title, description }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-6 transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-1.5">
    <div className="flex items-center justify-center w-14 h-14 bg-indigo-100 rounded-full mb-4 border-4 border-white ring-4 ring-indigo-100">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
    <p className="text-sm text-slate-500 mb-4">{description}</p>
    <button className="w-full text-sm font-semibold text-indigo-600 bg-indigo-100 hover:bg-indigo-200 py-2 px-4 rounded-lg transition-colors">
      Launch Tool
    </button>
  </div>
);

const OtherTools = () => {
  const tools = [
    {
      icon: <Sun size={28} className="text-indigo-600" />,
      title: 'Rooftop Solar Projection',
      description: 'Model and forecast the growth of distributed rooftop solar capacity and generation.',
    },
    {
      icon: <FlaskConical size={28} className="text-indigo-600" />,
      title: 'Hydrogen Demand Modeling',
      description: 'Analyze and project the future energy requirements for green hydrogen production.',
    },
    {
      // A modern plug and lightning bolt icon for EVs
      icon: <PlugZap size={28} className="text-indigo-600" />,
      title: 'EV Penetration Modeling',
      description: 'Simulate the adoption rate of electric vehicles and their impact on electricity demand.',
    },
    {
      icon: <Blocks size={28} className="text-indigo-600" />,
      title: 'Upcoming Tools',
      description: 'A preview of new and exciting features currently in development for the platform.',
    },
  ];

  return (
    <div className="h-full w-full bg-slate-50 p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Other Tools</h1>
        <p className="text-slate-500 mb-8">A collection of utilities to assist with your modeling and analysis workflow.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tools.map(tool => (
            <ToolCard key={tool.title} {...tool} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default OtherTools;