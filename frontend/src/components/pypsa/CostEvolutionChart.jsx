import React, { useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { TrendingUp, BarChart3, Table as TableIcon, DollarSign } from 'lucide-react';

const CostEvolutionChart = ({ data }) => {
  const [viewMode, setViewMode] = useState('bar'); // 'line', 'bar', 'table'
  const [costType, setCostType] = useState('all'); // 'all', 'capex', 'opex'

  const chartData = useMemo(() => {
    if (!data || !data.years) return null;

    const years = data.years;
    const totalCost = data.total_cost || {};
    const capex = data.capex || {};
    const opex = data.opex || {};

    return {
      years,
      totalCost,
      capex,
      opex
    };
  }, [data]);

  if (!chartData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No cost evolution data available</p>
      </div>
    );
  }

  // Prepare series
  const getSeries = () => {
    const { years, totalCost, capex, opex } = chartData;

    const series = [];

    if (costType === 'all') {
      series.push({
        name: 'CAPEX',
        data: years.map(year => capex[year] || 0)
      });
      series.push({
        name: 'OPEX',
        data: years.map(year => opex[year] || 0)
      });
    } else if (costType === 'capex') {
      series.push({
        name: 'CAPEX',
        data: years.map(year => capex[year] || 0)
      });
    } else if (costType === 'opex') {
      series.push({
        name: 'OPEX',
        data: years.map(year => opex[year] || 0)
      });
    }

    // Add total if showing all
    if (costType === 'all') {
      series.push({
        name: 'Total Cost',
        data: years.map(year => totalCost[year] || 0)
      });
    }

    return series;
  };

  const series = getSeries();

  const formatCost = (val) => {
    if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
    return val.toFixed(2);
  };

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
    colors: ['#3b82f6', '#ef4444', '#8b5cf6'], // Blue for CAPEX, Red for OPEX, Purple for Total
    xaxis: {
      categories: chartData.years,
      title: { text: 'Year' }
    },
    yaxis: {
      title: { text: 'Cost ($)' },
      labels: {
        formatter: (val) => formatCost(val)
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
        formatter: (val) => '$' + val.toLocaleString(undefined, { maximumFractionDigits: 0 })
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
      stacked: costType === 'all' && series.length === 2, // Stack only CAPEX and OPEX
      toolbar: { show: true }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        borderRadius: 6,
        columnWidth: '60%'
      }
    },
    colors: ['#3b82f6', '#ef4444', '#8b5cf6'],
    xaxis: {
      categories: chartData.years,
      title: { text: 'Year' }
    },
    yaxis: {
      title: { text: 'Cost ($)' },
      labels: {
        formatter: (val) => formatCost(val)
      }
    },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center'
    },
    tooltip: {
      y: {
        formatter: (val) => '$' + val.toLocaleString(undefined, { maximumFractionDigits: 0 })
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
              <DollarSign className="w-5 h-5 text-green-600" />
              Cost Evolution
            </h3>
            <p className="text-sm text-slate-500">CAPEX and OPEX trends over time</p>
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

        {/* Cost Type Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setCostType('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              costType === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Costs
          </button>
          <button
            onClick={() => setCostType('capex')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              costType === 'capex' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            CAPEX Only
          </button>
          <button
            onClick={() => setCostType('opex')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              costType === 'opex' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            OPEX Only
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
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Cost Type</th>
                  {chartData.years.map(year => (
                    <th key={year} className="px-4 py-3 text-right font-semibold text-slate-700">{year}</th>
                  ))}
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(costType === 'all' || costType === 'capex') && (
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-blue-800">CAPEX (Capital Expenditure)</td>
                    {chartData.years.map(year => {
                      const value = chartData.capex[year] || 0;
                      return (
                        <td key={year} className="px-4 py-3 text-right text-slate-700 font-mono">
                          ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right font-bold text-slate-800 font-mono">
                      ${chartData.years.reduce((sum, year) => sum + (chartData.capex[year] || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                )}

                {(costType === 'all' || costType === 'opex') && (
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-red-800">OPEX (Operational Expenditure)</td>
                    {chartData.years.map(year => {
                      const value = chartData.opex[year] || 0;
                      return (
                        <td key={year} className="px-4 py-3 text-right text-slate-700 font-mono">
                          ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right font-bold text-slate-800 font-mono">
                      ${chartData.years.reduce((sum, year) => sum + (chartData.opex[year] || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                )}

                {costType === 'all' && (
                  <tr className="hover:bg-slate-50 bg-slate-100">
                    <td className="px-4 py-3 font-bold text-slate-900">Total Cost</td>
                    {chartData.years.map(year => {
                      const value = chartData.totalCost[year] || 0;
                      return (
                        <td key={year} className="px-4 py-3 text-right font-bold text-slate-900 font-mono">
                          ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">
                      ${chartData.years.reduce((sum, year) => sum + (chartData.totalCost[year] || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border-t border-blue-200">
        <p className="text-xs text-blue-800">
          <strong>CAPEX:</strong> Capital expenditures for new installations and infrastructure.
          <strong className="ml-4">OPEX:</strong> Operational and maintenance costs for running the system.
        </p>
      </div>
    </div>
  );
};

export default CostEvolutionChart;
