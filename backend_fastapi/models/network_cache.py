"""
Network Caching Layer
=====================

Implements an in-memory cache for PyPSA networks to avoid repeatedly
loading large .nc files. This significantly improves API response times
for subsequent requests to the same network file.

Features:
- LRU (Least Recently Used) cache eviction
- Configurable cache size and TTL
- Thread-safe operations
- Cache statistics tracking
- Manual cache invalidation

Author: KSEB Analytics Team
Date: 2025-10-30
"""

import pypsa
import time
import threading
from typing import Dict, Optional, Tuple
from pathlib import Path
from collections import OrderedDict
import logging

logger = logging.getLogger(__name__)


class NetworkCache:
    """
    Thread-safe LRU cache for PyPSA networks.

    This cache stores loaded network objects in memory to avoid
    repeated file I/O operations which can be slow for large .nc files.
    """

    def __init__(self, max_size: int = 10, ttl_seconds: int = 300):
        """
        Initialize the network cache.

        Parameters
        ----------
        max_size : int, default=10
            Maximum number of networks to cache
        ttl_seconds : int, default=300 (5 minutes)
            Time-to-live for cached networks in seconds
        """
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds

        # Cache storage: {filepath: (network, timestamp)}
        self._cache: OrderedDict[str, Tuple[pypsa.Network, float]] = OrderedDict()

        # Thread lock for thread-safe operations
        self._lock = threading.Lock()

        # Statistics
        self._stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'invalidations': 0
        }

        logger.info(f"NetworkCache initialized: max_size={max_size}, ttl={ttl_seconds}s")

    def get(self, filepath: str) -> Optional[pypsa.Network]:
        """
        Get a network from cache if available and not expired.

        Parameters
        ----------
        filepath : str
            Path to network file

        Returns
        -------
        pypsa.Network or None
            Cached network if available and fresh, None otherwise
        """
        with self._lock:
            filepath_str = str(Path(filepath).resolve())

            if filepath_str not in self._cache:
                self._stats['misses'] += 1
                logger.debug(f"Cache MISS: {filepath_str}")
                return None

            # Check if expired
            network, timestamp = self._cache[filepath_str]
            age = time.time() - timestamp

            if age > self.ttl_seconds:
                # Expired, remove from cache
                del self._cache[filepath_str]
                self._stats['misses'] += 1
                logger.debug(f"Cache EXPIRED: {filepath_str} (age={age:.1f}s)")
                return None

            # Move to end (most recently used)
            self._cache.move_to_end(filepath_str)

            self._stats['hits'] += 1
            logger.debug(f"Cache HIT: {filepath_str}")

            return network

    def put(self, filepath: str, network: pypsa.Network):
        """
        Add a network to the cache.

        Parameters
        ----------
        filepath : str
            Path to network file
        network : pypsa.Network
            Network object to cache
        """
        with self._lock:
            filepath_str = str(Path(filepath).resolve())

            # Remove oldest if at capacity
            if filepath_str not in self._cache and len(self._cache) >= self.max_size:
                # Remove oldest (first item)
                oldest_key = next(iter(self._cache))
                del self._cache[oldest_key]
                self._stats['evictions'] += 1
                logger.debug(f"Cache EVICTED: {oldest_key}")

            # Add/update cache entry
            self._cache[filepath_str] = (network, time.time())

            # Move to end (most recently used)
            if len(self._cache) > 1:
                self._cache.move_to_end(filepath_str)

            logger.debug(f"Cache PUT: {filepath_str}")

    def invalidate(self, filepath: Optional[str] = None):
        """
        Invalidate cache entry or entire cache.

        Parameters
        ----------
        filepath : str, optional
            Specific file to invalidate. If None, clears entire cache.
        """
        with self._lock:
            if filepath is None:
                # Clear entire cache
                count = len(self._cache)
                self._cache.clear()
                self._stats['invalidations'] += count
                logger.info(f"Cache CLEARED: {count} entries removed")
            else:
                filepath_str = str(Path(filepath).resolve())
                if filepath_str in self._cache:
                    del self._cache[filepath_str]
                    self._stats['invalidations'] += 1
                    logger.info(f"Cache INVALIDATED: {filepath_str}")

    def get_stats(self) -> Dict:
        """
        Get cache statistics.

        Returns
        -------
        dict
            Cache statistics including hits, misses, hit rate, etc.
        """
        with self._lock:
            total_requests = self._stats['hits'] + self._stats['misses']
            hit_rate = (self._stats['hits'] / total_requests * 100) if total_requests > 0 else 0

            return {
                'size': len(self._cache),
                'max_size': self.max_size,
                'ttl_seconds': self.ttl_seconds,
                'hits': self._stats['hits'],
                'misses': self._stats['misses'],
                'hit_rate_percent': round(hit_rate, 2),
                'evictions': self._stats['evictions'],
                'invalidations': self._stats['invalidations'],
                'total_requests': total_requests
            }

    def get_cached_files(self) -> list:
        """
        Get list of currently cached files.

        Returns
        -------
        list
            List of cached file paths with age
        """
        with self._lock:
            current_time = time.time()
            cached_files = []

            for filepath, (_, timestamp) in self._cache.items():
                age = current_time - timestamp
                cached_files.append({
                    'filepath': filepath,
                    'age_seconds': round(age, 1),
                    'expires_in_seconds': round(self.ttl_seconds - age, 1)
                })

            return cached_files


# Global cache instance
# Can be configured via environment variables or config file
_global_cache = NetworkCache(max_size=10, ttl_seconds=300)


def get_network_cache() -> NetworkCache:
    """Get the global network cache instance."""
    return _global_cache


def load_network_cached(filepath: str) -> pypsa.Network:
    """
    Load a PyPSA network with caching.

    This function first checks the cache. If not found or expired,
    it loads from file and caches the result.

    Parameters
    ----------
    filepath : str
        Path to .nc network file

    Returns
    -------
    pypsa.Network
        Loaded network object

    Raises
    ------
    FileNotFoundError
        If network file doesn't exist
    ValueError
        If file format is not supported
    """
    cache = get_network_cache()

    # Try to get from cache
    network = cache.get(filepath)

    if network is not None:
        return network

    # Not in cache, load from file
    filepath = Path(filepath)

    if not filepath.exists():
        raise FileNotFoundError(f"Network file not found: {filepath}")

    if filepath.suffix != '.nc':
        raise ValueError(f"Only .nc files supported, got: {filepath.suffix}")

    logger.info(f"Loading network from file: {filepath}")
    start_time = time.time()

    network = pypsa.Network(filepath.as_posix())

    load_time = time.time() - start_time
    logger.info(f"Network loaded in {load_time:.2f}s: {filepath}")

    # Add to cache
    cache.put(str(filepath), network)

    return network


def invalidate_network_cache(filepath: Optional[str] = None):
    """
    Invalidate network cache.

    Parameters
    ----------
    filepath : str, optional
        Specific file to invalidate. If None, clears entire cache.
    """
    cache = get_network_cache()
    cache.invalidate(filepath)


def get_cache_stats() -> Dict:
    """Get cache statistics."""
    cache = get_network_cache()
    return cache.get_stats()
