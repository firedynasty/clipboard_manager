require('dotenv').config(); // Loads .env variables

const cloudinary = require('cloudinary').v2;

// List all resources to see what's available
cloudinary.api.resources(
  { type: 'upload', max_results: 10 },
  function(error, result) {
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Found', result.resources.length, 'resources:');
      result.resources.forEach(asset => {
        console.log('Public ID:', asset.public_id);
        console.log('URL:', asset.secure_url);
        console.log('---');
      });
    }
  }
);

