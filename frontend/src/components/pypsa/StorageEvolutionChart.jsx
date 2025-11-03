import React, { useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { TrendingUp, BarChart3, Table as TableIcon, Battery } from 'lucide-react';
import { formatPower, formatEnergy } from '../../utils/pypsaUtils';

const StorageEvolutionChart = ({ data }) => {
  const [viewMode, setViewMode] = useState('line'); // 'line', 'bar', 'table'
  const [storageType, setStorageType] = useState('all'); // 'all', 'battery', 'phs'

  const chartData = useMemo(() => {
    if (!data || !data.years) return null;

    const years = data.years;
    const batteryCapacity = data.battery_capacity_mw || {};
    const phsCapacity = data.phs_capacity_mw || {};
    const batteryEnergy = data.battery_energy_mwh || {};
    const phsEnergy = data.phs_energy_mwh || {};
    const batteryMaxHours = data.battery_max_hours || {};
    const phsMaxHours = data.phs_max_hours || {};

    return {
      years,
      batteryCapacity,
      phsCapacity,
      batteryEnergy,
      phsEnergy,
      batteryMaxHours,
      phsMaxHours
    };
  }, [data]);

  if (!chartData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No storage evolution data available</p>
      </div>
    );
  }

  // Prepare series
  const getSeries = () => {
    const { years, batteryCapacity, phsCapacity } = chartData;

    const series = [];

    if (storageType === 'all' || storageType === 'battery') {
      series.push({
        name: 'Battery Storage',
        data: years.map(year => batteryCapacity[year] || 0)
      });
    }

    if (storageType === 'all' || storageType === 'phs') {
      series.push({
        name: 'Pumped Hydro Storage',
        data: years.map(year => phsCapacity[year] || 0)
      });
    }

    return series;
  };

  const series = getSeries();

  const lineOptions = {
    chart: {
      type: 'line',
      toolbar: { show: true },
      zoom: { enabled: true }
    },
    stroke: {
      width: 3,
      curve: 'smooth'
    },
    colors: ['#10b981', '#3b82f6'], // Green for battery, blue for PHS
    xaxis: {
      categories: chartData.years,
      title: { text: 'Year' }
    },
    yaxis: {
      title: { text: 'Storage Capacity (MW)' },
      labels: {
        formatter: (val) => formatPower(val, 0)
      }
    },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center'
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val) => formatPower(val, 1)
      }
    },
    markers: {
      size: 5,
      hover: { size: 7 }
    }
  };

  const barOptions = {
    chart: {
      type: 'bar',
      stacked: false,
      toolbar: { show: true }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        borderRadius: 6,
        columnWidth: '60%'
      }
    },
    colors: ['#10b981', '#3b82f6'],
    xaxis: {
      categories: chartData.years,
      title: { text: 'Year' }
    },
    yaxis: {
      title: { text: 'Storage Capacity (MW)' },
      labels: {
        formatter: (val) => formatPower(val, 0)
      }
    },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center'
    },
    tooltip: {
      y: {
        formatter: (val) => formatPower(val, 1)
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Battery className="w-5 h-5 text-green-600" />
              Storage Evolution
            </h3>
            <p className="text-sm text-slate-500">Energy storage capacity trends</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('line')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'line' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Line Chart"
            >
              <TrendingUp className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('bar')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'bar' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Bar Chart"
            >
              <BarChart3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Table View"
            >
              <TableIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Storage Type Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setStorageType('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              storageType === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Storage
          </button>
          <button
            onClick={() => setStorageType('battery')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              storageType === 'battery' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Battery Storage
          </button>
          <button
            onClick={() => setStorageType('phs')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              storageType === 'phs' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Pumped Hydro
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {viewMode === 'line' && (
          <ReactApexChart
            options={lineOptions}
            series={series}
            type="line"
            height={400}
          />
        )}

        {viewMode === 'bar' && (
          <ReactApexChart
            options={barOptions}
            series={series}
            type="bar"
            height={400}
          />
        )}

        {viewMode === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Metric</th>
                  {chartData.years.map(year => (
                    <th key={year} className="px-4 py-3 text-right font-semibold text-slate-700">{year}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(storageType === 'all' || storageType === 'battery') && (
                  <>
                    <tr className="hover:bg-slate-50 bg-green-50">
                      <td className="px-4 py-3 font-semibold text-green-800" colSpan={chartData.years.length + 1}>
                        Battery Storage
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700 pl-8">Power Capacity (MW)</td>
                      {chartData.years.map(year => (
                        <td key={year} className="px-4 py-3 text-right text-slate-700 font-mono">
                          {formatPower(chartData.batteryCapacity[year] || 0, 1)}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700 pl-8">Energy Capacity (MWh)</td>
                      {chartData.years.map(year => (
                        <td key={year} className="px-4 py-3 text-right text-slate-700 font-mono">
                          {formatEnergy(chartData.batteryEnergy[year] || 0, 1)}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700 pl-8">Max Duration (hours)</td>
                      {chartData.years.map(year => (
                        <td key={year} className="px-4 py-3 text-right text-slate-700 font-mono">
                          {(chartData.batteryMaxHours[year] || 0).toFixed(1)}h
                        </td>
                      ))}
                    </tr>
                  </>
                )}

                {(storageType === 'all' || storageType === 'phs') && (
                  <>
                    <tr className="hover:bg-slate-50 bg-blue-50">
                      <td className="px-4 py-3 font-semibold text-blue-800" colSpan={chartData.years.length + 1}>
                        Pumped Hydro Storage
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700 pl-8">Power Capacity (MW)</td>
                      {chartData.years.map(year => (
                        <td key={year} className="px-4 py-3 text-right text-slate-700 font-mono">
                          {formatPower(chartData.phsCapacity[year] || 0, 1)}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700 pl-8">Energy Capacity (MWh)</td>
                      {chartData.years.map(year => (
                        <td key={year} className="px-4 py-3 text-right text-slate-700 font-mono">
                          {formatEnergy(chartData.phsEnergy[year] || 0, 1)}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700 pl-8">Max Duration (hours)</td>
                      {chartData.years.map(year => (
                        <td key={year} className="px-4 py-3 text-right text-slate-700 font-mono">
                          {(chartData.phsMaxHours[year] || 0).toFixed(1)}h
                        </td>
                      ))}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorageEvolutionChart;
