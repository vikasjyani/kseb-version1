/**
 * Export Utilities for PyPSA Visualization Data
 * ==============================================
 *
 * Provides functions to export charts and data in various formats:
 * - CSV: For data analysis in Excel/Python
 * - JSON: For programmatic access
 * - PNG: For presentations and reports
 * - SVG: For high-quality vector graphics
 *
 * Dependencies:
 * - papaparse: CSV generation (install: npm install papaparse)
 * - html2canvas: Chart to image conversion (install: npm install html2canvas)
 *
 * Usage:
 * ```javascript
 * import { exportAsCSV, exportChartAsPNG } from '@/utils/exportUtils';
 *
 * // Export data as CSV
 * exportAsCSV(chartData, 'energy_mix_2024');
 *
 * // Export chart as PNG
 * exportChartAsPNG('chart-container', 'capacity_chart_2024');
 * ```
 */

/**
 * Convert array of objects to CSV string
 *
 * @param {Array<Object>} data - Array of data objects
 * @returns {string} CSV formatted string
 */
export const arrayToCSV = (data) => {
  if (!data || data.length === 0) {
    return '';
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV rows
  const rows = data.map(row =>
    headers.map(header => {
      const value = row[header];

      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }

      // Escape quotes and wrap in quotes if contains comma/newline
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    }).join(',')
  );

  // Combine headers and rows
  return [headers.join(','), ...rows].join('\n');
};

/**
 * Download file to user's computer
 *
 * @param {string} content - File content
 * @param {string} filename - Filename (without extension)
 * @param {string} mimeType - MIME type of file
 * @param {string} extension - File extension
 */
export const downloadFile = (content, filename, mimeType, extension) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export data as CSV file
 *
 * @param {Array<Object>} data - Array of data objects
 * @param {string} filename - Filename (without extension)
 */
export const exportAsCSV = (data, filename = 'export') => {
  const csv = arrayToCSV(data);
  downloadFile(csv, filename, 'text/csv', 'csv');
};

/**
 * Export data as JSON file
 *
 * @param {any} data - Data to export
 * @param {string} filename - Filename (without extension)
 * @param {boolean} pretty - Whether to pretty-print JSON (default: true)
 */
export const exportAsJSON = (data, filename = 'export', pretty = true) => {
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  downloadFile(json, filename, 'application/json', 'json');
};

/**
 * Export HTML element as PNG image
 *
 * This is a basic implementation. For production use, install html2canvas:
 * ```
 * npm install html2canvas
 * ```
 *
 * Then use:
 * ```javascript
 * import html2canvas from 'html2canvas';
 *
 * export const exportChartAsPNG = async (elementId, filename = 'chart') => {
 *   const element = document.getElementById(elementId);
 *   if (!element) {
 *     console.error(`Element with id "${elementId}" not found`);
 *     return;
 *   }
 *
 *   const canvas = await html2canvas(element, {
 *     backgroundColor: '#ffffff',
 *     scale: 2  // Higher quality
 *   });
 *
 *   canvas.toBlob((blob) => {
 *     const url = URL.createObjectURL(blob);
 *     const link = document.createElement('a');
 *     link.href = url;
 *     link.download = `${filename}.png`;
 *     link.click();
 *     URL.revokeObjectURL(url);
 *   });
 * };
 * ```
 *
 * @param {string} elementId - ID of element to export
 * @param {string} filename - Filename (without extension)
 */
export const exportChartAsPNG = async (elementId, filename = 'chart') => {
  console.warn('PNG export requires html2canvas package. Install it with: npm install html2canvas');
  console.log(`Attempted to export element "${elementId}" as "${filename}.png"`);

  // Fallback: Open element in new window for manual screenshot
  const element = document.getElementById(elementId);
  if (element) {
    const printWindow = window.open('', '', 'width=1200,height=800');
    printWindow.document.write(`
      <html>
        <head>
          <title>${filename}</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
          </style>
        </head>
        <body>
          ${element.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
};

/**
 * Copy data to clipboard
 *
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
};

/**
 * Export data as Excel-compatible CSV (UTF-8 BOM)
 *
 * Adds UTF-8 BOM for proper Excel import
 *
 * @param {Array<Object>} data - Array of data objects
 * @param {string} filename - Filename (without extension)
 */
export const exportAsExcelCSV = (data, filename = 'export') => {
  const csv = arrayToCSV(data);
  // Add UTF-8 BOM for Excel compatibility
  const csvWithBOM = '\uFEFF' + csv;
  downloadFile(csvWithBOM, filename, 'text/csv;charset=utf-8', 'csv');
};

/**
 * Format bytes to human-readable string
 *
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted string (e.g., "1.5 MB")
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Format milliseconds to human-readable duration
 *
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted duration (e.g., "2.5s", "1m 30s")
 */
export const formatDuration = (ms) => {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${(ms / 1000).toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

export default {
  arrayToCSV,
  downloadFile,
  exportAsCSV,
  exportAsJSON,
  exportChartAsPNG,
  exportAsExcelCSV,
  copyToClipboard,
  formatBytes,
  formatDuration
};
