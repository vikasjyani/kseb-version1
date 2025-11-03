import React, { useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { TrendingUp, AreaChart, Table as TableIcon } from 'lucide-react';
import { getCarrierColor } from '../../utils/pypsaUtils';

const EmissionsEvolutionChart = ({ data }) => {
  const [viewMode, setViewMode] = useState('line'); // 'line', 'area', 'table'
  const [dataView, setDataView] = useState('total'); // 'total', 'by_carrier', 'intensity'

  const chartData = useMemo(() => {
    if (!data || !data.years) return null;

    const years = data.years;
    const totalEmissions = data.total_emissions || {};
    const emissionsByCarrier = data.emissions_by_carrier || {};
    const carbonIntensity = data.carbon_intensity || {};

    // Get all carriers
    const allCarriers = new Set();
    years.forEach(year => {
      if (emissionsByCarrier[year]) {
        Object.keys(emissionsByCarrier[year]).forEach(carrier => allCarriers.add(carrier));
      }
    });

    return {
      years,
      carriers: Array.from(allCarriers),
      totalEmissions,
      emissionsByCarrier,
      carbonIntensity
    };
  }, [data]);

  if (!chartData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No emissions evolution data available</p>
      </div>
    );
  }

  // Prepare series based on view
  const getSeries = () => {
    const { years, carriers, totalEmissions, emissionsByCarrier, carbonIntensity } = chartData;

    if (dataView === 'total') {
      return [{
        name: 'Total CO₂ Emissions',
        data: years.map(year => totalEmissions[year] || 0)
      }];
    } else if (dataView === 'intensity') {
      return [{
        name: 'Carbon Intensity',
        data: years.map(year => carbonIntensity[year] || 0)
      }];
    } else {
      // by_carrier
      return carriers.map(carrier => ({
        name: carrier,
        data: years.map(year => {
          const yearData = emissionsByCarrier[year] || {};
          return yearData[carrier] || 0;
        })
      }));
    }
  };

  const series = getSeries();

  const lineOptions = {
    chart: {
      type: 'line',
      toolbar: { show: true },
      zoom: { enabled: true }
    },
    stroke: {
      width: dataView === 'by_carrier' ? 2 : 3,
      curve: 'smooth'
    },
    colors: dataView === 'by_carrier'
      ? chartData.carriers.map(c => getCarrierColor(c))
      : ['#ef4444'], // Red for emissions
    xaxis: {
      categories: chartData.years,
      title: { text: 'Year' }
    },
    yaxis: {
      title: {
        text: dataView === 'intensity'
          ? 'Carbon Intensity (tCO₂/MWh)'
          : 'CO₂ Emissions (tCO₂)'
      },
      labels: {
        formatter: (val) => val.toLocaleString(undefined, { maximumFractionDigits: 0 })
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
        formatter: (val) => val.toLocaleString(undefined, { maximumFractionDigits: 2 }) +
          (dataView === 'intensity' ? ' tCO₂/MWh' : ' tCO₂')
      }
    },
    markers: {
      size: 5,
      hover: { size: 7 }
    }
  };

  const areaOptions = {
    chart: {
      type: 'area',
      stacked: dataView === 'by_carrier',
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
    colors: dataView === 'by_carrier'
      ? chartData.carriers.map(c => getCarrierColor(c))
      : ['#ef4444'],
    xaxis: {
      categories: chartData.years,
      title: { text: 'Year' }
    },
    yaxis: {
      title: {
        text: dataView === 'intensity'
          ? 'Carbon Intensity (tCO₂/MWh)'
          : 'CO₂ Emissions (tCO₂)'
      },
      labels: {
        formatter: (val) => val.toLocaleString(undefined, { maximumFractionDigits: 0 })
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
        formatter: (val) => val.toLocaleString(undefined, { maximumFractionDigits: 2 }) +
          (dataView === 'intensity' ? ' tCO₂/MWh' : ' tCO₂')
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Emissions Evolution</h3>
            <p className="text-sm text-slate-500">CO₂ emissions trends over time</p>
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
              onClick={() => setViewMode('area')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'area' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Area Chart"
            >
              <AreaChart className="w-5 h-5" />
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
              dataView === 'total' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Total Emissions
          </button>
          <button
            onClick={() => setDataView('by_carrier')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              dataView === 'by_carrier' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            By Carrier
          </button>
          <button
            onClick={() => setDataView('intensity')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              dataView === 'intensity' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Carbon Intensity
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

        {viewMode === 'area' && (
          <ReactApexChart
            options={areaOptions}
            series={series}
            type="area"
            height={400}
          />
        )}

        {viewMode === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 sticky left-0 bg-slate-50">
                    {dataView === 'by_carrier' ? 'Carrier' : 'Metric'}
                  </th>
                  {chartData.years.map(year => (
                    <th key={year} className="px-4 py-3 text-right font-semibold text-slate-700">{year}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dataView === 'total' ? (
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">Total CO₂ Emissions (tCO₂)</td>
                    {chartData.years.map(year => (
                      <td key={year} className="px-4 py-3 text-right text-slate-700 font-mono">
                        {(chartData.totalEmissions[year] || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                    ))}
                  </tr>
                ) : dataView === 'intensity' ? (
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">Carbon Intensity (tCO₂/MWh)</td>
                    {chartData.years.map(year => (
                      <td key={year} className="px-4 py-3 text-right text-slate-700 font-mono">
                        {(chartData.carbonIntensity[year] || 0).toFixed(4)}
                      </td>
                    ))}
                  </tr>
                ) : (
                  chartData.carriers.map((carrier, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-4 py-3 sticky left-0 bg-white hover:bg-slate-50 flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getCarrierColor(carrier) }}
                        />
                        <span className="font-medium text-slate-800">{carrier}</span>
                      </td>
                      {chartData.years.map(year => {
                        const value = chartData.emissionsByCarrier[year]?.[carrier] || 0;
                        return (
                          <td key={year} className="px-4 py-3 text-right text-slate-700 font-mono">
                            {value > 0 ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmissionsEvolutionChart;
