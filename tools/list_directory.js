#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { glob as globPattern } from 'glob';

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to format date
const formatDate = (date) => {
  return date.toISOString().replace('T', ' ').substring(0, 19);
};

// Main function to list directory contents
const listDirectory = async (dirPath, options = {}) => {
  const {
    recursive = false,
    showHidden = false,
    showStats = false,
    sortBy = 'name', // name, size, date
    sortOrder = 'asc', // asc, desc
    filter = null, // file extension filter like '.js', '.json'
    maxDepth = null,
    output = 'list' // list, json, table
  } = options;

  try {
    // Validate directory path
    const absolutePath = path.resolve(dirPath);
    
    // Check if directory exists
    try {
      const stat = await fs.stat(absolutePath);
      if (!stat.isDirectory()) {
        throw new Error(`Path '${dirPath}' is not a directory`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory '${dirPath}' does not exist`);
      }
      throw error;
    }
    
    console.log('📁 Listing directory:', absolutePath);
    console.log('⚙️  Settings:', { recursive, showHidden, showStats });
    
    let items = [];
    
    if (recursive) {
      const globOptions = { 
        cwd: absolutePath,
        dot: showHidden,
        mark: true,
        absolute: false
      };
      
      if (maxDepth !== null) {
        globOptions.maxDepth = maxDepth;
      }
      
      const pattern = '**/*';
      const foundItems = await globPattern(pattern, globOptions);
      
      for (const item of foundItems) {
        const fullPath = path.join(absolutePath, item);
        try {
          const stat = await fs.stat(fullPath);
          const itemInfo = {
            name: item,
            path: fullPath,
            relativePath: item,
            isDirectory: stat.isDirectory(),
            isFile: stat.isFile(),
            size: stat.size,
            modified: stat.mtime,
            created: stat.birthtime
          };
          
          // Apply filter if specified
          if (filter && itemInfo.isFile) {
            const ext = path.extname(item).toLowerCase();
            if (ext !== filter.toLowerCase()) {
              continue;
            }
          }
          
          items.push(itemInfo);
        } catch (error) {
          console.log(`⚠️  Warning: Could not access '${item}': ${error.message}`);
        }
      }
    } else {
      const dirItems = await fs.readdir(absolutePath, { withFileTypes: true });
      
      for (const item of dirItems) {
        // Skip hidden files if not requested
        if (!showHidden && item.name.startsWith('.')) {
          continue;
        }
        
        const fullPath = path.join(absolutePath, item.name);
        try {
          const stat = await fs.stat(fullPath);
          const itemInfo = {
            name: item.name,
            path: fullPath,
            relativePath: item.name,
            isDirectory: item.isDirectory(),
            isFile: item.isFile(),
            size: stat.size,
            modified: stat.mtime,
            created: stat.birthtime
          };
          
          // Apply filter if specified
          if (filter && itemInfo.isFile) {
            const ext = path.extname(item.name).toLowerCase();
            if (ext !== filter.toLowerCase()) {
              continue;
            }
          }
          
          items.push(itemInfo);
        } catch (error) {
          console.log(`⚠️  Warning: Could not access '${item.name}': ${error.message}`);
        }
      }
    }
    
    // Sort items
    items.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'date':
          comparison = a.modified.getTime() - b.modified.getTime();
          break;
        case 'name':
        default:
          comparison = a.name.localeCompare(b.name);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    // Separate files and directories
    const files = items.filter(item => item.isFile);
    const directories = items.filter(item => item.isDirectory);
    
    const result = {
      path: absolutePath,
      totalItems: items.length,
      filesCount: files.length,
      directoriesCount: directories.length,
      files: files,
      directories: directories,
      options: options
    };
    
    // Output results based on format
    if (output === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else if (output === 'table' && showStats) {
      console.log('\n📊 DIRECTORY CONTENTS:');
      console.log('='.repeat(80));
      console.log('Type'.padEnd(4) + ' | ' + 'Name'.padEnd(40) + ' | ' + 'Size'.padEnd(10) + ' | ' + 'Modified');
      console.log('-'.repeat(80));
      
      for (const item of items) {
        const type = item.isDirectory ? 'DIR' : 'FILE';
        const size = item.isDirectory ? '-' : formatFileSize(item.size);
        const name = item.name.length > 40 ? item.name.substring(0, 37) + '...' : item.name;
        const modified = formatDate(item.modified);
        
        console.log(type.padEnd(4) + ' | ' + name.padEnd(40) + ' | ' + size.padEnd(10) + ' | ' + modified);
      }
    } else {
      // Default list output
      console.log('\n📊 SUMMARY:');
      console.log('============');
      console.log(`📁 Total items: ${result.totalItems}`);
      console.log(`📄 Files: ${result.filesCount}`);
      console.log(`📂 Directories: ${result.directoriesCount}`);
      
      if (directories.length > 0) {
        console.log('\n📂 DIRECTORIES:');
        directories.forEach(dir => {
          const displayPath = recursive ? dir.relativePath : dir.name;
          if (showStats) {
            console.log(`   📂 ${displayPath} (modified: ${formatDate(dir.modified)})`);
          } else {
            console.log(`   📂 ${displayPath}`);
          }
        });
      }
      
      if (files.length > 0) {
        console.log('\n📄 FILES:');
        files.forEach(file => {
          const displayPath = recursive ? file.relativePath : file.name;
          if (showStats) {
            console.log(`   📄 ${displayPath} (${formatFileSize(file.size)}, modified: ${formatDate(file.modified)})`);
          } else {
            console.log(`   📄 ${displayPath}`);
          }
        });
      }
    }
    
    return result;
    
  } catch (error) {
    throw new Error(`Failed to list directory '${dirPath}': ${error.message}`);
  }
};

// CLI functionality
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log('📁 Directory Listing Tool');
    console.log('==========================');
    console.log('Usage: node list_directory.js <directory> [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  directory           The directory path to list (default: current directory)');
    console.log('');
    console.log('Options:');
    console.log('  --recursive         List files and directories recursively');
    console.log('  --hidden            Include hidden files and directories (starting with .)');
    console.log('  --stats             Show file sizes and modification dates');
    console.log('  --sort=FIELD        Sort by: name, size, date (default: name)');
    console.log('  --order=ORDER       Sort order: asc, desc (default: asc)');
    console.log('  --filter=EXT        Filter files by extension (e.g., .js, .json)');
    console.log('  --max-depth=N       Maximum directory depth for recursive listing');
    console.log('  --output=FORMAT     Output format: list, json, table (default: list)');
    console.log('  --help              Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node list_directory.js');
    console.log('  node list_directory.js ./src --recursive --stats');
    console.log('  node list_directory.js . --filter=.js --sort=size --order=desc');
    console.log('  node list_directory.js /path/to/dir --hidden --output=json');
    console.log('  node list_directory.js ./project --recursive --max-depth=3 --output=table');
    process.exit(0);
  }
  
  const dirPath = args.find(arg => !arg.startsWith('--')) || '.';
  
  // Parse options
  const options = {};
  args.forEach(arg => {
    if (arg === '--recursive') {
      options.recursive = true;
    } else if (arg === '--hidden') {
      options.showHidden = true;
    } else if (arg === '--stats') {
      options.showStats = true;
    } else if (arg.startsWith('--sort=')) {
      const sortBy = arg.split('=')[1];
      if (['name', 'size', 'date'].includes(sortBy)) {
        options.sortBy = sortBy;
      } else {
        console.log(`❌ Invalid sort field: ${sortBy}`);
        console.log('Valid options: name, size, date');
        process.exit(1);
      }
    } else if (arg.startsWith('--order=')) {
      const sortOrder = arg.split('=')[1];
      if (['asc', 'desc'].includes(sortOrder)) {
        options.sortOrder = sortOrder;
      } else {
        console.log(`❌ Invalid sort order: ${sortOrder}`);
        console.log('Valid options: asc, desc');
        process.exit(1);
      }
    } else if (arg.startsWith('--filter=')) {
      options.filter = arg.split('=')[1];
    } else if (arg.startsWith('--max-depth=')) {
      const depth = parseInt(arg.split('=')[1]);
      if (isNaN(depth) || depth < 1) {
        console.log(`❌ Invalid max-depth: ${arg.split('=')[1]}`);
        console.log('Max depth must be a positive integer');
        process.exit(1);
      }
      options.maxDepth = depth;
    } else if (arg.startsWith('--output=')) {
      const output = arg.split('=')[1];
      if (['list', 'json', 'table'].includes(output)) {
        options.output = output;
      } else {
        console.log(`❌ Invalid output format: ${output}`);
        console.log('Valid options: list, json, table');
        process.exit(1);
      }
    }
  });
  
  try {
    const result = await listDirectory(dirPath, options);
  } catch (error) {
    console.error('❌ Error listing directory:', error.message);
    
    console.log('\n💡 Troubleshooting tips:');
    console.log('   • Check if the directory path exists and is accessible');
    console.log('   • Ensure you have read permissions for the directory');
    console.log('   • Try using absolute path instead of relative path');
    console.log('   • Use --help for usage information');
    
    process.exit(1);
  }
};

// Export the function for use in other modules
export { 
  listDirectory,
  formatFileSize,
  formatDate
};

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('list_directory.js')) {
  main();
}