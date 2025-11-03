import React from 'react';
import ReactApexChart from 'react-apexcharts';
import { getCarrierColor, formatLargeNumber } from '../../utils/pypsaUtils';

const EmissionsChart = ({ data }) => {
  if (!data || !data.emissions) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No emissions data available</p>
      </div>
    );
  }

  const emissions = data.emissions.total_emissions || [];

  if (emissions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No emissions data available</p>
      </div>
    );
  }

  const carriers = emissions.map(d => d.Carrier);
  const co2Values = emissions.map(d => d.CO2_Emissions_tCO2);
  const colors = carriers.map(carrier => getCarrierColor(carrier));
  const totalEmissions = co2Values.reduce((a, b) => a + b, 0);

  const chartOptions = {
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
      formatter: (val) => formatLargeNumber(val, 1) + ' tCO₂',
      style: {
        fontSize: '11px'
      }
    },
    xaxis: {
      categories: carriers,
      title: { text: 'CO₂ Emissions (tCO₂)' },
      labels: {
        formatter: (val) => formatLargeNumber(val, 0)
      }
    },
    yaxis: {
      title: { text: 'Carrier' }
    },
    legend: { show: false },
    tooltip: {
      y: {
        formatter: (val) => formatLargeNumber(val, 2) + ' tCO₂'
      }
    }
  };

  const series = [{
    name: 'CO₂ Emissions',
    data: co2Values
  }];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800">CO₂ Emissions Analysis</h3>
        <p className="text-sm text-slate-500">Total emissions by carrier type</p>
      </div>
      <div className="p-4">
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-900">Total CO₂ Emissions</p>
          <p className="text-2xl font-bold text-red-700">{formatLargeNumber(totalEmissions, 2)} tCO₂</p>
        </div>
        <ReactApexChart
          options={chartOptions}
          series={series}
          type="bar"
          height={Math.max(250, carriers.length * 40)}
        />
      </div>
    </div>
  );
};

export default EmissionsChart;
