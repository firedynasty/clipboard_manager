require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Function to list resources by folder/prefix
function listResourcesByPrefix(prefix) {
  console.log(`\n=== Searching for prefix: "${prefix}" ===`);
  
  cloudinary.api.resources({
    type: 'upload',
    prefix: prefix,
    max_results: 50
  }, function(error, result) {
    if (error) {
      console.error('Error:', error);
    } else {
      console.log(`Found ${result.resources.length} resources:`);
      result.resources.forEach(asset => {
        console.log('Public ID:', asset.public_id);
        console.log('URL:', asset.secure_url);
        console.log('---');
      });
    }
  });
}

// Test different folder structures
listResourcesByPrefix('Screenshot');  // Screenshots
listResourcesByPrefix('image');       // Images with "image" prefix
listResourcesByPrefix('2025');        // Files starting with 2025
listResourcesByPrefix('main');        // Files starting with main

// You can also use nested folders like:
// listResourcesByPrefix('folder1/subfolder');
// listResourcesByPrefix('uploads/images');