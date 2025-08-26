require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const { glob } = require('glob');

// Get command line arguments
const folderPath = process.argv[2];
const cloudinaryFolder = process.argv[3] || '';

if (!folderPath) {
  console.error('Usage: node cloudinaryBatchUpload.js <local-folder> [cloudinary-folder]');
  console.error('Examples:');
  console.error('  node cloudinaryBatchUpload.js "./images"                                    # Upload all .png/.jpg to root');
  console.error('  node cloudinaryBatchUpload.js "./photos" "gallery"                         # Upload all .png/.jpg to gallery folder');
  console.error('  node cloudinaryBatchUpload.js "/path/to/images" "clipboard"                # Upload all .png/.jpg to clipboard folder');
  process.exit(1);
}

// Check if folder exists
if (!fs.existsSync(folderPath)) {
  console.error(`Folder not found: ${folderPath}`);
  process.exit(1);
}

// Find all .png and .jpg files
const patterns = [
  path.join(folderPath, '*.png'),
  path.join(folderPath, '*.PNG'),
  path.join(folderPath, '*.jpg'),
  path.join(folderPath, '*.JPG'),
  path.join(folderPath, '*.jpeg'),
  path.join(folderPath, '*.JPEG')
];

console.log(`Searching for .png and .jpg files in: ${folderPath}`);

// Use Promise.all to get all matching files
Promise.all(patterns.map(pattern => glob(pattern)))
  .then(results => {
    // Flatten the results array
    const files = results.flat();
    
    if (files.length === 0) {
      console.log('No .png or .jpg files found in the specified folder');
      process.exit(0);
    }

    console.log(`Found ${files.length} image files:`);
    files.forEach(file => console.log(`  - ${path.basename(file)}`));
    console.log('');

    if (cloudinaryFolder) {
      console.log(`Uploading to Cloudinary folder: ${cloudinaryFolder}`);
    } else {
      console.log('Uploading to root (no folder)');
    }
    console.log('');

    // Upload each file
    let completed = 0;
    let successful = 0;
    let failed = 0;

    files.forEach((filePath, index) => {
      const uploadOptions = {
        resource_type: 'auto',
        use_filename: true,
        unique_filename: false,
      };

      // Set folder if specified
      if (cloudinaryFolder) {
        uploadOptions.folder = cloudinaryFolder;
      }

      console.log(`[${index + 1}/${files.length}] Uploading: ${path.basename(filePath)}`);

      cloudinary.uploader.upload(filePath, uploadOptions, function(error, result) {
        completed++;
        
        if (error) {
          failed++;
          console.error(`❌ Failed: ${path.basename(filePath)} - ${error.message}`);
        } else {
          successful++;
          console.log(`✅ Success: ${result.public_id} - ${result.secure_url}`);
        }

        // Show summary when all uploads are done
        if (completed === files.length) {
          console.log('\n' + '='.repeat(50));
          console.log('UPLOAD SUMMARY');
          console.log('='.repeat(50));
          console.log(`Total files: ${files.length}`);
          console.log(`Successful: ${successful}`);
          console.log(`Failed: ${failed}`);
          console.log('='.repeat(50));
        }
      });
    });
  })
  .catch(err => {
    console.error('Error finding files:', err);
    process.exit(1);
  });