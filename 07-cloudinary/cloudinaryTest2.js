require('dotenv').config(); // Loads .env variables

const cloudinary = require('cloudinary').v2;

cloudinary.api.resources({
  type: 'upload',
  max_results: 10
}, function(error, result) {
  if (error) {
    console.error('Error:', error);
  } else if (result.resources.length > 0) {
    console.log('Found', result.resources.length, 'resources:');
    result.resources.forEach(asset => {
      console.log('URL:', asset.secure_url);
      console.log('Public ID:', asset.public_id);
      console.log('---');
    });
  } else {
    console.log('No resources found');
  }
});
