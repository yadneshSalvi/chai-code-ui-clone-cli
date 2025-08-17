#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Helper function to generate a consistent website key from URL
const getWebsiteKey = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, ''); // Remove www. prefix for consistency
  } catch (error) {
    return url; // Fallback to original URL if parsing fails
  }
};

// Helper function to read websites.json
const readWebsitesJson = () => {
  const jsonPath = path.join(__dirname, '..', 'data', 'screenshots', 'websites.json');
  try {
    if (fs.existsSync(jsonPath)) {
      const content = fs.readFileSync(jsonPath, 'utf8').trim();
      return content ? JSON.parse(content) : {};
    }
    return {};
  } catch (error) {
    console.log('⚠️  Error reading websites.json, starting with empty data:', error.message);
    return {};
  }
};

// Helper function to write websites.json
const writeWebsitesJson = (data) => {
  const jsonPath = path.join(__dirname, '..', 'data', 'screenshots', 'websites.json');
  const dirPath = path.dirname(jsonPath);
  
  // Ensure directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.log('❌ Error writing websites.json:', error.message);
    return false;
  }
};

const takeResponsiveScreenshots = async (url, outputDir = path.join(__dirname, '..', 'data', 'screenshots'), options = {}) => {
  const {
    timeout = 60000,
    retries = 3,
    waitUntil = 'domcontentloaded',
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  } = options;

  const viewports = [
    { width: 375, height: 667, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1920, height: 1080, name: 'desktop' }
  ];
  
  // Check if screenshots already exist for this website
  const websiteKey = getWebsiteKey(url);
  const existingWebsites = readWebsitesJson();
  
  if (existingWebsites[websiteKey]) {
    console.log(`✅ Screenshots already exist for ${websiteKey}`);
    console.log(`📁 Returning existing screenshot paths...`);
    
    const existingData = existingWebsites[websiteKey];
    const screenshots = [];
    
    // Verify that the files actually exist before returning paths
    let allFilesExist = true;
    for (const [viewportName, filePath] of Object.entries(existingData)) {
      // Handle both absolute and relative paths
      let fullPath = filePath;
      if (!path.isAbsolute(filePath)) {
        // If it's a relative path, resolve it relative to the data/screenshots directory
        fullPath = path.resolve(path.join(__dirname, '..', 'data', 'screenshots'), filePath);
      }
      
      if (fs.existsSync(fullPath)) {
        screenshots.push({
          viewport: viewportName,
          dimensions: viewports.find(v => v.name === viewportName)?.width + 'x' + viewports.find(v => v.name === viewportName)?.height || 'unknown',
          file: fullPath,
          filename: path.basename(fullPath),
          cached: true
        });
      } else {
        console.log(`⚠️  Cached file not found: ${fullPath}`);
        allFilesExist = false;
        break;
      }
    }
    
    // If all cached files exist, return them
    if (allFilesExist && screenshots.length === viewports.length) {
      console.log(`🎉 Returning ${screenshots.length} cached screenshots!`);
      return screenshots;
    } else {
      console.log(`⚠️  Some cached files are missing, taking new screenshots...`);
    }
  }
  
  console.log(`📸 Taking responsive screenshots of: ${url}`);
  console.log(`⚙️  Settings: timeout=${timeout}ms, retries=${retries}, waitUntil=${waitUntil}`);
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created directory: ${outputDir}`);
  }
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });
  
  const page = await browser.newPage();
  
  // Set user agent to avoid being blocked
  await page.setUserAgent(userAgent);
  
  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  });
  
  // Set default timeout
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);
  
  try {
    // Retry mechanism for navigation
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🔄 Navigation attempt ${attempt}/${retries}...`);
        
        await page.goto(url, { 
          waitUntil: waitUntil,
          timeout: timeout 
        });
        
        // Wait for page to be ready with multiple strategies
        try {
          await page.waitForSelector('body', { timeout: 5000 });
        } catch (e) {
          console.log('⚠️  Body selector not found, continuing anyway...');
        }
        
        // Additional wait for dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('✅ Page loaded successfully!');
        break; // Success, exit retry loop
        
      } catch (error) {
        lastError = error;
        console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < retries) {
          console.log(`⏳ Waiting 3 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    // If all retries failed, throw the last error
    if (lastError && retries > 0) {
      throw new Error(`Navigation failed after ${retries} attempts. Last error: ${lastError.message}`);
    }
    
    const urlObj = new URL(url);
    const timestamp = Date.now();
    const screenshots = [];
    
    for (const viewport of viewports) {
      console.log(`📱 Taking ${viewport.name} screenshot (${viewport.width}x${viewport.height})`);
      
      try {
        await page.setViewport(viewport);
        
        // Wait for responsive changes to take effect
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Wait for any lazy-loaded content
        try {
          await page.evaluate(() => {
            return new Promise((resolve) => {
              if (document.readyState === 'complete') {
                resolve();
              } else {
                window.addEventListener('load', resolve);
              }
            });
          });
        } catch (e) {
          console.log('⚠️  Could not wait for window load event, continuing...');
        }
        
        // Scroll to trigger lazy loading
        await page.evaluate(() => {
          return new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;
              
              if (totalHeight >= scrollHeight) {
                clearInterval(timer);
                window.scrollTo(0, 0); // Scroll back to top
                setTimeout(resolve, 500); // Wait a bit after scrolling back
              }
            }, 100);
          });
        });
        
        const filename = `screenshot-${urlObj.hostname}-${viewport.name}-${timestamp}.png`;
        const filepath = path.join(outputDir, filename);
        
        await page.screenshot({ 
          path: filepath,
          fullPage: true,
          captureBeyondViewport: false
        });
        
        screenshots.push({
          viewport: viewport.name,
          dimensions: `${viewport.width}x${viewport.height}`,
          file: filepath,
          filename: filename
        });
        
        console.log(`✅ Saved: ${filename}`);
        
      } catch (error) {
        console.log(`❌ Failed to take ${viewport.name} screenshot: ${error.message}`);
        // Continue with other viewports even if one fails
        screenshots.push({
          viewport: viewport.name,
          dimensions: `${viewport.width}x${viewport.height}`,
          file: null,
          filename: null,
          error: error.message
        });
      }
    }
    
    await browser.close();
    console.log('🎉 All screenshots completed!');
    
    // Update websites.json only if we have successful screenshots
    const successfulScreenshots = screenshots.filter(shot => !shot.error && shot.file);
    if (successfulScreenshots.length > 0) {
      const websiteData = {};
      successfulScreenshots.forEach(shot => {
        websiteData[shot.viewport] = shot.file;
      });
      
      // Only update if we have all three viewport screenshots
      if (successfulScreenshots.length === viewports.length) {
        const websites = readWebsitesJson();
        websites[websiteKey] = websiteData;
        
        if (writeWebsitesJson(websites)) {
          console.log(`📝 Updated websites.json with screenshots for ${websiteKey}`);
        } else {
          console.log(`⚠️  Failed to update websites.json`);
        }
      } else {
        console.log(`⚠️  Not all screenshots were successful (${successfulScreenshots.length}/${viewports.length}), skipping websites.json update`);
      }
    }
    
    return screenshots;
    
  } catch (error) {
    await browser.close();
    throw error;
  }
};

// CLI functionality
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('❌ Please provide a URL to take screenshots of.');
    console.log('Usage: node responsive-screenshots.js <URL> [output-directory] [options]');
    console.log('Example: node responsive-screenshots.js https://example.com');
    console.log('Example: node responsive-screenshots.js https://example.com ./my-screenshots');
    console.log('');
    console.log('Options:');
    console.log('  --timeout=60000     Navigation timeout in milliseconds (default: 60000)');
    console.log('  --retries=3         Number of retry attempts (default: 3)');
    console.log('  --wait-until=domcontentloaded  Wait strategy: domcontentloaded, load, networkidle0, networkidle2 (default: domcontentloaded)');
    console.log('  --help              Show this help message');
    process.exit(1);
  }
  
  if (args.includes('--help')) {
    console.log('📸 Responsive Screenshots Tool');
    console.log('==============================');
    console.log('Usage: node responsive-screenshots.js <URL> [output-directory] [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  URL                 The website URL to screenshot');
    console.log('  output-directory    Directory to save screenshots (default: ../data/screenshots)');
    console.log('');
    console.log('Options:');
    console.log('  --timeout=N         Navigation timeout in milliseconds (default: 60000)');
    console.log('  --retries=N         Number of retry attempts for failed navigation (default: 3)');
    console.log('  --wait-until=STRATEGY  Wait strategy for page load:');
    console.log('                        - domcontentloaded: Wait for DOM to be loaded (fastest, default)');
    console.log('                        - load: Wait for all resources including images');
    console.log('                        - networkidle0: Wait until no network requests for 500ms');
    console.log('                        - networkidle2: Wait until ≤2 network requests for 500ms');
    console.log('');
    console.log('Examples:');
    console.log('  node responsive-screenshots.js https://example.com');
    console.log('  node responsive-screenshots.js https://example.com ./screenshots --timeout=90000');
    console.log('  node responsive-screenshots.js https://slow-site.com --retries=5 --wait-until=networkidle0');
    process.exit(0);
  }
  
  const url = args[0];
  const outputDir = args.find(arg => !arg.startsWith('--') && arg !== url) || path.join(__dirname, '..', 'data', 'screenshots');
  
  // Parse options
  const options = {};
  args.forEach(arg => {
    if (arg.startsWith('--timeout=')) {
      options.timeout = parseInt(arg.split('=')[1]) || 60000;
    } else if (arg.startsWith('--retries=')) {
      options.retries = parseInt(arg.split('=')[1]) || 3;
    } else if (arg.startsWith('--wait-until=')) {
      const waitUntil = arg.split('=')[1];
      if (['domcontentloaded', 'load', 'networkidle0', 'networkidle2'].includes(waitUntil)) {
        options.waitUntil = waitUntil;
      } else {
        console.log(`❌ Invalid wait-until strategy: ${waitUntil}`);
        console.log('Valid options: domcontentloaded, load, networkidle0, networkidle2');
        process.exit(1);
      }
    }
  });
  
  // Basic URL validation
  try {
    new URL(url);
  } catch (error) {
    console.log('❌ Invalid URL provided. Please provide a valid URL.');
    console.log('Example: node responsive-screenshots.js https://example.com');
    process.exit(1);
  }
  
  try {
    const screenshots = await takeResponsiveScreenshots(url, outputDir, options);
    
    console.log('\n📊 SCREENSHOT SUMMARY:');
    console.log('=====================');
    let successCount = 0;
    let failureCount = 0;
    
    screenshots.forEach(shot => {
      if (shot.error) {
        console.log(`❌ ${shot.viewport.toUpperCase()}: ${shot.dimensions} → FAILED (${shot.error})`);
        failureCount++;
      } else {
        console.log(`✅ ${shot.viewport.toUpperCase()}: ${shot.dimensions} → ${shot.filename}`);
        successCount++;
      }
    });
    
    console.log(`\n📈 Results: ${successCount} successful, ${failureCount} failed`);
    if (successCount > 0) {
      console.log(`📁 Screenshots saved in: ${path.resolve(outputDir)}`);
    }
    
    if (failureCount > 0) {
      console.log('\n💡 Tips for failed screenshots:');
      console.log('   • Try increasing timeout: --timeout=90000');
      console.log('   • Try more retries: --retries=5');
      console.log('   • Try different wait strategy: --wait-until=networkidle0');
      console.log('   • Some sites may block automated browsers');
    }
    
  } catch (error) {
    console.error('❌ Error taking screenshots:', error.message);
    process.exit(1);
  }
};

// Export the function for use in other modules
module.exports = { 
  takeResponsiveScreenshots,
  getWebsiteKey,
  readWebsitesJson,
  writeWebsitesJson
};

// Run CLI if this file is executed directly
if (require.main === module) {
  main();
}
