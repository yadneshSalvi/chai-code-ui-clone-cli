#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

// Helper function to check if file exists
const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

async function read_file(filePath, encoding = 'utf8') {
  try {
    const absolutePath = path.resolve(filePath);
    
    if (!(await fileExists(absolutePath))) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    
    const content = await fs.readFile(absolutePath, encoding);
    const stats = await fs.stat(absolutePath);
    
    return {
      content,
      filePath: absolutePath,
      size: stats.size,
      modified: stats.mtime,
      encoding
    };
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
}

async function search_file_content(filePaths, pattern, options = {}) {
  const {
    caseSensitive = true,
    wholeWord = false,
    maxMatches = 100,
    showContext = false,
    contextLines = 2
  } = options;
  
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    let regex;
    
    if (wholeWord) {
      regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, flags);
    } else {
      regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    }
    
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    const results = [];
    const summary = {
      totalFiles: paths.length,
      filesWithMatches: 0,
      totalMatches: 0,
      errors: []
    };
    
    for (const filePath of paths) {
      try {
        const absolutePath = path.resolve(filePath);
        
        if (!(await fileExists(absolutePath))) {
          summary.errors.push(`File not found: ${absolutePath}`);
          continue;
        }
        
        const content = await fs.readFile(absolutePath, 'utf8');
        const lines = content.split('\n');
        let fileMatches = 0;
        
        lines.forEach((line, index) => {
          const matches = [...line.matchAll(regex)];
          matches.forEach(match => {
            if (results.length < maxMatches) {
              const result = {
                file: absolutePath,
                line: index + 1,
                content: line.trim(),
                match: match[0],
                position: match.index
              };
              
              if (showContext) {
                const start = Math.max(0, index - contextLines);
                const end = Math.min(lines.length, index + contextLines + 1);
                result.context = lines.slice(start, end).map((contextLine, contextIndex) => ({
                  line: start + contextIndex + 1,
                  content: contextLine,
                  isMatch: start + contextIndex === index
                }));
              }
              
              results.push(result);
              fileMatches++;
              summary.totalMatches++;
            }
          });
        });
        
        if (fileMatches > 0) {
          summary.filesWithMatches++;
        }
        
      } catch (error) {
        summary.errors.push(`Error reading ${filePath}: ${error.message}`);
      }
    }
    
    return { results, summary };
  } catch (error) {
    throw new Error(`Failed to search file content: ${error.message}`);
  }
}

async function replace(filePath, searchValue, replaceValue, options = {}) {
  const {
    backup = false,
    dryRun = false,
    caseSensitive = true,
    wholeWord = false
  } = options;
  
  try {
    const absolutePath = path.resolve(filePath);
    
    if (!(await fileExists(absolutePath))) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    
    const originalContent = await fs.readFile(absolutePath, 'utf8');
    const originalStats = await fs.stat(absolutePath);
    
    let newContent;
    let replacements = 0;
    
    if (searchValue instanceof RegExp) {
      const matches = originalContent.match(searchValue);
      replacements = matches ? matches.length : 0;
      newContent = originalContent.replace(searchValue, replaceValue);
    } else {
      let flags = 'g';
      if (!caseSensitive) flags += 'i';
      
      let pattern = searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (wholeWord) pattern = `\\b${pattern}\\b`;
      
      const regex = new RegExp(pattern, flags);
      const matches = originalContent.match(regex);
      replacements = matches ? matches.length : 0;
      newContent = originalContent.replace(regex, replaceValue);
    }
    
    if (!dryRun && replacements > 0) {
      if (backup) {
        const backupPath = `${absolutePath}.backup.${Date.now()}`;
        await fs.copyFile(absolutePath, backupPath);
        console.log(`📄 Backup created: ${backupPath}`);
      }
      await fs.writeFile(absolutePath, newContent, 'utf8');
    }
    
    const newStats = dryRun ? originalStats : await fs.stat(absolutePath);
    
    return {
      file: absolutePath,
      replacements,
      changed: replacements > 0,
      dryRun,
      originalSize: originalStats.size,
      newSize: newStats.size,
      sizeDifference: newStats.size - originalStats.size
    };
  } catch (error) {
    throw new Error(`Failed to replace content: ${error.message}`);
  }
}

async function write_file(filePath, content, options = {}) {
  const {
    encoding = 'utf8',
    createDirs = true,
    append = false,
    backup = false
  } = options;
  
  try {
    const absolutePath = path.resolve(filePath);
    const fileExisted = await fileExists(absolutePath);
    
    if (createDirs) {
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });
    }
    
    if (backup && fileExisted) {
      const backupPath = `${absolutePath}.backup.${Date.now()}`;
      await fs.copyFile(absolutePath, backupPath);
      console.log(`📄 Backup created: ${backupPath}`);
    }
    
    if (append) {
      await fs.appendFile(absolutePath, content, encoding);
    } else {
      await fs.writeFile(absolutePath, content, encoding);
    }
    
    const stats = await fs.stat(absolutePath);
    
    return {
      file: absolutePath,
      size: stats.size,
      formattedSize: formatFileSize(stats.size),
      created: new Date().toISOString(),
      operation: append ? 'appended' : (fileExisted ? 'overwritten' : 'created'),
      encoding
    };
  } catch (error) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
}

async function read_many_files(filePaths, options = {}) {
  const {
    encoding = 'utf8',
    continueOnError = true,
    showProgress = false
  } = options;
  
  const results = [];
  const summary = {
    total: filePaths.length,
    successful: 0,
    failed: 0,
    totalSize: 0
  };
  
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    
    if (showProgress) {
      console.log(`📖 Reading file ${i + 1}/${filePaths.length}: ${filePath}`);
    }
    
    try {
      const absolutePath = path.resolve(filePath);
      
      if (!(await fileExists(absolutePath))) {
        throw new Error(`File not found: ${absolutePath}`);
      }
      
      const content = await fs.readFile(absolutePath, encoding);
      const stats = await fs.stat(absolutePath);
      
      results.push({
        file: absolutePath,
        content,
        size: stats.size,
        formattedSize: formatFileSize(stats.size),
        modified: stats.mtime,
        success: true,
        encoding
      });
      
      summary.successful++;
      summary.totalSize += stats.size;
      
    } catch (error) {
      if (continueOnError) {
        results.push({
          file: path.resolve(filePath),
          error: error.message,
          success: false
        });
        summary.failed++;
      } else {
        throw new Error(`Failed to read file ${filePath}: ${error.message}`);
      }
    }
  }
  
  summary.formattedTotalSize = formatFileSize(summary.totalSize);
  
  return { results, summary };
}

// CLI functionality
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('📁 File Operations Tool');
    console.log('======================');
    console.log('A robust tool for reading, searching, and writing files with advanced options.');
    console.log('');
    console.log('Usage: node read_write_search_file.js <command> [arguments] [options]');
    console.log('');
    console.log('Commands:');
    console.log('  read <file>                           Read a single file');
    console.log('  read-many <file1> <file2> ...         Read multiple files');
    console.log('  search <pattern> <file1> [file2...]   Search for pattern in files');
    console.log('  replace <file> <search> <replace>     Replace text in file');
    console.log('  write <file> <content>                Write content to file');
    console.log('');
    console.log('Options:');
    console.log('  --encoding=<enc>          File encoding (default: utf8)');
    console.log('  --case-insensitive        Case insensitive search/replace');
    console.log('  --whole-word              Match whole words only');
    console.log('  --max-matches=<n>         Maximum search matches (default: 100)');
    console.log('  --context                 Show context lines in search results');
    console.log('  --context-lines=<n>       Number of context lines (default: 2)');
    console.log('  --backup                  Create backup before replace/write');
    console.log('  --dry-run                 Preview replace operation without changes');
    console.log('  --append                  Append to file instead of overwriting');
    console.log('  --create-dirs             Create directories if they don\'t exist');
    console.log('  --progress                Show progress for multi-file operations');
    console.log('  --continue-on-error       Continue processing other files on error');
    console.log('');
    console.log('Examples:');
    console.log('  node read_write_search_file.js read package.json');
    console.log('  node read_write_search_file.js search "console.log" src/*.js --context');
    console.log('  node read_write_search_file.js replace config.js "oldValue" "newValue" --backup');
    console.log('  node read_write_search_file.js write output.txt "Hello World" --create-dirs');
    console.log('  node read_write_search_file.js read-many *.json --progress');
    console.log('');
    console.log('Features:');
    console.log('  • Robust error handling with detailed messages');
    console.log('  • File existence checks and validation');
    console.log('  • Automatic backup creation with timestamps');
    console.log('  • Progress tracking for multi-file operations');
    console.log('  • Context display for search results');
    console.log('  • Dry-run mode for safe testing');
    console.log('  • Flexible encoding support');
    process.exit(args.length === 0 ? 1 : 0);
  }
  
  const command = args[0];
  const commandArgs = args.slice(1);
  
  // Parse options
  const options = {};
  const fileArgs = [];
  
  commandArgs.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      switch (key) {
        case 'encoding':
          options.encoding = value || 'utf8';
          break;
        case 'case-insensitive':
          options.caseSensitive = false;
          break;
        case 'whole-word':
          options.wholeWord = true;
          break;
        case 'max-matches':
          options.maxMatches = parseInt(value) || 100;
          break;
        case 'context':
          options.showContext = true;
          break;
        case 'context-lines':
          options.contextLines = parseInt(value) || 2;
          break;
        case 'backup':
          options.backup = true;
          break;
        case 'dry-run':
          options.dryRun = true;
          break;
        case 'append':
          options.append = true;
          break;
        case 'create-dirs':
          options.createDirs = true;
          break;
        case 'progress':
          options.showProgress = true;
          break;
        case 'continue-on-error':
          options.continueOnError = true;
          break;
        default:
          console.log(`⚠️  Unknown option: --${key}`);
      }
    } else {
      fileArgs.push(arg);
    }
  });
  
  try {
    switch (command) {
      case 'read':
        if (fileArgs.length === 0) {
          console.log('❌ Please provide a file path to read.');
          console.log('Usage: node read_write_search_file.js read <file> [options]');
          process.exit(1);
        }
        
        console.log(`📖 Reading file: ${fileArgs[0]}`);
        const readResult = await read_file(fileArgs[0], options.encoding);
        
        console.log('\n📊 READ SUMMARY:');
        console.log('================');
        console.log(`📄 File: ${readResult.filePath}`);
        console.log(`📏 Size: ${readResult.formattedSize || formatFileSize(readResult.size)}`);
        console.log(`📅 Modified: ${readResult.modified.toLocaleString()}`);
        console.log(`🔤 Encoding: ${readResult.encoding}`);
        console.log(`\n📄 Content:\n${readResult.content}`);
        break;
        
      case 'read-many':
        if (fileArgs.length === 0) {
          console.log('❌ Please provide file paths to read.');
          console.log('Usage: node read_write_search_file.js read-many <file1> <file2> ... [options]');
          process.exit(1);
        }
        
        console.log(`📖 Reading ${fileArgs.length} files...`);
        const readManyResult = await read_many_files(fileArgs, options);
        
        console.log('\n📊 READ MANY SUMMARY:');
        console.log('=====================');
        console.log(`📁 Total files: ${readManyResult.summary.total}`);
        console.log(`✅ Successful: ${readManyResult.summary.successful}`);
        console.log(`❌ Failed: ${readManyResult.summary.failed}`);
        console.log(`📏 Total size: ${readManyResult.summary.formattedTotalSize}`);
        
        readManyResult.results.forEach(result => {
          if (result.success) {
            console.log(`\n📄 ${result.file}`);
            console.log(`   Size: ${result.formattedSize}`);
            console.log(`   Modified: ${result.modified.toLocaleString()}`);
          } else {
            console.log(`\n❌ ${result.file}: ${result.error}`);
          }
        });
        break;
        
      case 'search':
        if (fileArgs.length < 2) {
          console.log('❌ Please provide a search pattern and at least one file.');
          console.log('Usage: node read_write_search_file.js search <pattern> <file1> [file2...] [options]');
          process.exit(1);
        }
        
        const pattern = fileArgs[0];
        const searchFiles = fileArgs.slice(1);
        
        console.log(`🔍 Searching for "${pattern}" in ${searchFiles.length} file(s)...`);
        const searchResult = await search_file_content(searchFiles, pattern, options);
        
        console.log('\n📊 SEARCH SUMMARY:');
        console.log('==================');
        console.log(`🔍 Pattern: "${pattern}"`);
        console.log(`📁 Files searched: ${searchResult.summary.totalFiles}`);
        console.log(`📄 Files with matches: ${searchResult.summary.filesWithMatches}`);
        console.log(`🎯 Total matches: ${searchResult.summary.totalMatches}`);
        
        if (searchResult.summary.errors.length > 0) {
          console.log(`❌ Errors: ${searchResult.summary.errors.length}`);
          searchResult.summary.errors.forEach(error => console.log(`   ${error}`));
        }
        
        console.log('\n🎯 MATCHES:');
        console.log('===========');
        searchResult.results.forEach(match => {
          console.log(`\n📄 ${path.basename(match.file)}:${match.line}`);
          console.log(`   ${match.content}`);
          console.log(`   ${''.padStart(match.position + 3, ' ')}${''.padStart(match.match.length, '^')}`);
          
          if (match.context) {
            console.log('   Context:');
            match.context.forEach(ctx => {
              const marker = ctx.isMatch ? '→' : ' ';
              console.log(`   ${marker} ${ctx.line}: ${ctx.content}`);
            });
          }
        });
        break;
        
      case 'replace':
        if (fileArgs.length < 3) {
          console.log('❌ Please provide file, search value, and replace value.');
          console.log('Usage: node read_write_search_file.js replace <file> <search> <replace> [options]');
          process.exit(1);
        }
        
        const replaceFile = fileArgs[0];
        const searchValue = fileArgs[1];
        const replaceValue = fileArgs[2];
        
        console.log(`🔄 Replacing "${searchValue}" with "${replaceValue}" in ${replaceFile}...`);
        if (options.dryRun) {
          console.log('🧪 DRY RUN MODE - No changes will be made');
        }
        
        const replaceResult = await replace(replaceFile, searchValue, replaceValue, options);
        
        console.log('\n📊 REPLACE SUMMARY:');
        console.log('===================');
        console.log(`📄 File: ${replaceResult.file}`);
        console.log(`🔄 Replacements: ${replaceResult.replacements}`);
        console.log(`📏 Size change: ${replaceResult.sizeDifference >= 0 ? '+' : ''}${replaceResult.sizeDifference} bytes`);
        console.log(`✅ Changed: ${replaceResult.changed ? 'Yes' : 'No'}`);
        
        if (options.dryRun) {
          console.log('🧪 This was a dry run - no actual changes were made');
        }
        break;
        
      case 'write':
        if (fileArgs.length < 2) {
          console.log('❌ Please provide file path and content.');
          console.log('Usage: node read_write_search_file.js write <file> <content> [options]');
          process.exit(1);
        }
        
        const writeFile = fileArgs[0];
        const content = fileArgs.slice(1).join(' ');
        
        console.log(`✍️  Writing to ${writeFile}...`);
        const writeResult = await write_file(writeFile, content, options);
        
        console.log('\n📊 WRITE SUMMARY:');
        console.log('=================');
        console.log(`📄 File: ${writeResult.file}`);
        console.log(`📏 Size: ${writeResult.formattedSize}`);
        console.log(`🔤 Encoding: ${writeResult.encoding}`);
        console.log(`⚡ Operation: ${writeResult.operation}`);
        console.log(`📅 Timestamp: ${writeResult.created}`);
        break;
        
      default:
        console.log(`❌ Unknown command: ${command}`);
        console.log('Available commands: read, read-many, search, replace, write');
        console.log('Use --help for detailed usage information.');
        process.exit(1);
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    
    console.log('\n💡 Troubleshooting tips:');
    console.log('   • Check if file paths are correct and accessible');
    console.log('   • Ensure you have read/write permissions');
    console.log('   • Use --backup option for safe replacements');
    console.log('   • Try --dry-run to preview changes');
    console.log('   • Use --continue-on-error for batch operations');
    
    process.exit(1);
  }
};

// Export functions for use in other modules
export {
  read_file,
  search_file_content,
  replace,
  write_file,
  read_many_files,
  fileExists,
  formatFileSize
};

// Run CLI if this file is executed directly
const isMainModule = process.argv[1] && (
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
  process.argv[1].endsWith('read_write_search_file.js')
);

if (isMainModule) {
  main();
}