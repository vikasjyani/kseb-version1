import React, { useRef, useEffect, useState } from 'react';
import { Maximize2, Minimize2, Download, RefreshCw, AlertCircle } from 'lucide-react';

const PlotViewer = ({ plotHtml, plotType, loading, error, onRefresh }) => {
  const iframeRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(700);

  useEffect(() => {
    // Adjust iframe height based on content
    const iframe = iframeRef.current;
    if (iframe && plotHtml) {
      try {
        // Give iframe time to load
        setTimeout(() => {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          if (iframeDoc.body) {
            const height = iframeDoc.body.scrollHeight;
            setIframeHeight(Math.max(height, 700));
          }
        }, 500);
      } catch (e) {
        // Cross-origin or other errors - use default height
        console.warn('Could not access iframe content:', e);
      }
    }
  }, [plotHtml]);

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleDownloadHtml = () => {
    if (!plotHtml) return;

    const blob = new Blob([plotHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pypsa_${plotType}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px] bg-slate-50">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Generating visualization...</p>
          <p className="text-sm text-slate-500 mt-2">This may take a few moments</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px] bg-red-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error Generating Plot</h3>
          <p className="text-red-700 mb-4">{error}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!plotHtml) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px] bg-slate-50">
        <div className="text-center max-w-md">
          <BarChart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Plot Selected</h3>
          <p className="text-slate-500">
            Select a visualization type from the sidebar and configure filters to generate a plot.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <div>
          <h3 className="font-semibold text-slate-800">
            {plotType ? plotType.charAt(0).toUpperCase() + plotType.slice(1).replace('_', ' ') : 'Visualization'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadHtml}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            title="Download HTML"
          >
            <Download className="w-5 h-5" />
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleFullscreen}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Plot Content */}
      <div className="flex-1 overflow-auto bg-white">
        <iframe
          ref={iframeRef}
          srcDoc={plotHtml}
          className="w-full border-0"
          style={{ height: isFullscreen ? '100%' : `${iframeHeight}px` }}
          title="PyPSA Visualization"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      {/* Info Footer */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
        <div className="flex items-center justify-between">
          <span>Interactive Plotly visualization - Use mouse to zoom, pan, and explore</span>
          <span className="text-slate-400">Powered by Plotly</span>
        </div>
      </div>
    </div>
  );
};

// Import missing icon
import { BarChart } from 'lucide-react';

export default PlotViewer;
