/**
 * Shared bucket loading utility
 * Used by multiple components to load and select buckets consistently
 */

/**
 * Load buckets from API and return preferred bucket name
 * @returns {Promise<{buckets: Array, preferredBucket: string}>}
 */
export async function loadBucketsFromApi() {
  try {
    const response = await fetch('/api/buckets');
    const data = await response.json();
    
    if (data.success && data.buckets.length > 0) {
      const preferredBucket = data.buckets.find(b => b.name === 'n8n.cloud')?.name 
        || data.buckets[0]?.name 
        || data.default;
      
      return {
        buckets: data.buckets,
        preferredBucket: preferredBucket || 'files'
      };
    }
    
    return {
      buckets: [],
      preferredBucket: data.default || 'files'
    };
  } catch (error) {
    console.error('Error loading buckets:', error);
    return {
      buckets: [],
      preferredBucket: 'files'
    };
  }
}
