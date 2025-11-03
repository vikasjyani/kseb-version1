import React, { useState, useEffect } from 'react';
import { Calendar, Sliders, Filter } from 'lucide-react';

const PlotFilters = ({
  plotType,
  availability,
  filters,
  onFiltersChange,
  onGenerate,
  generating
}) => {
  const [localFilters, setLocalFilters] = useState({
    resolution: '1H',
    start_date: '',
    end_date: '',
    carriers: [],
    capacity_type: 'optimal',
    plot_style: 'bar',
    flow_type: 'heatmap',
    price_plot_type: 'line',
    buses: [],
    by_zone: false,
    stacked: true,
    ...filters
  });

  // Update local filters when prop changes
  useEffect(() => {
    setLocalFilters(prev => ({ ...prev, ...filters }));
  }, [filters]);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleGenerate = () => {
    onGenerate(localFilters);
  };

  // Get available filters for current plot type
  const getAvailableFilters = () => {
    if (!plotType || !availability?.plots?.[plotType]) {
      return [];
    }
    return availability.plots[plotType].filters || [];
  };

  const availableFilters = getAvailableFilters();
  const shouldShowFilter = (filterName) => availableFilters.includes(filterName);

  // Get available carriers and buses
  const availableCarriers = availability?.available_carriers || [];
  const availableBuses = availability?.available_buses || [];

  return (
    <div className="bg-white border-b border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Sliders className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-slate-800">Plot Filters</h3>
      </div>

      {!plotType ? (
        <div className="text-sm text-slate-500 italic">
          Select a plot type to see available filters
        </div>
      ) : (
        <div className="space-y-4">
          {/* Resolution Filter */}
          {shouldShowFilter('resolution') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Time Resolution
              </label>
              <select
                value={localFilters.resolution}
                onChange={(e) => handleFilterChange('resolution', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="1H">Hourly (1H)</option>
                <option value="1D">Daily (1D)</option>
                <option value="1W">Weekly (1W)</option>
                <option value="1M">Monthly (1M)</option>
              </select>
            </div>
          )}

          {/* Carriers Filter */}
          {shouldShowFilter('carriers') && availableCarriers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Carriers
              </label>
              <select
                multiple
                value={localFilters.carriers}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  handleFilterChange('carriers', selected);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                size={Math.min(availableCarriers.length, 5)}
              >
                {availableCarriers.map(carrier => (
                  <option key={carrier} value={carrier}>
                    {carrier}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Hold Ctrl/Cmd to select multiple carriers (or leave empty for all)
              </p>
            </div>
          )}

          {/* Date Range Filter */}
          {(shouldShowFilter('start_date') || shouldShowFilter('end_date')) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={localFilters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  End Date
                </label>
                <input
                  type="date"
                  value={localFilters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Capacity Type Filter */}
          {shouldShowFilter('capacity_type') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Capacity Type
              </label>
              <select
                value={localFilters.capacity_type}
                onChange={(e) => handleFilterChange('capacity_type', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="optimal">Optimal Capacity</option>
                <option value="installed">Installed Capacity</option>
                <option value="both">Both</option>
              </select>
            </div>
          )}

          {/* Plot Style Filter */}
          {shouldShowFilter('plot_style') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Plot Style
              </label>
              <select
                value={localFilters.plot_style}
                onChange={(e) => handleFilterChange('plot_style', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="bar">Bar Chart</option>
                <option value="pie">Pie Chart</option>
                <option value="treemap">Treemap</option>
              </select>
            </div>
          )}

          {/* Flow Type Filter */}
          {shouldShowFilter('flow_type') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Flow Visualization
              </label>
              <select
                value={localFilters.flow_type}
                onChange={(e) => handleFilterChange('flow_type', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="heatmap">Heatmap</option>
                <option value="line">Line Plot</option>
                <option value="sankey">Sankey Diagram</option>
              </select>
            </div>
          )}

          {/* Price Plot Type Filter */}
          {shouldShowFilter('price_plot_type') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Price Plot Type
              </label>
              <select
                value={localFilters.price_plot_type}
                onChange={(e) => handleFilterChange('price_plot_type', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="line">Line Plot</option>
                <option value="heatmap">Heatmap</option>
                <option value="duration_curve">Duration Curve</option>
              </select>
            </div>
          )}

          {/* Buses Filter */}
          {shouldShowFilter('buses') && availableBuses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Buses (up to 10)
              </label>
              <select
                multiple
                value={localFilters.buses}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  handleFilterChange('buses', selected.slice(0, 10));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                size={Math.min(availableBuses.length, 5)}
              >
                {availableBuses.map(bus => (
                  <option key={bus} value={bus}>
                    {bus}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Select specific buses for price analysis (leave empty for all)
              </p>
            </div>
          )}

          {/* By Zone Toggle */}
          {shouldShowFilter('by_zone') && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="by_zone"
                checked={localFilters.by_zone}
                onChange={(e) => handleFilterChange('by_zone', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="by_zone" className="text-sm font-medium text-slate-700">
                Group by Zone/Region
              </label>
            </div>
          )}

          {/* Stacked Toggle */}
          {shouldShowFilter('stacked') && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="stacked"
                checked={localFilters.stacked}
                onChange={(e) => handleFilterChange('stacked', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="stacked" className="text-sm font-medium text-slate-700">
                Stacked Areas
              </label>
            </div>
          )}

          {/* Generate Button */}
          <div className="pt-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`
                w-full px-4 py-3 rounded-md font-medium text-white
                transition-colors flex items-center justify-center gap-2
                ${generating
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
                }
              `}
            >
              {generating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Filter className="w-5 h-5" />
                  Generate Plot
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlotFilters;
