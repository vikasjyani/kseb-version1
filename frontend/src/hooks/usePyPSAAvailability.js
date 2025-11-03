/**
 * Custom hook for fetching PyPSA network availability
 *
 * Automatically fetches availability information for a given network file
 * and provides helper functions to check if specific analyses or visualizations
 * are available.
 *
 * @param {string} projectPath - Project root path
 * @param {string} scenarioName - Scenario name
 * @param {string} networkFile - Network file name (.nc)
 * @returns {object} Availability data and helper functions
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const usePyPSAAvailability = (projectPath, scenarioName, networkFile) => {
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAvailability = useCallback(async () => {
    // Don't fetch if required params are missing
    if (!projectPath || !scenarioName || !networkFile) {
      setAvailability(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get('/project/pypsa/availability', {
        params: {
          projectPath,
          scenarioName,
          networkFile
        }
      });

      if (response.data.success) {
        setAvailability(response.data.availability);
      } else {
        setError('Failed to fetch availability information');
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to fetch availability');
    } finally {
      setLoading(false);
    }
  }, [projectPath, scenarioName, networkFile]);

  // Fetch on mount and when params change
  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  /**
   * Check if a specific visualization can be shown
   * @param {string} visualizationName - Name of the visualization
   * @returns {boolean} True if visualization is available
   */
  const canShow = useCallback((visualizationName) => {
    return availability?.available_visualizations?.[visualizationName] || false;
  }, [availability]);

  /**
   * Check if a specific analysis can be performed
   * @param {string} analysisName - Name of the analysis
   * @returns {boolean} True if analysis is available
   */
  const canAnalyze = useCallback((analysisName) => {
    return availability?.available_analyses?.[analysisName] || false;
  }, [availability]);

  /**
   * Check if network has been solved (has optimal dispatch)
   * @returns {boolean} True if network is solved
   */
  const isSolved = useCallback(() => {
    return availability?.basic_info?.is_solved || false;
  }, [availability]);

  /**
   * Get network basic information
   * @returns {object} Basic network info
   */
  const getBasicInfo = useCallback(() => {
    return availability?.basic_info || {};
  }, [availability]);

  /**
   * Get available components
   * @returns {object} Components information
   */
  const getComponents = useCallback(() => {
    return availability?.components || {};
  }, [availability]);

  /**
   * Get time series information
   * @returns {object} Time series info
   */
  const getTimeSeriesInfo = useCallback(() => {
    return availability?.time_series || {};
  }, [availability]);

  /**
   * Get spatial/zonal information
   * @returns {object} Spatial info
   */
  const getSpatialInfo = useCallback(() => {
    return availability?.spatial_info || {};
  }, [availability]);

  return {
    availability,
    loading,
    error,
    canShow,
    canAnalyze,
    isSolved,
    getBasicInfo,
    getComponents,
    getTimeSeriesInfo,
    getSpatialInfo,
    refetch: fetchAvailability
  };
};

export default usePyPSAAvailability;
