require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Get the prefix from command line arguments
const prefix = process.argv[2];
const processFile = process.argv[3]; // Optional: process existing txt file

// Function to process txt file and generate markdown
function processTxtToMarkdown(txtFile) {
  if (!fs.existsSync(txtFile)) {
    console.error(`Error: '${txtFile}' is not a valid file.`);
    process.exit(1);
  }

  const content = fs.readFileSync(txtFile, 'utf8');
  const lines = content.split('\n').filter(line => line.trim() && line.startsWith('http'));
  
  if (lines.length === 0) {
    console.log(`No valid URLs found in '${txtFile}'`);
    return;
  }

  const markdownLinks = lines.map(url => {
    const filename = path.basename(url);
    return `![${filename}](${url}) ${filename}: `;
  }).join('');

  console.log(`Generated Markdown links from '${txtFile}':`);
  console.log('=========================================');
  console.log(markdownLinks);
  console.log('=========================================');
  
  // Copy to clipboard (macOS)
  try {
    execSync(`echo -n '${markdownLinks.replace(/'/g, "'\\''")}' | pbcopy`);
    console.log('Markdown links copied to clipboard');
  } catch (error) {
    console.error('Failed to copy to clipboard:', error.message);
  }
}

// If second argument is provided, process that txt file instead of searching
if (processFile) {
  processTxtToMarkdown(processFile);
  process.exit(0);
}

if (!prefix) {
  console.error('Usage: node cloudinaryPrefixSearch.js "prefix" [txt-file]');
  console.error('Examples:');
  console.error('  node cloudinaryPrefixSearch.js "Screenshot"           # Search and save URLs');
  console.error('  node cloudinaryPrefixSearch.js "" "output.txt"        # Process existing txt file to markdown');
  process.exit(1);
}

console.log(`Searching for resources with prefix: "${prefix}"`);

cloudinary.api.resources({
  type: 'upload',
  prefix: prefix,
  max_results: 100
}, function(error, result) {
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  } else {
    if (result.resources.length === 0) {
      console.log('No resources found with that prefix');
      fs.writeFileSync('output.txt', 'No resources found with that prefix\n');
    } else {
      console.log(`Found ${result.resources.length} resource(s):`);
      console.log('');
      
      const urls = result.resources.map(asset => asset.secure_url);
      urls.forEach(url => console.log(url));
      
      // Save to output.txt (overwrites each time)
      fs.writeFileSync('output.txt', urls.join('\n') + '\n');
      console.log('Saved to output.txt');
      
      // Generate markdown format
      console.log('\nMarkdown format:');
      console.log('================');
      const markdownLinks = urls.map(url => {
        const filename = path.basename(url);
        return `![${filename}](${url})\n${filename}: `;
      }).join('\n');
      
      console.log(markdownLinks);
      console.log('================');
      
      // Copy markdown to clipboard
      try {
        execSync(`echo -n '${markdownLinks.replace(/'/g, "'\\''")}' | pbcopy`);
        console.log('Markdown links copied to clipboard');
      } catch (error) {
        console.error('Failed to copy to clipboard:', error.message);
      }
    }
  }
});