import React, { useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { TrendingUp, BarChart3, Table as TableIcon } from 'lucide-react';
import { getCarrierColor, formatPercentage } from '../../utils/pypsaUtils';

const CUFEvolutionChart = ({ data }) => {
  const [viewMode, setViewMode] = useState('line'); // 'line', 'bar', 'table'

  const chartData = useMemo(() => {
    if (!data || !data.years) return null;

    const years = data.years;
    const cufByCarrier = data.cuf_by_carrier || {};

    // Get all carriers
    const allCarriers = new Set();
    years.forEach(year => {
      if (cufByCarrier[year]) {
        Object.keys(cufByCarrier[year]).forEach(carrier => allCarriers.add(carrier));
      }
    });

    return {
      years,
      carriers: Array.from(allCarriers),
      cufByCarrier
    };
  }, [data]);

  if (!chartData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No CUF evolution data available</p>
      </div>
    );
  }

  // Prepare series
  const series = chartData.carriers.map(carrier => ({
    name: carrier,
    data: chartData.years.map(year => {
      const cuf = chartData.cufByCarrier[year]?.[carrier];
      return cuf ? (cuf * 100) : 0; // Convert to percentage
    })
  }));

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
      title: { text: 'Capacity Utilization Factor (%)' },
      min: 0,
      max: 100,
      labels: {
        formatter: (val) => val.toFixed(0) + '%'
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
        formatter: (val) => val.toFixed(2) + '%'
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
      toolbar: { show: true }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        borderRadius: 6,
        dataLabels: {
          position: 'top'
        }
      }
    },
    colors: chartData.carriers.map(c => getCarrierColor(c)),
    dataLabels: {
      enabled: true,
      formatter: (val) => val.toFixed(0) + '%',
      offsetY: -20,
      style: {
        fontSize: '10px',
        colors: ['#304758']
      }
    },
    xaxis: {
      categories: chartData.years,
      title: { text: 'Year' }
    },
    yaxis: {
      title: { text: 'Capacity Utilization Factor (%)' },
      min: 0,
      max: 100,
      labels: {
        formatter: (val) => val.toFixed(0) + '%'
      }
    },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center'
    },
    tooltip: {
      y: {
        formatter: (val) => val.toFixed(2) + '%'
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">CUF Evolution</h3>
            <p className="text-sm text-slate-500">Capacity Utilization Factor trends by carrier</p>
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
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {chartData.carriers.map((carrier, index) => {
                  const cufValues = chartData.years.map(year => chartData.cufByCarrier[year]?.[carrier] || 0);
                  const avgCUF = cufValues.reduce((a, b) => a + b, 0) / cufValues.length;

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
                        const cuf = chartData.cufByCarrier[year]?.[carrier];
                        return (
                          <td key={year} className="px-4 py-3 text-right text-slate-700 font-mono">
                            {cuf ? formatPercentage(cuf * 100) : '-'}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right font-bold text-slate-800 font-mono">
                        {formatPercentage(avgCUF * 100)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border-t border-blue-200">
        <p className="text-xs text-blue-800">
          <strong>CUF (Capacity Utilization Factor):</strong> Ratio of actual generation to maximum possible generation.
          Higher values indicate better asset utilization.
        </p>
      </div>
    </div>
  );
};

export default CUFEvolutionChart;
