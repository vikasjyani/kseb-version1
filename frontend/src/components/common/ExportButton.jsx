// File: frontend/src/components/common/ExportButton.jsx

import React from 'react';
import { Download, Image } from 'lucide-react';
import { convertToCSV, downloadFile, exportChartAsImage, exportAsJSON } from '../../utils/exportUtils';

const ExportButton = ({ data, filename, chartRef }) => {
  const handleExport = (format) => {
    if (format === 'csv') {
      const csv = convertToCSV(data);
      downloadFile(csv, `${filename}.csv`, 'text/csv');
    } else if (format === 'json') {
      exportAsJSON(data, `${filename}.json`);
    } else if (format === 'png') {
      if (chartRef && chartRef.current) {
        exportChartAsImage(chartRef.current.container, `${filename}.png`);
      } else {
        console.error("Chart reference is not available for PNG export.");
      }
    }
  };

  return (
    <div className="flex gap-2">
      <button onClick={() => handleExport('csv')} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm flex items-center justify-center gap-2">
        <Download className="w-4 h-4" />
        Export CSV
      </button>
      <button onClick={() => handleExport('png')} className="px-3 py-2 bg-green-600 text-white rounded-md text-sm flex items-center justify-center gap-2">
        <Image className="w-4 h-4" />
        Export PNG
      </button>
    </div>
  );
};

export default ExportButton;
