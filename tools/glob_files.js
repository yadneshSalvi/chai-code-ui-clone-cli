#!/usr/bin/env node

import { glob as globPattern } from 'glob';
import path from 'path';
import fs from 'fs';

export async function glob(pattern, options = {}) {
  try {
    const {
      cwd = process.cwd(),
      ignore = ['node_modules/**', '.git/**', '.vscode/**', '.idea/**', '*.log'],
      dot = false,
      absolute = true,
      maxDepth = undefined,
      caseSensitive = true,
      quiet = false
    } = options;
    
    // Validate pattern
    if (!pattern || typeof pattern !== 'string') {
      throw new Error('Pattern must be a non-empty string');
    }
    
    // Validate cwd exists
    if (!fs.existsSync(cwd)) {
      throw new Error(`Working directory does not exist: ${cwd}`);
    }
    
    if (!quiet) {
      console.log(`🔍 Searching for pattern: ${pattern}`);
      console.log(`📁 Working directory: ${path.resolve(cwd)}`);
      console.log(`🚫 Ignoring: ${ignore.join(', ')}`);
    }
    
    const globOptions = {
      cwd,
      ignore,
      dot,
      absolute,
      nodir: false, // Include directories by default
      follow: false, // Don't follow symlinks for security
      caseSensitiveMatch: caseSensitive
    };
    
    // Add maxDepth if specified
    if (maxDepth !== undefined && Number.isInteger(maxDepth) && maxDepth > 0) {
      globOptions.maxDepth = maxDepth;
      if (!quiet) {
        console.log(`📏 Max depth: ${maxDepth}`);
      }
    }
    
    const files = await globPattern(pattern, globOptions);
    
    if (!quiet) {
      console.log(`✅ Found ${files.length} matches`);
    }
    
    return {
      pattern,
      matches: files,
      count: files.length,
      options: globOptions,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    throw new Error(`Failed to glob files: ${error.message}`);
  }
}

// Helper function to format file size
const formatFileSize = (bytes) => {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

// Helper function to get file stats
const getFileStats = async (filePath) => {
  try {
    const stats = await fs.promises.stat(filePath);
    return {
      size: stats.size,
      modified: stats.mtime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile()
    };
  } catch (error) {
    return null;
  }
};

// Enhanced glob with file information
export async function globWithStats(pattern, options = {}) {
  const result = await glob(pattern, options);
  
  if (!options.quiet) {
    console.log('📊 Gathering file statistics...');
  }
  
  const filesWithStats = await Promise.all(
    result.matches.map(async (filePath) => {
      const stats = await getFileStats(filePath);
      return {
        path: filePath,
        relativePath: path.relative(options.cwd || process.cwd(), filePath),
        stats
      };
    })
  );
  
  return {
    ...result,
    files: filesWithStats
  };
}

// CLI functionality
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('🔍 File Glob Search Tool');
    console.log('========================');
    console.log('Usage: node glob_files.js <pattern> [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  pattern             Glob pattern to search for files');
    console.log('                      Examples: "*.js", "**/*.json", "src/**/*.{ts,tsx}"');
    console.log('');
    console.log('Options:');
    console.log('  --cwd=PATH          Working directory to search from (default: current directory)');
    console.log('  --ignore=PATTERN    Additional patterns to ignore (can be used multiple times)');
    console.log('  --include-dot       Include hidden files/directories (starting with .)');
    console.log('  --relative          Show relative paths instead of absolute');
    console.log('  --max-depth=N       Maximum directory depth to search');
    console.log('  --case-insensitive  Case insensitive pattern matching');
    console.log('  --stats             Include file statistics (size, modified date)');
    console.log('  --output=FORMAT     Output format: list, json, table (default: list)');
    console.log('  --save=FILE         Save results to JSON file');
    console.log('  --help, -h          Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node glob_files.js "*.js"                    # Find all JS files');
    console.log('  node glob_files.js "**/*.{ts,tsx}" --stats   # Find TypeScript files with stats');
    console.log('  node glob_files.js "src/**" --relative       # Find all files in src/ with relative paths');
    console.log('  node glob_files.js "*.json" --cwd=./config   # Search in specific directory');
    console.log('  node glob_files.js "**/*.md" --max-depth=3   # Limit search depth');
    console.log('  node glob_files.js "**" --ignore="*.log" --ignore="temp/**"  # Multiple ignore patterns');
    console.log('');
    console.log('Default ignored patterns:');
    console.log('  node_modules/**, .git/**, .vscode/**, .idea/**, *.log');
    
    if (args.length === 0) {
      console.log('\n❌ Please provide a glob pattern to search for.');
      process.exit(1);
    }
    process.exit(0);
  }
  
  const pattern = args[0];
  
  // Parse options
  const options = {
    ignore: ['node_modules/**', '.git/**', '.vscode/**', '.idea/**', '*.log']
  };
  
  let outputFormat = 'list';
  let saveFile = null;
  let includeStats = false;
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--cwd=')) {
      options.cwd = arg.split('=')[1];
    } else if (arg.startsWith('--ignore=')) {
      options.ignore.push(arg.split('=')[1]);
    } else if (arg === '--include-dot') {
      options.dot = true;
    } else if (arg === '--relative') {
      options.absolute = false;
    } else if (arg.startsWith('--max-depth=')) {
      const depth = parseInt(arg.split('=')[1]);
      if (isNaN(depth) || depth <= 0) {
        console.log('❌ Invalid max-depth value. Must be a positive integer.');
        process.exit(1);
      }
      options.maxDepth = depth;
    } else if (arg === '--case-insensitive') {
      options.caseSensitive = false;
    } else if (arg === '--stats') {
      includeStats = true;
    } else if (arg.startsWith('--output=')) {
      outputFormat = arg.split('=')[1];
      if (!['list', 'json', 'table'].includes(outputFormat)) {
        console.log('❌ Invalid output format. Use: list, json, or table');
        process.exit(1);
      }
    } else if (arg.startsWith('--save=')) {
      saveFile = arg.split('=')[1];
    } else {
      console.log(`❌ Unknown option: ${arg}`);
      console.log('Use --help to see available options.');
      process.exit(1);
    }
  }
  
  // Validate pattern
  if (!pattern.trim()) {
    console.log('❌ Pattern cannot be empty.');
    process.exit(1);
  }
  
  try {
    const startTime = Date.now();
    
    // Set quiet mode for JSON output
    if (outputFormat === 'json') {
      options.quiet = true;
    }
    
    let result;
    if (includeStats) {
      result = await globWithStats(pattern, options);
    } else {
      result = await glob(pattern, options);
    }
    
    const duration = Date.now() - startTime;
    
    if (result.count === 0) {
      console.log('\nNo files found matching the pattern.');
      process.exit(0);
    }
    
    // Output results based on format
    if (outputFormat === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Display results header for non-JSON formats
      console.log('\n📋 SEARCH RESULTS:');
      console.log('==================');
      console.log(`⏱️  Search completed in ${duration}ms`);
      console.log(`📊 Found ${result.count} matches\n`);
      
      if (outputFormat === 'table' && includeStats) {
        console.log('📁 Path'.padEnd(50) + '📏 Size'.padEnd(12) + '📅 Modified');
        console.log('─'.repeat(75));
        
        result.files.forEach(file => {
          const size = file.stats ? formatFileSize(file.stats.size) : 'N/A';
          const modified = file.stats ? file.stats.modified.toLocaleDateString() : 'N/A';
          const displayPath = options.absolute === false ? file.relativePath : file.path;
          
          // Truncate long paths for better table formatting
          const truncatedPath = displayPath.length > 45 ? 
            '...' + displayPath.slice(-42) : displayPath;
          
          console.log(
            truncatedPath.padEnd(50) + 
            size.padEnd(12) + 
            modified
          );
        });
      } else {
        // Default list format
        const filesToShow = includeStats ? result.files : result.matches.map(path => ({ path }));
        
        filesToShow.forEach((file, index) => {
          const displayPath = options.absolute === false && file.relativePath ? file.relativePath : file.path;
          
          if (includeStats && file.stats) {
            const size = formatFileSize(file.stats.size);
            const type = file.stats.isDirectory ? '📁' : '📄';
            console.log(`${type} ${displayPath} (${size})`);
          } else {
            console.log(`📄 ${displayPath}`);
          }
        });
      }
    }
    
    // Save to file if requested
    if (saveFile) {
      try {
        await fs.promises.writeFile(saveFile, JSON.stringify(result, null, 2), 'utf8');
        console.log(`\n💾 Results saved to: ${path.resolve(saveFile)}`);
      } catch (error) {
        console.log(`\n⚠️  Error saving file: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Search failed:', error.message);
    
    console.log('\n💡 Troubleshooting tips:');
    console.log('   • Check if the pattern syntax is correct');
    console.log('   • Verify the working directory exists');
    console.log('   • Try a simpler pattern first (e.g., "*.txt")');
    console.log('   • Use quotes around complex patterns');
    
    process.exit(1);
  }
};

// Export functions for use in other modules
export { formatFileSize, getFileStats };

// Run CLI if this file is executed directly
const isMainModule = process.argv[1] && (
  import.meta.url.endsWith(process.argv[1]) || 
  process.argv[1].endsWith('glob_files.js')
);

if (isMainModule) {
  main();
}