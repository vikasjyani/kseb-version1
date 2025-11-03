import React, { useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { AreaChart, BarChart3, Table as TableIcon } from 'lucide-react';
import { getCarrierColor, formatEnergy, formatPercentage } from '../../utils/pypsaUtils';

const EnergyMixEvolutionChart = ({ data }) => {
  const [viewMode, setViewMode] = useState('area'); // 'area', 'bar', 'table'
  const [showPercentage, setShowPercentage] = useState(false);

  const chartData = useMemo(() => {
    if (!data || !data.years) return null;

    const years = data.years;
    const generation = data.generation || {};
    const percentages = data.generation_percentage || {};
    const renewableShare = data.renewable_share || {};

    // Get all carriers
    const allCarriers = new Set();
    years.forEach(year => {
      if (generation[year]) {
        Object.keys(generation[year]).forEach(carrier => allCarriers.add(carrier));
      }
    });

    return {
      years,
      carriers: Array.from(allCarriers),
      generation,
      percentages,
      renewableShare
    };
  }, [data]);

  if (!chartData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No energy mix evolution data available</p>
      </div>
    );
  }

  // Prepare series
  const getSeries = () => {
    const { years, carriers, generation, percentages } = chartData;
    const dataSource = showPercentage ? percentages : generation;

    return carriers.map(carrier => ({
      name: carrier,
      data: years.map(year => {
        const yearData = dataSource[year] || {};
        return yearData[carrier] || 0;
      })
    }));
  };

  const series = getSeries();

  const areaOptions = {
    chart: {
      type: 'area',
      stacked: true,
      toolbar: { show: true },
      zoom: { enabled: true }
    },
    stroke: {
      width: 2,
      curve: 'smooth'
    },
    fill: {
      type: 'gradient',
      gradient: {
        opacityFrom: 0.7,
        opacityTo: 0.3,
      }
    },
    colors: chartData.carriers.map(c => getCarrierColor(c)),
    xaxis: {
      categories: chartData.years,
      title: { text: 'Year' }
    },
    yaxis: {
      title: { text: showPercentage ? 'Generation (%)' : 'Generation (GWh)' },
      labels: {
        formatter: (val) => showPercentage ? formatPercentage(val) : formatEnergy(val, 0)
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
        formatter: (val) => showPercentage ? formatPercentage(val) : formatEnergy(val, 2)
      }
    }
  };

  const barOptions = {
    chart: {
      type: 'bar',
      stacked: true,
      toolbar: { show: true }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        borderRadius: 6
      }
    },
    colors: chartData.carriers.map(c => getCarrierColor(c)),
    xaxis: {
      categories: chartData.years,
      title: { text: 'Year' }
    },
    yaxis: {
      title: { text: showPercentage ? 'Generation (%)' : 'Generation (GWh)' },
      labels: {
        formatter: (val) => showPercentage ? formatPercentage(val) : formatEnergy(val, 0)
      }
    },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center'
    },
    tooltip: {
      y: {
        formatter: (val) => showPercentage ? formatPercentage(val) : formatEnergy(val, 2)
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Energy Mix Evolution</h3>
            <p className="text-sm text-slate-500">Generation by carrier over time</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('area')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'area' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Area Chart"
            >
              <AreaChart className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('bar')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'bar' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Stacked Bar Chart"
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

        {/* Toggle Percentage */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPercentage(!showPercentage)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              showPercentage ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Show as Percentage
          </button>
          {data.renewable_share && (
            <div className="ml-auto text-sm">
              <span className="text-slate-600">Renewable Share: </span>
              <span className="font-semibold text-green-600">
                {Object.keys(chartData.renewableShare).length > 0 &&
                  `${chartData.renewableShare[chartData.years[chartData.years.length - 1]]?.toFixed(1)}%`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {viewMode === 'area' && (
          <ReactApexChart
            options={areaOptions}
            series={series}
            type="area"
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
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 sticky left-0 bg-slate-50">Carrier</th>
                  {chartData.years.map(year => (
                    <th key={year} className="px-4 py-3 text-right font-semibold text-slate-700">{year}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {chartData.carriers.map((carrier, index) => {
                  const dataSource = showPercentage ? chartData.percentages : chartData.generation;

                  return (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-4 py-3 sticky left-0 bg-white hover:bg-slate-50 flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getCarrierColor(carrier) }}
                        />
                        <span className="font-medium text-slate-800">{carrier}</span>
                      </td>
                      {chartData.years.map(year => {
                        const value = dataSource[year]?.[carrier] || 0;
                        return (
                          <td key={year} className="px-4 py-3 text-right text-slate-700 font-mono">
                            {value > 0 ? (showPercentage ? formatPercentage(value) : formatEnergy(value, 2)) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              {!showPercentage && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                  <tr>
                    <td className="px-4 py-3 font-bold text-slate-800">Total</td>
                    {chartData.years.map(year => {
                      const total = chartData.carriers.reduce((sum, carrier) => {
                        return sum + (chartData.generation[year]?.[carrier] || 0);
                      }, 0);
                      return (
                        <td key={year} className="px-4 py-3 text-right font-bold text-slate-800 font-mono">
                          {formatEnergy(total, 2)}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnergyMixEvolutionChart;
