import React, { useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { BarChart3, PieChart, Table as TableIcon } from 'lucide-react';
import { getCarrierColor, formatPower, sortCarriers } from '../../utils/pypsaUtils';

const CapacityChart = ({ data }) => {
  const [viewMode, setViewMode] = useState('bar'); // 'bar', 'pie', 'table'

  const chartData = useMemo(() => {
    if (!data || !data.capacities) return null;

    const generators = data.capacities.generators || [];
    const storageUnits = data.capacities.storage_units || [];
    const stores = data.capacities.stores || [];

    // Combine all capacity data
    const allCapacities = [];

    generators.forEach(item => {
      allCapacities.push({
        technology: item.Technology,
        capacity: item.Capacity_MW,
        count: item.Count,
        type: 'Generator'
      });
    });

    storageUnits.forEach(item => {
      allCapacities.push({
        technology: item.Technology,
        capacity: item.Power_Capacity_MW,
        count: item.Count,
        type: 'Storage Unit'
      });
    });

    stores.forEach(item => {
      allCapacities.push({
        technology: item.Technology,
        capacity: item.Energy_Capacity_MWh,
        count: item.Count,
        type: 'Store (MWh)'
      });
    });

    // Sort by capacity
    return allCapacities.sort((a, b) => b.capacity - a.capacity);
  }, [data]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No capacity data available</p>
      </div>
    );
  }

  // Prepare chart options
  const technologies = chartData.map(d => d.technology);
  const capacities = chartData.map(d => d.capacity);
  const colors = technologies.map(tech => getCarrierColor(tech));

  const barOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: true }
    },
    plotOptions: {
      bar: {
        horizontal: true,
        distributed: true,
        borderRadius: 6
      }
    },
    colors: colors,
    dataLabels: {
      enabled: true,
      formatter: (val) => formatPower(val, 0)
    },
    xaxis: {
      categories: technologies,
      title: { text: 'Installed Capacity (MW)' },
      labels: {
        formatter: (val) => formatPower(val, 0)
      }
    },
    yaxis: {
      title: { text: 'Technology' }
    },
    legend: { show: false },
    tooltip: {
      y: {
        formatter: (val) => formatPower(val, 1)
      }
    }
  };

  const barSeries = [{
    name: 'Capacity',
    data: capacities
  }];

  const pieOptions = {
    chart: {
      type: 'donut',
    },
    labels: technologies,
    colors: colors,
    legend: {
      position: 'right',
      fontSize: '14px'
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => val.toFixed(1) + '%'
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total Capacity',
              formatter: () => formatPower(capacities.reduce((a, b) => a + b, 0), 0)
            }
          }
        }
      }
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
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Total Installed Capacity</h3>
          <p className="text-sm text-slate-500">Capacity by technology type</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('bar')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'bar' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            title="Bar Chart"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('pie')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'pie' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            title="Pie Chart"
          >
            <PieChart className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            title="Table View"
          >
            <TableIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {viewMode === 'bar' && (
          <ReactApexChart
            options={barOptions}
            series={barSeries}
            type="bar"
            height={Math.max(300, chartData.length * 40)}
          />
        )}

        {viewMode === 'pie' && (
          <ReactApexChart
            options={pieOptions}
            series={capacities}
            type="donut"
            height={400}
          />
        )}

        {viewMode === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Technology</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Capacity</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Count</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {chartData.map((item, index) => {
                  const total = capacities.reduce((a, b) => a + b, 0);
                  const share = ((item.capacity / total) * 100).toFixed(1);

                  return (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getCarrierColor(item.technology) }}
                        />
                        <span className="font-medium text-slate-800">{item.technology}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 font-mono">
                        {formatPower(item.capacity, 1)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.count}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td className="px-4 py-3 font-bold text-slate-800">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800 font-mono">
                    {formatPower(capacities.reduce((a, b) => a + b, 0), 1)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">
                    {chartData.reduce((sum, item) => sum + item.count, 0)}
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CapacityChart;
