Steps to run the project:
1. Install dependencies: `npm install`
2. Make the CLI file executable: `chmod +x cli.js` (SKIP THIS STEP IF YOU ARE ON WINDOWS)
3. Link it globally using npm: `npm link`
4. Create a .env.local file and add your OpenAI API key: `OPENAI_API_KEY=your_api_key` and optionlly add the model you want to use: `OPENAI_MODEL=gpt-4.1`
5. In terminal run: `chai` and then ask any question you want to answer.

## Tool usage:
### 1. page-extractor - Extracts the HTML, CSS and JS of a website
#### Basic usage
node page-extractor.js https://example.com

#### With custom timeout and retries
node page-extractor.js https://example.com --timeout=90000 --retries=5

#### Different wait strategies
node page-extractor.js https://slow-site.com --wait-until=networkidle0

#### Disable caching and extract computed styles
node page-extractor.js https://example.com --no-cache --computed-styles

#### Custom output directory
node page-extractor.js https://example.com ./my-extractions

### 2. responsive-screenshots - Takes screenshots of a website at different screen sizes
#### Basic usage (60s timeout, 3 retries, domcontentloaded)
node responsive-screenshots.js https://piyushgarg.dev

#### For slow sites - increase timeout and retries
node responsive-screenshots.js https://slow-site.com --timeout=120000 --retries=5

#### For dynamic sites - wait for network to be idle
node responsive-screenshots.js https://spa-app.com --wait-until=networkidle0

#### Combine options for maximum reliability
node responsive-screenshots.js https://heavy-site.com --timeout=90000 --retries=3 --wait-until=networkidle2

### 3. read_write_search_file - Advanced file operations tool for reading, searching, and writing files
#### Basic usage - Read a single file
node tools/read_write_search_file.js read package.json

#### Read multiple files with progress tracking
node tools/read_write_search_file.js read-many package.json README.md --progress

#### Search for patterns in files
node tools/read_write_search_file.js search "console.log" src/index.js tools/*.js

#### Search with context and case-insensitive matching
node tools/read_write_search_file.js search "error" *.js --context --case-insensitive --context-lines=3

#### Replace text in files with backup
node tools/read_write_search_file.js replace config.js "oldValue" "newValue" --backup

#### Dry run replacement to preview changes
node tools/read_write_search_file.js replace config.js "test" "production" --dry-run

#### Write content to file with directory creation
node tools/read_write_search_file.js write logs/output.txt "Hello World" --create-dirs

#### Append content to existing file
node tools/read_write_search_file.js write notes.txt "Additional content" --append

#### Advanced search with whole word matching
node tools/read_write_search_file.js search "function" src/*.js --whole-word --max-matches=50

#### Replace with case-insensitive and whole word matching
node tools/read_write_search_file.js replace script.js "oldFunction" "newFunction" --case-insensitive --whole-word --backup

### 4. glob_files - Search and find files using glob patterns
#### Basic usage - Find all JavaScript files
node tools/glob_files.js "*.js"

#### Find TypeScript files with detailed information
node tools/glob_files.js "**/*.{ts,tsx}" --stats

#### Search in specific directory with relative paths
node tools/glob_files.js "src/**" --cwd=./my-project --relative

#### Advanced search with custom ignore patterns
node tools/glob_files.js "**/*.json" --ignore="*.lock" --ignore="temp/**"

#### Limit search depth and output as table
node tools/glob_files.js "**/*.md" --max-depth=3 --stats --output=table

#### Case insensitive search with JSON output
node tools/glob_files.js "**/*.CSS" --case-insensitive --output=json

#### Save results to file
node tools/glob_files.js "**/*.js" --stats --save=search-results.json

#### Include hidden files and directories
node tools/glob_files.js ".*" --include-dot

### 5. list_directory - Advanced directory listing tool with filtering and sorting options
#### Basic usage - List current directory
node tools/list_directory.js

#### List specific directory with file stats
node tools/list_directory.js ./src --stats

#### Recursive listing with hidden files
node tools/list_directory.js . --recursive --hidden

#### Filter by file extension and sort by size
node tools/list_directory.js ./project --filter=.js --sort=size --order=desc

#### Recursive listing with depth limit and table output
node tools/list_directory.js ./src --recursive --max-depth=3 --output=table --stats

#### JSON output for programmatic use
node tools/list_directory.js ./data --recursive --output=json

#### Sort by modification date (newest first)
node tools/list_directory.js ./logs --sort=date --order=desc --stats

#### Available options
- `--recursive` - List files and directories recursively
- `--hidden` - Include hidden files and directories (starting with .)
- `--stats` - Show file sizes and modification dates
- `--sort=FIELD` - Sort by: name, size, date (default: name)
- `--order=ORDER` - Sort order: asc, desc (default: asc)
- `--filter=EXT` - Filter files by extension (e.g., .js, .json)
- `--max-depth=N` - Maximum directory depth for recursive listing
- `--output=FORMAT` - Output format: list, json, table (default: list)
- `--help` - Show detailed help and examples

#### Common patterns and examples
- `"*.js"` - All JS files in current directory
- `"**/*.js"` - All JS files recursively
- `"src/**/*.{ts,tsx}"` - TypeScript files in src directory
- `"**/*.json"` - All JSON files
- `"!**/node_modules/**"` - Exclude node_modules (already ignored by default)
- `"**/*.md"` - All Markdown files
- `"*.{jpg,png,gif}"` - Image files

#### Available options
- `--cwd=PATH` - Set working directory
- `--ignore=PATTERN` - Add ignore patterns (can use multiple times)
- `--include-dot` - Include hidden files/directories
- `--relative` - Show relative paths instead of absolute
- `--max-depth=N` - Limit directory search depth
- `--case-insensitive` - Case insensitive matching
- `--stats` - Include file size and modification date
- `--output=FORMAT` - Output format: list, json, table
- `--save=FILE` - Save results to JSON file
- `--help` - Show detailed help and examples

### 6. run_shell_command - Robust shell command execution tool with safety checks and retry mechanisms
#### Basic usage - Execute a simple command
node tools/run_shell_command.js "npm --version"

#### Execute command with custom working directory
node tools/run_shell_command.js "git status" --cwd=./my-project

#### Run long-running commands in background
node tools/run_shell_command.js "npm start" --background

#### Interactive commands with user input
node tools/run_shell_command.js "npm init" --interactive

#### Command with custom timeout and retries
node tools/run_shell_command.js "npm install" --timeout=60000 --retries=5

#### Set environment variables
node tools/run_shell_command.js "npm test" --env=NODE_ENV=test --env=DEBUG=true

#### Silent execution (suppress progress output)
node tools/run_shell_command.js "git pull" --silent

#### Custom buffer size for commands with large output
node tools/run_shell_command.js "npm run build" --max-buffer=52428800

#### Available options
- `--cwd=PATH` - Working directory for command execution (default: current directory)
- `--timeout=N` - Command timeout in milliseconds (default: 30000)
- `--retries=N` - Number of retry attempts for failed commands (default: 3)
- `--background` - Run command in background (detached process)
- `--interactive` - Run command in interactive mode (inherit stdio)
- `--max-buffer=N` - Maximum buffer size in bytes (default: 10MB)
- `--silent` - Suppress progress output
- `--env=KEY=VALUE` - Set environment variables (can use multiple times)
- `--help` - Show detailed help and examples

#### Features
- **Safety Checks**: Prevents execution of potentially dangerous commands
- **Retry Mechanism**: Configurable retry attempts with delays for failed commands
- **Background Execution**: Automatic detection and support for long-running processes
- **Interactive Mode**: Support for commands requiring user input
- **Environment Variables**: Easy setting of custom environment variables
- **Robust Error Handling**: Detailed error reporting with troubleshooting tips
- **Progress Tracking**: Real-time execution feedback with timing information
- **Working Directory Validation**: Ensures target directory exists before execution

#### Safety Features
The tool includes built-in safety checks to prevent dangerous operations:
- Blocks commands like `rm -rf /` and other destructive filesystem operations
- Validates working directories before execution
- Detects and handles long-running processes appropriately
- Provides clear error messages and troubleshooting guidance

#### Examples for common scenarios
```bash
# Development workflow
node tools/run_shell_command.js "npm install" --timeout=90000
node tools/run_shell_command.js "npm run dev" --background
node tools/run_shell_command.js "npm test" --env=NODE_ENV=test

# Git operations
node tools/run_shell_command.js "git status" --cwd=./my-repo
node tools/run_shell_command.js "git pull origin main" --retries=3

# Build and deployment
node tools/run_shell_command.js "npm run build" --interactive --max-buffer=52428800
node tools/run_shell_command.js "docker build -t myapp ." --timeout=300000

# System commands
node tools/run_shell_command.js "ping google.com" --background
node tools/run_shell_command.js "ls -la" --cwd=/tmp --silent
```