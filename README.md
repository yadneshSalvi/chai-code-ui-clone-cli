Steps to run the project:
1. Install dependencies: `npm install`
2. Make the CLI file executable: `chmod +x cli.js` (SKIP THIS STEP IF YOU ARE ON WINDOWS)
3. Link it globally using npm: `npm link`
4. Create a .env.local file and add your OpenAI API key: `OPENAI_API_KEY=your_api_key` and optionlly add the model you want to use: `OPENAI_MODEL=gpt-4.1`
5. In terminal run: `chai` and then ask any question you want to answer.

Tool usage:
1. page-extractor - Extracts the HTML, CSS and JS of a website
# Basic usage
node page-extractor.js https://example.com

# With custom timeout and retries
node page-extractor.js https://example.com --timeout=90000 --retries=5

# Different wait strategies
node page-extractor.js https://slow-site.com --wait-until=networkidle0

# Disable caching and extract computed styles
node page-extractor.js https://example.com --no-cache --computed-styles

# Custom output directory
node page-extractor.js https://example.com ./my-extractions

2. responsive-screenshots - Takes screenshots of a website at different screen sizes
# Basic usage (60s timeout, 3 retries, domcontentloaded)
node responsive-screenshots.js https://piyushgarg.dev

# For slow sites - increase timeout and retries
node responsive-screenshots.js https://slow-site.com --timeout=120000 --retries=5

# For dynamic sites - wait for network to be idle
node responsive-screenshots.js https://spa-app.com --wait-until=networkidle0

# Combine options for maximum reliability
node responsive-screenshots.js https://heavy-site.com --timeout=90000 --retries=3 --wait-until=networkidle2

# Show help
node responsive-screenshots.js --help