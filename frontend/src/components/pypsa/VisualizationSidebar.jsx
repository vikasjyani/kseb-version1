import React from 'react';
import {
  BarChart3,
  PieChart,
  Battery,
  Zap,
  DollarSign,
  TrendingDown,
  Sun,
  LayoutDashboard,
  ChevronRight
} from 'lucide-react';

const PLOT_TYPES = [
  {
    id: 'dispatch',
    label: 'Dispatch Plot',
    icon: BarChart3,
    description: 'Power system dispatch with generation and storage',
    color: 'blue'
  },
  {
    id: 'capacity',
    label: 'Capacity Analysis',
    icon: PieChart,
    description: 'Installed capacity by technology',
    color: 'green'
  },
  {
    id: 'storage',
    label: 'Storage Operation',
    icon: Battery,
    description: 'Storage operation and state of charge',
    color: 'purple'
  },
  {
    id: 'transmission',
    label: 'Transmission Flows',
    icon: Zap,
    description: 'Transmission line flows and utilization',
    color: 'yellow'
  },
  {
    id: 'prices',
    label: 'Energy Prices',
    icon: DollarSign,
    description: 'Nodal electricity prices',
    color: 'emerald'
  },
  {
    id: 'duration_curve',
    label: 'Duration Curve',
    icon: TrendingDown,
    description: 'Load and generation duration curves',
    color: 'orange'
  },
  {
    id: 'daily_profile',
    label: 'Daily Profile',
    icon: Sun,
    description: 'Typical daily generation and load profiles',
    color: 'amber'
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Comprehensive system overview',
    color: 'indigo'
  }
];

const VisualizationSidebar = ({
  availability,
  selectedPlotType,
  onSelectPlotType,
  loading
}) => {
  const getColorClasses = (color, isAvailable, isSelected) => {
    if (!isAvailable) {
      return {
        bg: 'bg-slate-100',
        hover: '',
        text: 'text-slate-400',
        icon: 'text-slate-300',
        border: 'border-slate-200'
      };
    }

    if (isSelected) {
      const colorMap = {
        blue: 'bg-blue-100 border-blue-400 text-blue-800',
        green: 'bg-green-100 border-green-400 text-green-800',
        purple: 'bg-purple-100 border-purple-400 text-purple-800',
        yellow: 'bg-yellow-100 border-yellow-400 text-yellow-800',
        emerald: 'bg-emerald-100 border-emerald-400 text-emerald-800',
        orange: 'bg-orange-100 border-orange-400 text-orange-800',
        amber: 'bg-amber-100 border-amber-400 text-amber-800',
        indigo: 'bg-indigo-100 border-indigo-400 text-indigo-800'
      };
      return {
        bg: colorMap[color] || colorMap.blue,
        hover: '',
        text: '',
        icon: '',
        border: ''
      };
    }

    const colorMap = {
      blue: { hover: 'hover:bg-blue-50', icon: 'text-blue-600' },
      green: { hover: 'hover:bg-green-50', icon: 'text-green-600' },
      purple: { hover: 'hover:bg-purple-50', icon: 'text-purple-600' },
      yellow: { hover: 'hover:bg-yellow-50', icon: 'text-yellow-600' },
      emerald: { hover: 'hover:bg-emerald-50', icon: 'text-emerald-600' },
      orange: { hover: 'hover:bg-orange-50', icon: 'text-orange-600' },
      amber: { hover: 'hover:bg-amber-50', icon: 'text-amber-600' },
      indigo: { hover: 'hover:bg-indigo-50', icon: 'text-indigo-600' }
    };

    return {
      bg: 'bg-white',
      hover: colorMap[color]?.hover || 'hover:bg-slate-50',
      text: 'text-slate-800',
      icon: colorMap[color]?.icon || 'text-slate-600',
      border: 'border-slate-200'
    };
  };

  const isPlotAvailable = (plotId) => {
    if (!availability || !availability.plots) return false;
    return availability.plots[plotId]?.available === true;
  };

  return (
    <div className="w-72 bg-slate-50 border-r border-slate-200 p-4 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">
          Visualizations
        </h2>
        <p className="text-sm text-slate-500">
          Select a plot type to visualize
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-200 animate-pulse rounded-lg"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {PLOT_TYPES.map((plotType) => {
            const isAvailable = isPlotAvailable(plotType.id);
            const isSelected = selectedPlotType === plotType.id;
            const colors = getColorClasses(plotType.color, isAvailable, isSelected);
            const Icon = plotType.icon;

            return (
              <button
                key={plotType.id}
                onClick={() => isAvailable && onSelectPlotType(plotType.id)}
                disabled={!isAvailable}
                className={`
                  w-full p-3 rounded-lg border-2 text-left
                  transition-all duration-200
                  ${colors.bg} ${colors.border} ${colors.hover}
                  ${!isAvailable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-md'}
                  ${isSelected ? 'shadow-md' : ''}
                `}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${colors.icon}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`font-medium text-sm ${colors.text}`}>
                        {plotType.label}
                      </h3>
                      {isSelected && (
                        <ChevronRight className="w-4 h-4 flex-shrink-0" />
                      )}
                    </div>
                    <p className={`text-xs mt-1 ${isAvailable ? 'text-slate-500' : 'text-slate-400'}`}>
                      {plotType.description}
                    </p>
                    {!isAvailable && (
                      <span className="inline-block mt-1 text-xs text-slate-400 italic">
                        Not available
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && availability && (
        <div className="mt-6 p-3 bg-white rounded-lg border border-slate-200">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">Network Info</h4>
          <div className="space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Scenario:</span>
              <span className="font-medium">{availability.scenario}</span>
            </div>
            <div className="flex justify-between">
              <span>Network:</span>
              <span className="font-medium truncate ml-2" title={availability.network_file}>
                {availability.network_file}
              </span>
            </div>
            {availability.available_carriers && (
              <div className="flex justify-between">
                <span>Carriers:</span>
                <span className="font-medium">{availability.available_carriers.length}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualizationSidebar;
