import React, { useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { BarChart3, TrendingUp, Table as TableIcon } from 'lucide-react';
import { getCarrierColor, formatPower } from '../../utils/pypsaUtils';

const CapacityEvolutionChart = ({ data }) => {
  const [viewMode, setViewMode] = useState('line'); // 'line', 'bar', 'table'
  const [dataView, setDataView] = useState('total'); // 'total', 'additions', 'retirements'

  const chartData = useMemo(() => {
    if (!data || !data.years) return null;

    const years = data.years;
    const totalCapacity = data.total_capacity || {};
    const newCapacity = data.new_capacity || {};
    const retiredCapacity = data.retired_capacity || {};

    // Get all carriers
    const allCarriers = new Set();
    years.forEach(year => {
      if (totalCapacity[year]) {
        Object.keys(totalCapacity[year]).forEach(carrier => allCarriers.add(carrier));
      }
    });

    return {
      years,
      carriers: Array.from(allCarriers),
      totalCapacity,
      newCapacity,
      retiredCapacity
    };
  }, [data]);

  if (!chartData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No capacity evolution data available</p>
      </div>
    );
  }

  // Prepare series based on view mode and data view
  const getSeries = () => {
    const { years, carriers, totalCapacity, newCapacity, retiredCapacity } = chartData;

    let dataSource = totalCapacity;
    if (dataView === 'additions') dataSource = newCapacity;
    if (dataView === 'retirements') dataSource = retiredCapacity;

    return carriers.map(carrier => ({
      name: carrier,
      data: years.map(year => {
        const yearData = dataSource[year] || {};
        return yearData[carrier] || 0;
      })
    }));
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
    colors: chartData.carriers.map(c => getCarrierColor(c)),
    xaxis: {
      categories: chartData.years,
      title: { text: 'Year' }
    },
    yaxis: {
      title: { text: 'Capacity (MW)' },
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
      title: { text: 'Capacity (MW)' },
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
            <h3 className="text-lg font-semibold text-slate-800">Capacity Evolution</h3>
            <p className="text-sm text-slate-500">Year-on-year capacity trends by carrier</p>
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

        {/* Data View Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setDataView('total')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              dataView === 'total' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Total Capacity
          </button>
          <button
            onClick={() => setDataView('additions')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              dataView === 'additions' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            New Additions
          </button>
          <button
            onClick={() => setDataView('retirements')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              dataView === 'retirements' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Retirements
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
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 sticky left-0 bg-slate-50">Carrier</th>
                  {chartData.years.map(year => (
                    <th key={year} className="px-4 py-3 text-right font-semibold text-slate-700">{year}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {chartData.carriers.map((carrier, index) => {
                  let dataSource = chartData.totalCapacity;
                  if (dataView === 'additions') dataSource = chartData.newCapacity;
                  if (dataView === 'retirements') dataSource = chartData.retiredCapacity;

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
                            {value > 0 ? formatPower(value, 1) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CapacityEvolutionChart;
