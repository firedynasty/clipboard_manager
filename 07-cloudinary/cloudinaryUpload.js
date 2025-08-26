require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

// Get command line arguments
const filePath = process.argv[2];
const folderPath = process.argv[3] || ''; // Optional folder path

if (!filePath) {
  console.error('Usage: node cloudinaryUpload.js <file-path> [folder-path]');
  console.error('Examples:');
  console.error('  node cloudinaryUpload.js "sample.jpg"                    # Upload to root');
  console.error('  node cloudinaryUpload.js "sample.jpg" "test1"            # Upload to test1 folder');
  console.error('  node cloudinaryUpload.js "sample.jpg" "home/test1"       # Upload to home/test1 folder');
  console.error('  node cloudinaryUpload.js "image.png" ""                  # Upload to root (empty folder)');
  process.exit(1);
}

// Check if file exists
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

// Get filename without extension for public_id
const filename = path.basename(filePath, path.extname(filePath));

// Build public_id: folder/filename (or just filename if no folder)
const publicId = folderPath ? `${folderPath}/${filename}` : filename;

// Upload options
const uploadOptions = {
  resource_type: 'auto',
  use_filename: true,        // Use original filename
  unique_filename: false,    // Don't add random suffix
};

// Set folder if specified, otherwise upload to root
if (folderPath) {
  uploadOptions.folder = folderPath;
}

console.log(`Uploading: ${filePath}`);
if (folderPath) {
  console.log(`Folder: ${folderPath}`);
} else {
  console.log('Uploading to root (no folder)');
}

cloudinary.uploader.upload(filePath, uploadOptions, function(error, result) {
  if (error) {
    console.error('Upload failed:', error);
    process.exit(1);
  } else {
    console.log('Upload successful!');
    console.log('Public ID:', result.public_id);
    console.log('URL:', result.secure_url);
    console.log('Size:', result.bytes, 'bytes');
    console.log('Format:', result.format);
    if (result.width && result.height) {
      console.log('Dimensions:', `${result.width}x${result.height}`);
    }
  }
});