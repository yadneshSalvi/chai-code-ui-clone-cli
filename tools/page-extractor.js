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

// Helper function to read websites.json for caching
const readWebsitesJson = () => {
  const jsonPath = path.join(__dirname, '..', 'data', 'website_extraction', 'websites.json');
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

// Helper function to write websites.json for caching
const writeWebsitesJson = (data) => {
  const jsonPath = path.join(__dirname, '..', 'data', 'website_extraction', 'websites.json');
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

const extractPageData = async (url, outputDir = path.join(__dirname, '..', 'data', 'website_extraction'), options = {}) => {
  const {
    timeout = 60000,
    retries = 3,
    waitUntil = 'domcontentloaded',
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    useCache = true,
    extractComputedStyles = false // This can be expensive, so make it optional
  } = options;

  // Check if extraction already exists for this website
  const websiteKey = getWebsiteKey(url);
  const existingWebsites = readWebsitesJson();
  
  if (useCache && existingWebsites[websiteKey]) {
    console.log(`✅ Extraction data already exists for ${websiteKey}`);
    console.log(`📁 Returning existing extraction data...`);
    
    const existingData = existingWebsites[websiteKey];
    // Check if the cached file exists
    let fullPath = existingData.filePath;
    if (!path.isAbsolute(fullPath)) {
      fullPath = path.resolve(path.join(__dirname, '..', 'data', 'website_extraction'), fullPath);
    }
    
    if (fs.existsSync(fullPath)) {
      try {
        const cachedData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        console.log(`🎉 Returning cached extraction data!`);
        return { ...cachedData, cached: true };
      } catch (error) {
        console.log(`⚠️  Error reading cached file, extracting fresh data...`);
      }
    } else {
      console.log(`⚠️  Cached file not found, extracting fresh data...`);
    }
  }
  
  console.log(`🔍 Extracting data from: ${url}`);
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
      '--disable-gpu',
      '--disable-web-security', // Help with CORS issues for CSS
      '--disable-features=VizDisplayCompositor'
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
    
    // Get HTML
    console.log('📄 Extracting HTML...');
    const html = await page.content();
    
    // Get all CSS with better error handling
    console.log('🎨 Extracting CSS...');
    const stylesheets = await page.evaluate(() => {
      const css = [];
      const processedHrefs = new Set();
      
      try {
        Array.from(document.styleSheets).forEach(sheet => {
          try {
            // Try to access cssRules
            if (sheet.cssRules) {
              const rules = Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
              if (rules.trim()) {
                css.push({
                  type: 'inline',
                  content: rules,
                  href: sheet.href || 'inline'
                });
              }
            }
          } catch (e) {
            // CORS or other access issues - just record the href
            if (sheet.href && !processedHrefs.has(sheet.href)) {
              processedHrefs.add(sheet.href);
              css.push({
                type: 'external',
                content: null,
                href: sheet.href,
                error: 'CORS or access denied'
              });
            }
          }
        });
        
        // Also get inline styles from style tags
        Array.from(document.querySelectorAll('style')).forEach((styleTag, index) => {
          if (styleTag.textContent.trim()) {
            css.push({
              type: 'style_tag',
              content: styleTag.textContent,
              href: `inline-style-${index}`
            });
          }
        });
        
      } catch (e) {
        console.log('Error extracting CSS:', e.message);
      }
      
      return css;
    });
    
    // Get computed styles for elements (optional, can be expensive)
    let computedStyles = [];
    if (extractComputedStyles) {
      console.log('💅 Extracting computed styles...');
      try {
        computedStyles = await page.evaluate(() => {
          const elements = document.querySelectorAll('*');
          const styles = [];
          
          // Limit to first 100 elements to avoid memory issues
          const elementsToProcess = Array.from(elements).slice(0, 100);
          
          elementsToProcess.forEach((el, index) => {
            try {
              const computedStyle = window.getComputedStyle(el);
              const selector = el.tagName.toLowerCase() + 
                (el.id ? '#' + el.id : '') +
                (el.className ? '.' + el.className.split(' ').filter(c => c).join('.') : '');
              
              // Only extract non-default styles to reduce size
              const relevantStyles = {};
              ['display', 'position', 'width', 'height', 'margin', 'padding', 'color', 'background-color', 'font-size', 'font-family'].forEach(prop => {
                const value = computedStyle.getPropertyValue(prop);
                if (value && value !== 'auto' && value !== 'initial') {
                  relevantStyles[prop] = value;
                }
              });
              
              if (Object.keys(relevantStyles).length > 0) {
                styles.push({
                  selector: selector || `element-${index}`,
                  styles: relevantStyles
                });
              }
            } catch (e) {
              // Skip elements that cause errors
            }
          });
          
          return styles;
        });
      } catch (error) {
        console.log('⚠️  Error extracting computed styles:', error.message);
        computedStyles = [];
      }
    }
    
    // Get JavaScript with better error handling
    console.log('⚡ Extracting JavaScript...');
    const scripts = await page.evaluate(() => {
      const scriptData = [];
      
      try {
        Array.from(document.scripts).forEach((script, index) => {
          scriptData.push({
            index: index,
            src: script.src || null,
            content: script.innerHTML || null,
            type: script.type || 'text/javascript',
            async: script.async || false,
            defer: script.defer || false
          });
        });
      } catch (e) {
        console.log('Error extracting scripts:', e.message);
      }
      
      return scriptData;
    });
    
    // Get page metadata
    console.log('📋 Extracting metadata...');
    const metadata = await page.evaluate(() => {
      const meta = {};
      
      try {
        meta.title = document.title;
        meta.description = document.querySelector('meta[name="description"]')?.content || '';
        meta.keywords = document.querySelector('meta[name="keywords"]')?.content || '';
        meta.viewport = document.querySelector('meta[name="viewport"]')?.content || '';
        meta.charset = document.charset || document.characterSet || '';
        meta.lang = document.documentElement.lang || '';
        
        // Open Graph data
        meta.ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
        meta.ogDescription = document.querySelector('meta[property="og:description"]')?.content || '';
        meta.ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
        
        // Other useful metadata
        meta.canonical = document.querySelector('link[rel="canonical"]')?.href || '';
        meta.favicon = document.querySelector('link[rel="icon"]')?.href || document.querySelector('link[rel="shortcut icon"]')?.href || '';
        
      } catch (e) {
        console.log('Error extracting metadata:', e.message);
      }
      
      return meta;
    });
    
    await browser.close();
    console.log('✅ Extraction complete!');
    
    const extractedData = {
      url: url,
      timestamp: new Date().toISOString(),
      html: html,
      stylesheets: stylesheets,
      computedStyles: computedStyles,
      scripts: scripts,
      metadata: metadata,
      stats: {
        htmlLength: html.length,
        stylesheetsCount: stylesheets.length,
        computedStylesCount: computedStyles.length,
        scriptsCount: scripts.length
      }
    };
    
    // Save to file and update cache
    if (useCache) {
      const urlObj = new URL(url);
      const timestamp = Date.now();
      const filename = `extracted-${urlObj.hostname}-${timestamp}.json`;
      const filepath = path.join(outputDir, filename);
      
      try {
        fs.writeFileSync(filepath, JSON.stringify(extractedData, null, 2), 'utf8');
        
        // Update websites.json cache
        const websites = readWebsitesJson();
        websites[websiteKey] = {
          filePath: filename,
          timestamp: extractedData.timestamp,
          url: url
        };
        
        if (writeWebsitesJson(websites)) {
          console.log(`📝 Updated cache with extraction data for ${websiteKey}`);
        }
        
        console.log(`💾 Data saved to: ${filepath}`);
      } catch (error) {
        console.log(`⚠️  Error saving file: ${error.message}`);
      }
    }
    
    return extractedData;
    
  } catch (error) {
    await browser.close();
    throw error;
  }
};

// CLI functionality
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('❌ Please provide a URL to extract data from.');
    console.log('Usage: node page-extractor.js <URL> [output-directory] [options]');
    console.log('Example: node page-extractor.js https://example.com');
    console.log('Example: node page-extractor.js https://example.com ./my-extractions');
    console.log('');
    console.log('Options:');
    console.log('  --timeout=60000     Navigation timeout in milliseconds (default: 60000)');
    console.log('  --retries=3         Number of retry attempts (default: 3)');
    console.log('  --wait-until=domcontentloaded  Wait strategy: domcontentloaded, load, networkidle0, networkidle2 (default: domcontentloaded)');
    console.log('  --no-cache          Disable caching (always extract fresh data)');
    console.log('  --computed-styles   Extract computed styles (can be slow for large pages)');
    console.log('  --help              Show this help message');
    process.exit(1);
  }
  
  if (args.includes('--help')) {
    console.log('🔍 Page Data Extractor Tool');
    console.log('============================');
    console.log('Usage: node page-extractor.js <URL> [output-directory] [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  URL                 The website URL to extract data from');
    console.log('  output-directory    Directory to save extraction files (default: ../data/website_extraction)');
    console.log('');
    console.log('Options:');
    console.log('  --timeout=N         Navigation timeout in milliseconds (default: 60000)');
    console.log('  --retries=N         Number of retry attempts for failed navigation (default: 3)');
    console.log('  --wait-until=STRATEGY  Wait strategy for page load:');
    console.log('                        - domcontentloaded: Wait for DOM to be loaded (fastest, default)');
    console.log('                        - load: Wait for all resources including images');
    console.log('                        - networkidle0: Wait until no network requests for 500ms');
    console.log('                        - networkidle2: Wait until ≤2 network requests for 500ms');
    console.log('  --no-cache          Disable caching and always extract fresh data');
    console.log('  --computed-styles   Extract computed styles for elements (can be slow for large pages)');
    console.log('');
    console.log('Features:');
    console.log('  • Extracts HTML, CSS, JavaScript, and metadata from web pages');
    console.log('  • Handles CORS issues and external stylesheets gracefully');
    console.log('  • Caches results to avoid re-extracting the same websites');
    console.log('  • Robust error handling with retry mechanisms');
    console.log('  • Configurable timeouts and wait strategies');
    console.log('');
    console.log('Examples:');
    console.log('  node page-extractor.js https://example.com');
    console.log('  node page-extractor.js https://example.com ./extractions --timeout=90000');
    console.log('  node page-extractor.js https://slow-site.com --retries=5 --wait-until=networkidle0');
    console.log('  node page-extractor.js https://example.com --no-cache --computed-styles');
    process.exit(0);
  }
  
  const url = args[0];
  const outputDir = args.find(arg => !arg.startsWith('--') && arg !== url) || path.join(__dirname, '..', 'data', 'website_extraction');
  
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
    } else if (arg === '--no-cache') {
      options.useCache = false;
    } else if (arg === '--computed-styles') {
      options.extractComputedStyles = true;
    }
  });
  
  // Basic URL validation
  try {
    new URL(url);
  } catch (error) {
    console.log('❌ Invalid URL provided. Please provide a valid URL.');
    console.log('Example: node page-extractor.js https://example.com');
    process.exit(1);
  }
  
  try {
    const data = await extractPageData(url, outputDir, options);
    
    console.log('\n📊 EXTRACTION SUMMARY:');
    console.log('======================');
    
    if (data.cached) {
      console.log('🎉 Used cached data!');
    }
    
    console.log(`\n📄 HTML Length: ${data.stats.htmlLength.toLocaleString()} characters`);
    console.log(`🎨 Stylesheets: ${data.stats.stylesheetsCount} found`);
    
    // Show stylesheet breakdown
    if (data.stylesheets.length > 0) {
      const inlineCount = data.stylesheets.filter(s => s.type === 'inline').length;
      const externalCount = data.stylesheets.filter(s => s.type === 'external').length;
      const styleTagCount = data.stylesheets.filter(s => s.type === 'style_tag').length;
      console.log(`   └─ ${inlineCount} inline, ${externalCount} external, ${styleTagCount} style tags`);
    }
    
    console.log(`💅 Computed Styles: ${data.stats.computedStylesCount} elements`);
    console.log(`⚡ Scripts: ${data.stats.scriptsCount} found`);
    
    // Show script breakdown
    if (data.scripts.length > 0) {
      const inlineScripts = data.scripts.filter(s => s.content && s.content.trim()).length;
      const externalScripts = data.scripts.filter(s => s.src).length;
      console.log(`   └─ ${inlineScripts} inline, ${externalScripts} external`);
    }
    
    console.log(`\n📋 Metadata:`);
    console.log(`   Title: ${data.metadata.title || 'Not found'}`);
    console.log(`   Description: ${data.metadata.description ? data.metadata.description.substring(0, 100) + '...' : 'Not found'}`);
    console.log(`   Language: ${data.metadata.lang || 'Not specified'}`);
    
    if (!data.cached && options.useCache !== false) {
      console.log(`\n📁 Data saved and cached for future use`);
      console.log(`📁 Output directory: ${path.resolve(outputDir)}`);
    }
    
    // Show any CSS extraction warnings
    const externalCssWithErrors = data.stylesheets.filter(s => s.error);
    if (externalCssWithErrors.length > 0) {
      console.log(`\n⚠️  Note: ${externalCssWithErrors.length} external stylesheets could not be accessed due to CORS restrictions`);
      console.log('   External CSS URLs are still recorded in the extraction data');
    }
    
  } catch (error) {
    console.error('❌ Error extracting page data:', error.message);
    
    console.log('\n💡 Troubleshooting tips:');
    console.log('   • Try increasing timeout: --timeout=90000');
    console.log('   • Try more retries: --retries=5');
    console.log('   • Try different wait strategy: --wait-until=networkidle0');
    console.log('   • Some sites may block automated browsers');
    console.log('   • Check if the URL is accessible and valid');
    
    process.exit(1);
  }
};

// Export the function for use in other modules
module.exports = { 
  extractPageData,
  getWebsiteKey,
  readWebsitesJson,
  writeWebsitesJson
};

// Run CLI if this file is executed directly
if (require.main === module) {
  main();
}
