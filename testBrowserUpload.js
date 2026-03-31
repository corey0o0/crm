const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navigate to local dev server (default port 3000)
  try {
    // Log things to find the error
    page.on('console', msg => {
      console.log('BROWSER LOG:', msg.text());
    });
    page.on('pageerror', err => {
      console.log('BROWSER ERROR:', err.message);
    });
    page.on('requestfailed', request => {
      console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
    });
    
    // Create a dummy image file
    const fs = require('fs');
    fs.writeFileSync('dummy.jpg', 'fake image content');

    console.log('Navigating to app...');
    await page.goto('http://localhost:3000');
    // We only need to see if the page loads and we could maybe run the Cloudflare util function directly!
    await page.evaluate(async () => {
      // It's a React app, so we can't easily access the functions directly. 
      // But we can trigger the fetch or see what happens.
      console.log("Page loaded");
    });

  } catch (err) {
    console.error("Test script error:", err);
  } finally {
    await browser.close();
  }
})();
