// Offline cache manager with 48-hour validity
const CACHE_DURATION = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
const CACHE_KEY_PREFIX = 'pos-offline-cache-';

interface CacheData<T> {
  data: T;
  timestamp: number;
  userId: string;
}

// Get user-specific cache key
const getCacheKey = (key: string, userId: string) => `${CACHE_KEY_PREFIX}${userId}-${key}`;

// Check if cache is still valid (within 48 hours)
export const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_DURATION;
};

// Get remaining cache time in hours
export const getCacheRemainingHours = (timestamp: number): number => {
  const remaining = CACHE_DURATION - (Date.now() - timestamp);
  return Math.max(0, Math.round(remaining / (60 * 60 * 1000)));
};

// Save data to cache
export const saveToCache = <T>(key: string, data: T, userId: string): void => {
  try {
    const cacheData: CacheData<T> = {
      data,
      timestamp: Date.now(),
      userId,
    };
    localStorage.setItem(getCacheKey(key, userId), JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to save to cache:', error);
  }
};

// Load data from cache
export const loadFromCache = <T>(key: string, userId: string): { data: T; isValid: boolean; remainingHours: number } | null => {
  try {
    const cached = localStorage.getItem(getCacheKey(key, userId));
    if (!cached) return null;

    const cacheData: CacheData<T> = JSON.parse(cached);
    
    // Verify this cache belongs to the current user
    if (cacheData.userId !== userId) {
      return null;
    }

    return {
      data: cacheData.data,
      isValid: isCacheValid(cacheData.timestamp),
      remainingHours: getCacheRemainingHours(cacheData.timestamp),
    };
  } catch (error) {
    console.warn('Failed to load from cache:', error);
    return null;
  }
};

// Clear cache for a specific user
export const clearUserCache = (userId: string): void => {
  try {
    const keys = ['categories', 'menuItems', 'orders', 'brandSettings', 'lastSync'];
    keys.forEach(key => {
      localStorage.removeItem(getCacheKey(key, userId));
    });
  } catch (error) {
    console.warn('Failed to clear cache:', error);
  }
};

// Check if we're online
export const isOnline = (): boolean => {
  return navigator.onLine;
};

// Get last sync timestamp
export const getLastSyncTime = (userId: string): number | null => {
  const cached = loadFromCache<number>('lastSync', userId);
  return cached?.data || null;
};

// Save last sync timestamp
export const setLastSyncTime = (userId: string): void => {
  saveToCache('lastSync', Date.now(), userId);
};

// Check if sync is required (cache expired or never synced)
export const isSyncRequired = (userId: string): boolean => {
  const lastSync = getLastSyncTime(userId);
  if (!lastSync) return true;
  return !isCacheValid(lastSync);
};
