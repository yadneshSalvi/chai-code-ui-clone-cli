/**
 * Tools Index - Central hub for all file and system operation tools
 * 
 * This module provides a unified interface to all the tools in the toolkit:
 * - File operations (read, write, search, replace)
 * - Directory operations (list, glob search)
 * - System operations (shell commands)
 * - Utility functions (file stats, formatting)
 * 
 * Usage:
 *   import tools from './tools/index.js';
 *   const content = await tools.fileOps.read('file.txt');
 *   const files = await tools.dirOps.glob('**\/*.js');
 */

// Import ES6 modules
import { glob, globWithStats, formatFileSize, getFileStats } from './glob_files.js';
import { listDirectory, formatFileSize as formatFileSizeFromListDir, formatDate } from './list_directory.js';

// Import ES6 module (read_write_search_file.js)
import { 
  read_file, 
  search_file_content, 
  replace, 
  write_file, 
  read_many_files,
  fileExists,
  formatFileSize as formatFileSizeFromFile
} from './read_write_search_file.js';

import { run_shell_command } from './run_shell_command.js';

// File system operations
export {
  read_file,
  write_file,
  read_many_files,
  fileExists
};

// File search and manipulation
export {
  search_file_content,
  replace,
  glob,
  globWithStats
};

// Utility functions
export {
  formatFileSize,
  formatFileSizeFromFile,
  getFileStats
};

// Directory operations
export {
  listDirectory,
  formatDate
};

// Shell operations
export {
  run_shell_command
};

// Default export with all tools organized by category
export default {
  // File Operations - Enhanced file I/O with robust error handling
  fileOps: {
    read: read_file,              // Read single file with stats
    write: write_file,            // Write file with backup options
    readMany: read_many_files,    // Read multiple files with progress
    search: search_file_content,  // Search patterns with context
    replace: replace,             // Replace text with backup/dry-run
    exists: fileExists            // Check file existence
  },
  
  // Directory Operations - File system navigation and search
  dirOps: {
    list: listDirectory,          // List directory contents with advanced options
    glob: glob,                   // Find files by pattern
    globWithStats: globWithStats  // Find files with detailed stats
  },
  
  // System Operations - Shell command execution
  system: {
    runCommand: run_shell_command // Execute shell commands safely
  },
  
  // Utility Functions - Helper functions for file operations
  utils: {
    formatFileSize: formatFileSize,           // Format file sizes (from glob_files)
    formatFileSizeEnhanced: formatFileSizeFromFile, // Enhanced file size formatting
    formatFileSizeFromListDir: formatFileSizeFromListDir, // File size formatting from list_directory
    formatDate: formatDate,                   // Format dates for display
    getFileStats: getFileStats                // Get detailed file statistics
  }
};