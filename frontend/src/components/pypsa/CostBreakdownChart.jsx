import React from 'react';
import ReactApexChart from 'react-apexcharts';
import { getCarrierColor, formatCost } from '../../utils/pypsaUtils';

const CostBreakdownChart = ({ data }) => {
  if (!data || !data.costs) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No cost data available</p>
      </div>
    );
  }

  const costs = data.costs;

  // Extract cost data
  const costItems = [];
  if (costs.capital_costs) {
    Object.entries(costs.capital_costs).forEach(([tech, cost]) => {
      costItems.push({ name: tech, capital: cost, marginal: 0, type: 'Capital Cost' });
    });
  }

  if (costs.marginal_costs) {
    Object.entries(costs.marginal_costs).forEach(([tech, cost]) => {
      const existing = costItems.find(item => item.name === tech);
      if (existing) {
        existing.marginal = cost;
      } else {
        costItems.push({ name: tech, capital: 0, marginal: cost, type: 'Marginal Cost' });
      }
    });
  }

  if (costItems.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No detailed cost breakdown available</p>
      </div>
    );
  }

  const technologies = costItems.map(d => d.name);
  const capitalCosts = costItems.map(d => d.capital);
  const marginalCosts = costItems.map(d => d.marginal);

  const chartOptions = {
    chart: {
      type: 'bar',
      stacked: true,
      toolbar: { show: true }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        borderRadius: 4
      }
    },
    xaxis: {
      categories: technologies,
      labels: {
        rotate: -45,
        rotateAlways: true
      }
    },
    yaxis: {
      title: { text: 'Cost (€)' },
      labels: {
        formatter: (val) => formatCost(val, '€', 0)
      }
    },
    legend: {
      position: 'top'
    },
    tooltip: {
      y: {
        formatter: (val) => formatCost(val, '€', 2)
      }
    },
    colors: ['#3B82F6', '#EF4444']
  };

  const series = [
    {
      name: 'Capital Cost',
      data: capitalCosts
    },
    {
      name: 'Marginal Cost',
      data: marginalCosts
    }
  ];

  const totalCost = costs.total_cost || capitalCosts.reduce((a, b) => a + b, 0) + marginalCosts.reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800">System Cost Breakdown</h3>
        <p className="text-sm text-slate-500">Capital and operational costs by technology</p>
      </div>
      <div className="p-4">
        {totalCost > 0 && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-900">Total System Cost</p>
            <p className="text-2xl font-bold text-blue-700">{formatCost(totalCost, '€', 2)}</p>
          </div>
        )}
        <ReactApexChart
          options={chartOptions}
          series={series}
          type="bar"
          height={350}
        />
      </div>
    </div>
  );
};

export default CostBreakdownChart;
