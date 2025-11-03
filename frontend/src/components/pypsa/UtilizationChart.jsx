import React from 'react';
import ReactApexChart from 'react-apexcharts';
import { getCarrierColor, formatPercentage } from '../../utils/pypsaUtils';

const UtilizationChart = ({ data }) => {
  if (!data || !data.utilization || data.utilization.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No utilization data available</p>
      </div>
    );
  }

  const chartData = data.utilization.sort((a, b) => b.Capacity_Factor - a.Capacity_Factor);
  const carriers = chartData.map(d => d.Carrier);
  const capacityFactors = chartData.map(d => d['Utilization_%']);
  const colors = carriers.map(carrier => getCarrierColor(carrier));

  const chartOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: true }
    },
    plotOptions: {
      bar: {
        horizontal: true,
        distributed: true,
        borderRadius: 6,
        dataLabels: {
          position: 'top'
        }
      }
    },
    colors: colors,
    dataLabels: {
      enabled: true,
      formatter: (val) => val.toFixed(1) + '%',
      offsetX: 20,
      style: {
        fontSize: '12px',
        colors: ['#000']
      }
    },
    xaxis: {
      categories: carriers,
      title: { text: 'Capacity Factor (%)' },
      max: 100,
      labels: {
        formatter: (val) => val.toFixed(0) + '%'
      }
    },
    yaxis: {
      title: { text: 'Technology' }
    },
    legend: { show: false },
    tooltip: {
      y: {
        formatter: (val) => val.toFixed(2) + '%'
      }
    }
  };

  const series = [{
    name: 'Capacity Factor',
    data: capacityFactors
  }];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800">Capacity Factors (Utilization)</h3>
        <p className="text-sm text-slate-500">Average utilization of installed capacity</p>
      </div>
      <div className="p-4">
        <ReactApexChart
          options={chartOptions}
          series={series}
          type="bar"
          height={Math.max(300, chartData.length * 40)}
        />
      </div>
    </div>
  );
};

export default UtilizationChart;
