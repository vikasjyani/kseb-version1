import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

// A richer, better-styled custom tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/80 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-slate-200/50">
        <p className="font-bold text-slate-800 text-base mb-1">{`Year: ${label}`}</p>
        {payload.map((pld, index) => (
          <div key={index} style={{ color: pld.color }} className="flex items-center justify-between gap-4 text-sm font-semibold">
            <span>{`${pld.name}:`}</span>
            <span>{pld.value.toLocaleString("en-IN")}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const LineChart = ({
  data,
  title,
  xKey,
  yKeys,
  colors = [],
  legendLabels = [],
  xAxisLabel,
  yAxisLabel,
  tickStyle
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[460px] text-center p-10 bg-slate-50 rounded-2xl border border-slate-200">
        <div>
          <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-slate-900">No Data Available</h3>
          <p className="mt-1 text-sm text-slate-500">There is no data to display in the chart.</p>
        </div>
      </div>
    );
  }

  const defaultColors = ['#2563eb', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'];
  const isSingleSeries = yKeys && yKeys.length === 1;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-200/80 transition-shadow hover:shadow-xl">
      <h3 className="text-xl font-bold mb-6 text-slate-800 tracking-tight">{title}</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 50, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey={xKey}
            stroke="#94a3b8"
            tick={{ ...tickStyle }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            padding={{ left: 20, right: 20 }}
            label={{ value: xAxisLabel?.value, position: 'insideBottom', offset: -10, ...xAxisLabel?.style }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ ...tickStyle }}
            tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString("en-IN") : value}
            allowDecimals={false}
            domain={['auto', 'auto']}
            tickLine={false}
            axisLine={false}
            label={{ value: yAxisLabel?.value, angle: -90, position: 'insideLeft', offset: -35, ...yAxisLabel?.style }}
          />
          <Tooltip
            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={<CustomTooltip />}
          />
          {!isSingleSeries && (
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: "24px" }}
              formatter={(value, entry) => {
                const { color } = entry;
                return <span style={{ color }} className="text-sm font-medium">{value}</span>;
              }}
              iconType="circle"
              iconSize={8}
            />
          )}
          {yKeys.map((key, index) => {
            const strokeColor = colors[index % colors.length] || defaultColors[index % defaultColors.length];
            return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={strokeColor}
                  strokeWidth={3}
                  dot={{ r: 3, fill: strokeColor }}
                  activeDot={{
                    r: 8,
                    strokeWidth: 2,
                    fill: '#fff',
                    stroke: strokeColor,
                    style: { transition: 'r 0.2s ease-in-out' }
                  }}
                  name={legendLabels[index] || key}
                />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LineChart;