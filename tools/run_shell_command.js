#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to validate command safety
const isCommandSafe = (command) => {
  // Basic safety checks for dangerous commands
  const dangerousPatterns = [
    /rm\s+-rf\s+\//, // rm -rf /
    />\s*\/dev\/sd/, // writing to disk devices
    /mkfs/, // formatting filesystems
    /dd\s+if=.*of=\/dev/, // dangerous dd operations
    /:(){ :|:& };:/, // fork bomb
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(command));
};

// Helper function to determine if command should run in background
const isLongRunningCommand = (command) => {
  const longRunningPatterns = [
    /npm\s+start/,
    /npm\s+run\s+dev/,
    /node\s+.*server/,
    /python\s+.*server/,
    /serve/,
    /watch/,
    /tail\s+-f/,
    /ping/,
    /top/,
    /htop/
  ];
  
  return longRunningPatterns.some(pattern => pattern.test(command));
};

// Main function to execute shell commands
const runShellCommand = async (command, options = {}) => {
  const {
    cwd = process.cwd(),
    timeout = 30000,
    encoding = 'utf8',
    retries = 3,
    background = false,
    interactive = false,
    env = {},
    shell = true,
    maxBuffer = 1024 * 1024 * 10, // 10MB default
    silent = false
  } = options;

  // Safety validation
  if (!isCommandSafe(command)) {
    throw new Error('❌ Command appears to be potentially dangerous and was blocked for safety');
  }

  if (!silent) {
    console.log(`🔄 Executing: ${command}`);
    console.log(`📁 Working directory: ${cwd}`);
    console.log(`⏱️  Timeout: ${timeout}ms, Retries: ${retries}`);
  }

  // Validate working directory
  if (!fs.existsSync(cwd)) {
    throw new Error(`❌ Working directory does not exist: ${cwd}`);
  }

  // Prepare environment
  const execEnv = {
    ...process.env,
    ...env
  };

  // Handle background processes
  if (background || isLongRunningCommand(command)) {
    if (!silent) {
      console.log('🔄 Running command in background...');
    }
    
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        cwd,
        env: execEnv,
        shell,
        detached: true,
        stdio: interactive ? 'inherit' : ['ignore', 'pipe', 'pipe']
      });

      if (!interactive) {
        child.unref(); // Allow parent to exit
      }

      let output = '';
      let errorOutput = '';

      if (!interactive) {
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });

        child.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });
      }

      child.on('error', (error) => {
        reject({
          command,
          success: false,
          output,
          error: error.message,
          exitCode: 1,
          background: true
        });
      });

      child.on('spawn', () => {
        resolve({
          command,
          success: true,
          output: 'Process started in background',
          error: '',
          exitCode: 0,
          background: true,
          pid: child.pid
        });
      });
    });
  }

  // Handle synchronous execution with retries
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!silent && attempt > 1) {
        console.log(`🔄 Retry attempt ${attempt}/${retries}...`);
      }

      const startTime = Date.now();
      
      const output = execSync(command, {
        cwd,
        timeout,
        encoding,
        env: execEnv,
        stdio: interactive ? 'inherit' : 'pipe',
        shell,
        maxBuffer
      });

      const duration = Date.now() - startTime;
      
      if (!silent) {
        console.log(`✅ Command completed successfully in ${duration}ms`);
      }

      return {
        command,
        success: true,
        output: output?.toString() || '',
        error: '',
        exitCode: 0,
        duration,
        attempt
      };

    } catch (error) {
      lastError = error;
      const duration = Date.now() - (Date.now() - (error.timeout || timeout));
      
      if (!silent) {
        console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
      }

      // Don't retry for certain types of errors
      if (error.code === 'ENOENT' || error.signal === 'SIGKILL') {
        break;
      }

      if (attempt < retries) {
        if (!silent) {
          console.log(`⏳ Waiting 2 seconds before retry...`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // All retries failed
  const finalError = {
    command,
    success: false,
    output: lastError.stdout?.toString() || '',
    error: lastError.stderr?.toString() || lastError.message,
    exitCode: lastError.status || lastError.code || 1,
    signal: lastError.signal,
    attempts: retries
  };

  if (!silent) {
    console.log(`❌ Command failed after ${retries} attempts`);
  }

  return finalError;
};

// CLI functionality
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log('🚀 Shell Command Runner Tool');
    console.log('============================');
    console.log('Usage: node run_shell_command.js <command> [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  command             The shell command to execute (wrap in quotes if it contains spaces)');
    console.log('');
    console.log('Options:');
    console.log('  --cwd=PATH          Working directory for command execution (default: current directory)');
    console.log('  --timeout=N         Command timeout in milliseconds (default: 30000)');
    console.log('  --retries=N         Number of retry attempts for failed commands (default: 3)');
    console.log('  --background        Run command in background (detached process)');
    console.log('  --interactive       Run command in interactive mode (inherit stdio)');
    console.log('  --max-buffer=N      Maximum buffer size in bytes (default: 10MB)');
    console.log('  --silent            Suppress progress output');
    console.log('  --env=KEY=VALUE     Set environment variables (can use multiple times)');
    console.log('');
    console.log('Features:');
    console.log('  • Robust error handling with configurable retries');
    console.log('  • Safety checks to prevent dangerous operations');
    console.log('  • Background process support for long-running commands');
    console.log('  • Interactive mode for commands requiring user input');
    console.log('  • Configurable timeouts and working directories');
    console.log('  • Environment variable support');
    console.log('');
    console.log('Examples:');
    console.log('  node run_shell_command.js "npm install"');
    console.log('  node run_shell_command.js "git status" --cwd=/path/to/repo');
    console.log('  node run_shell_command.js "npm start" --background');
    console.log('  node run_shell_command.js "python script.py" --timeout=60000 --retries=1');
    console.log('  node run_shell_command.js "npm test" --env=NODE_ENV=test --silent');
    console.log('  node run_shell_command.js "npm run build" --interactive --max-buffer=52428800');
    console.log('');
    console.log('Safety Notes:');
    console.log('  • Commands are checked for potentially dangerous operations');
    console.log('  • Long-running commands are automatically detected and can run in background');
    console.log('  • Use --interactive for commands that require user input');
    console.log('  • Working directory is validated before execution');
    process.exit(args.includes('--help') ? 0 : 1);
  }

  // Extract command (everything that doesn't start with --)
  const commandParts = [];
  const options = {};
  const envVars = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--cwd=')) {
      options.cwd = arg.split('=')[1];
    } else if (arg.startsWith('--timeout=')) {
      options.timeout = parseInt(arg.split('=')[1]) || 30000;
    } else if (arg.startsWith('--retries=')) {
      options.retries = parseInt(arg.split('=')[1]) || 3;
    } else if (arg.startsWith('--max-buffer=')) {
      options.maxBuffer = parseInt(arg.split('=')[1]) || 1024 * 1024 * 10;
    } else if (arg.startsWith('--env=')) {
      const envPair = arg.split('=').slice(1).join('=');
      const [key, value] = envPair.split('=');
      if (key && value !== undefined) {
        envVars[key] = value;
      }
    } else if (arg === '--background') {
      options.background = true;
    } else if (arg === '--interactive') {
      options.interactive = true;
    } else if (arg === '--silent') {
      options.silent = true;
    } else if (!arg.startsWith('--')) {
      commandParts.push(arg);
    }
  }

  if (Object.keys(envVars).length > 0) {
    options.env = envVars;
  }

  const command = commandParts.join(' ');
  
  if (!command.trim()) {
    console.log('❌ No command provided. Use --help for usage information.');
    process.exit(1);
  }

  try {
    const result = await runShellCommand(command, options);
    
    if (!options.silent) {
      console.log('\n📊 EXECUTION SUMMARY:');
      console.log('====================');
      console.log(`Command: ${result.command}`);
      console.log(`Success: ${result.success ? '✅' : '❌'}`);
      console.log(`Exit Code: ${result.exitCode}`);
      
      if (result.duration) {
        console.log(`Duration: ${result.duration}ms`);
      }
      
      if (result.attempt) {
        console.log(`Attempts: ${result.attempt}${result.attempts ? `/${result.attempts}` : ''}`);
      }
      
      if (result.background) {
        console.log(`Background Process: ${result.success ? `✅ (PID: ${result.pid})` : '❌'}`);
      }
      
      if (result.output && result.output.trim()) {
        console.log('\n📄 Output:');
        console.log(result.output);
      }
      
      if (result.error && result.error.trim()) {
        console.log('\n❌ Error:');
        console.log(result.error);
      }
    }
    
    // Exit with the same code as the command
    process.exit(result.exitCode || 0);
    
  } catch (error) {
    if (!options.silent) {
      console.error('\n❌ Execution failed:', error.message);
      
      console.log('\n💡 Troubleshooting tips:');
      console.log('   • Check if the command exists and is in PATH');
      console.log('   • Verify the working directory exists and is accessible');
      console.log('   • Try increasing timeout: --timeout=60000');
      console.log('   • Try reducing retries for faster failure: --retries=1');
      console.log('   • Use --interactive for commands requiring user input');
      console.log('   • Use --background for long-running processes');
    }
    
    process.exit(1);
  }
};

// Export the function for use in other modules
export { 
  runShellCommand,
  isCommandSafe,
  isLongRunningCommand
};

// Run CLI if this file is executed directly
if (process.argv[1] === __filename) {
  main();
}