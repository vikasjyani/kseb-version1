// File: frontend/src/utils/exportUtils.js

import Papa from 'papaparse';
import html2canvas from 'html2canvas';

/**
 * Convert data array to CSV string
 */
export const convertToCSV = (data) => {
  return Papa.unparse(data);
};

/**
 * Download file to user's computer
 */
export const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export chart as PNG image
 */
export const exportChartAsImage = async (elementId, filename) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id "${elementId}" not found`);
    return;
  }

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2  // Higher quality
  });

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  });
};

/**
 * Export data as JSON
 */
export const exportAsJSON = (data, filename) => {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, filename, 'application/json');
};
