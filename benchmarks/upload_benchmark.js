
const { performance } = require('perf_hooks');

// Mock implementation of listFiles from utils/storageOperations.js
async function listFiles(supabase, bucketName, folderPath = '', limit = 1000) {
  try {
    const allFiles = [];
    let offset = 0;
    const batchSize = 100;

    while (offset < limit) {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(folderPath, {
          limit: Math.min(batchSize, limit - offset),
          offset: offset,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) throw error;
      if (!data || data.length === 0) break;

      allFiles.push(...data);
      offset += data.length;

      if (data.length < batchSize) break;
    }

    return allFiles;
  } catch (error) {
    console.error('Error listing files:', error.message);
    throw error;
  }
}

// Copy of generateUniqueFileName from pages/api/upload.js
function generateUniqueFileName(fileName, existingFiles) {
  // Extract name and extension
  const lastDotIndex = fileName.lastIndexOf('.');
  const nameWithoutExt = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';

  // Check if the original filename exists
  if (!existingFiles.includes(fileName)) {
    return fileName;
  }

  // Try (2), (3), etc. until we find a unique name
  let counter = 2;
  let newFileName;
  do {
    newFileName = `${nameWithoutExt}(${counter})${extension}`;
    counter++;
  } while (existingFiles.includes(newFileName) && counter < 1000); // Safety limit

  return newFileName;
}

// Mock Supabase Client
const createMockSupabase = (totalFiles = 1000) => {
  const files = [];
  // Add conflicts at the beginning so listFiles finds them
  files.push({ name: 'test.txt', metadata: { size: 1024 } });
  files.push({ name: 'test(2).txt', metadata: { size: 1024 } });

  for (let i = 0; i < totalFiles; i++) {
    files.push({
      name: `file_${i}.txt`,
      metadata: { size: 1024 }
    });
  }

  return {
    storage: {
      from: (bucket) => ({
        list: async (path, options) => {
          // Simulate network latency
          await new Promise(resolve => setTimeout(resolve, 50));

          let result = [...files];

          // Apply search if present
          if (options && options.search) {
             result = result.filter(f => f.name.includes(options.search));
          }

          // Apply offset and limit
          const offset = options?.offset || 0;
          const limit = options?.limit || 100;

          return {
            data: result.slice(offset, offset + limit),
            error: null
          };
        }
      })
    }
  };
};

async function runBenchmark() {
  const bucketName = 'test-bucket';
  const targetFile = 'test.txt'; // This exists, should resolve to test(3).txt

  console.log('--- Setting up Benchmark ---');
  const mockSupabase = createMockSupabase(2000); // 2000 files in bucket

  // Method 1: Current Implementation
  console.log('\n--- Benchmarking Current Implementation ---');
  const start1 = performance.now();

  let result1;
  try {
    const existingFiles = await listFiles(mockSupabase, bucketName, '');
    const existingFileNames = existingFiles
      .filter(f => f.metadata !== null && f.metadata !== undefined)
      .map(f => f.name);
    result1 = generateUniqueFileName(targetFile, existingFileNames);
  } catch (error) {
    console.error(error);
  }

  const end1 = performance.now();
  console.log(`Result: ${result1}`);
  console.log(`Time: ${(end1 - start1).toFixed(2)} ms`);

  // Method 2: Optimized Implementation
  console.log('\n--- Benchmarking Optimized Implementation ---');
  const start2 = performance.now();

  let result2;
  try {
     // Optimized logic
     let fileName = targetFile;
     const lastDotIndex = fileName.lastIndexOf('.');
     const nameWithoutExt = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
     const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';

     // Helper to check existence
     const checkExists = async (name) => {
         const { data } = await mockSupabase.storage
             .from(bucketName)
             .list('', {
                 search: name,
                 limit: 1 // We only need to know if it exists
             });
         // Strict check because search is fuzzy
         return data && data.some(f => f.name === name);
     };

     if (await checkExists(fileName)) {
         let counter = 2;
         let newFileName;
         let found = false;
         while (!found && counter < 1000) {
             newFileName = `${nameWithoutExt}(${counter})${extension}`;
             const exists = await checkExists(newFileName);
             if (!exists) {
                 found = true;
                 fileName = newFileName;
             }
             counter++;
         }
         result2 = fileName;
     } else {
         result2 = fileName;
     }
  } catch (error) {
      console.error(error);
  }

  const end2 = performance.now();
  console.log(`Result: ${result2}`);
  console.log(`Time: ${(end2 - start2).toFixed(2)} ms`);

  console.log(`\nImprovement: ${((end1 - start1) / (end2 - start2)).toFixed(2)}x faster`);
}

runBenchmark();
