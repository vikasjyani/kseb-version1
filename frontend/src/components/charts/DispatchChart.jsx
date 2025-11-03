// File: frontend/src/components/charts/DispatchChart.jsx

import React, { useState, useMemo, useRef } from 'react';
import { LineChart, Line, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, ZoomIn, ZoomOut, Calendar, Filter } from 'lucide-react';
import ExportButton from '../common/ExportButton';

const DispatchChart = ({ data, availability, filters }) => {
  const chartRef = useRef(null);

  // Filter data based on selections
  const filteredData = useMemo(() => {
    let filtered = data;

    // Filter by date range
    if (filters.zoomLevel && filters.zoomLevel !== 'all') {
      const now = new Date();
      const ranges = {
        day: 1,
        week: 7,
        month: 30
      };
      const daysBack = ranges[filters.zoomLevel];
      filtered = filtered.filter(d =>
        new Date(d.timestamp) >= new Date(now - daysBack * 24 * 60 * 60 * 1000)
      );
    }

    // Filter by carriers
    if (filters.carriers && filters.carriers.length > 0) {
      // Keep only selected carriers
      filtered = filtered.map(d => {
        const newData = { timestamp: d.timestamp };
        filters.carriers.forEach(carrier => {
          if (d[carrier]) newData[carrier] = d[carrier];
        });
        if (filters.showLoad && d.load) newData.load = d.load;
        return newData;
      });
    }

    return filtered;
  }, [data, filters]);

  const getCarrierColor = (carrier) => {
    // A simple color mapping function
    const colors = {
      'solar': '#FFD700',
      'wind': '#ADD8E6',
      'hydro': '#0000FF',
      'gas': '#FFA500',
      'coal': '#A9A9A9',
      'load': '#000000',
    };
    return colors[carrier] || '#8884d8';
  };

  return (
    <div className="space-y-4">
      <div id="dispatch-chart" className="bg-white p-4 rounded-lg shadow">
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={filteredData} ref={chartRef}>
            <XAxis dataKey="timestamp" />
            <YAxis label={{ value: 'Power (MW)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />

            {/* Dynamic series based on filters */}
            {availability?.available_carriers
              ?.filter(c => (filters.carriers && filters.carriers.length === 0) || (filters.carriers && filters.carriers.includes(c)))
              .map((carrier, idx) => (
                <Area
                  key={carrier}
                  type="monotone"
                  dataKey={carrier}
                  stackId="1"
                  fill={getCarrierColor(carrier)}
                  stroke={getCarrierColor(carrier)}
                />
              ))}

            {filters.showLoad !== false && (
              <Line
                type="monotone"
                dataKey="load"
                stroke="#000"
                strokeWidth={2}
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <ExportButton data={filteredData} filename="dispatch_data" chartRef={chartRef} />
      </div>
    </div>
  );
};

export default DispatchChart;
