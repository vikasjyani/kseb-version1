import React from 'react';
import { CheckCircle, XCircle, Calendar, Zap, Database, MapPin, Activity } from 'lucide-react';
import { formatLargeNumber } from '../../utils/pypsaUtils';

const MetricCard = ({ icon: Icon, label, value, unit, color = 'blue', subtext }) => (
  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <div className={`bg-${color}-100 p-2 rounded-lg`}>
            <Icon className={`w-4 h-4 text-${color}-600`} />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        </div>
        <div className="flex items-baseline gap-1">
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {unit && <span className="text-sm font-medium text-slate-500">{unit}</span>}
        </div>
        {subtext && (
          <p className="text-xs text-slate-500 mt-1">{subtext}</p>
        )}
      </div>
    </div>
  </div>
);

const NetworkMetricsCards = ({ availability }) => {
  if (!availability) return null;

  const basicInfo = availability.basic_info || {};
  const timeInfo = availability.time_series || {};
  const spatialInfo = availability.spatial_info || {};
  const components = availability.components || {};

  return (
    <div className="space-y-4">
      {/* Network Status Banner */}
      <div className={`rounded-lg p-4 flex items-center gap-3 ${basicInfo.is_solved ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
        {basicInfo.is_solved ? (
          <>
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900">Network Solved</p>
              <p className="text-sm text-green-700">
                Optimal dispatch available for all analyses
                {basicInfo.objective_value && ` • Objective: ${formatLargeNumber(basicInfo.objective_value, 2)}`}
              </p>
            </div>
          </>
        ) : (
          <>
            <XCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-yellow-900">Network Not Solved</p>
              <p className="text-sm text-yellow-700">
                Only capacity and static analyses available
              </p>
            </div>
          </>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Network Name */}
        <MetricCard
          icon={Database}
          label="Network"
          value={basicInfo.name || 'Unknown'}
          color="blue"
        />

        {/* Snapshots */}
        {timeInfo.total_snapshots > 0 && (
          <MetricCard
            icon={Calendar}
            label="Time Steps"
            value={formatLargeNumber(timeInfo.total_snapshots, 0)}
            subtext={timeInfo.years?.length > 0 ? `Years: ${timeInfo.years.join(', ')}` : ''}
            color="purple"
          />
        )}

        {/* Generators */}
        {components.generators && (
          <MetricCard
            icon={Zap}
            label="Generators"
            value={components.generators.count}
            subtext={`${components.generators.carriers_count || 0} technologies`}
            color="yellow"
          />
        )}

        {/* Zones */}
        {spatialInfo.has_zones && (
          <MetricCard
            icon={MapPin}
            label="Zones"
            value={spatialInfo.zones_count}
            subtext={spatialInfo.zones?.slice(0, 3).join(', ')}
            color="green"
          />
        )}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {components.storage_units && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-1">Storage Units</p>
            <p className="text-lg font-bold text-slate-900">{components.storage_units.count}</p>
          </div>
        )}

        {components.stores && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-1">Stores</p>
            <p className="text-lg font-bold text-slate-900">{components.stores.count}</p>
          </div>
        )}

        {components.lines && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-1">Lines</p>
            <p className="text-lg font-bold text-slate-900">{components.lines.count}</p>
          </div>
        )}

        {components.links && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-1">Links</p>
            <p className="text-lg font-bold text-slate-900">{components.links.count}</p>
          </div>
        )}

        {components.loads && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-1">Loads</p>
            <p className="text-lg font-bold text-slate-900">{components.loads.count}</p>
          </div>
        )}

        {components.buses && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-1">Buses</p>
            <p className="text-lg font-bold text-slate-900">{components.buses.count}</p>
          </div>
        )}
      </div>

      {/* Time Resolution Info */}
      {timeInfo.resolution_hours && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <p className="text-sm text-blue-800">
            <span className="font-medium">Temporal Resolution:</span>{' '}
            {timeInfo.resolution_hours}h per snapshot
            {timeInfo.time_range && (
              <span className="ml-2">
                • {new Date(timeInfo.time_range.start).toLocaleDateString()} to{' '}
                {new Date(timeInfo.time_range.end).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default NetworkMetricsCards;
