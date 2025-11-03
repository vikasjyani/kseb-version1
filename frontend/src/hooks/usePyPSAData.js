/**
 * Custom hook for fetching PyPSA analysis data
 *
 * Generic hook for fetching data from any PyPSA endpoint.
 * Handles loading states, errors, and automatic refetching.
 * Implements request queuing to prevent resource exhaustion.
 *
 * @param {string} endpoint - API endpoint (without /project prefix)
 * @param {object} params - Query parameters
 * @param {boolean} enabled - Whether to fetch data (default: true)
 * @returns {object} Data, loading state, error, and refetch function
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

// Global request queue to limit concurrent requests
const requestQueue = {
  queue: [],
  activeRequests: 0,
  maxConcurrent: 2, // Limit to 2 concurrent requests
  requestDelay: 100, // 100ms delay between requests

  async enqueue(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  },

  async processQueue() {
    // If we're at max concurrent requests or queue is empty, wait
    if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const { requestFn, resolve, reject } = this.queue.shift();
    this.activeRequests++;

    try {
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeRequests--;

      // Add delay before processing next request to prevent overwhelming server
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), this.requestDelay);
      }
    }
  }
};

const usePyPSAData = (endpoint, params = null, enabled = true) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const fetchData = useCallback(async () => {
    // Don't fetch if disabled or params are null
    if (!enabled || params === null) {
      setData(null);
      return;
    }

    // Validate required params
    const { projectPath, scenarioName, networkFile } = params;
    if (!projectPath || !scenarioName || !networkFile) {
      setData(null);
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      // Enqueue request to prevent overwhelming the server
      const result = await requestQueue.enqueue(async () => {
        const response = await axios.get(`/project${endpoint}`, {
          params: {
            projectPath,
            scenarioName,
            networkFile,
            ...params
          },
          signal: abortControllerRef.current.signal
        });
        return response;
      });

      if (result.data.success) {
        setData(result.data);
      } else {
        setError(result.data.message || 'Failed to fetch data');
        setData(null);
      }
    } catch (err) {
      // Ignore abort errors
      if (err.name === 'CanceledError' || err.message === 'canceled') {
        return;
      }

      console.error(`Error fetching ${endpoint}:`, err);
      setError(err.response?.data?.detail || err.message || 'Failed to fetch data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [endpoint, params, enabled]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchData();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
};

export default usePyPSAData;
