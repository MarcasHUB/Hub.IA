const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set viewport for desktop
  await page.setViewportSize({ width: 1440, height: 900 });

  // Navigate to app
  await page.goto('http://localhost:5173/login');
  
  // Fake login state
  await page.evaluate(() => {
    localStorage.setItem('supplyhub_organization_id', '10.364.979/0001-30');
    localStorage.setItem('supplyhub_company_name', 'Hub.IA');
    // fake session token if needed
  });

  await page.goto('http://localhost:5173/empresa');
  
  // Wait for the page to load
  await page.waitForTimeout(3000); 
  
  // Screenshot
  await page.screenshot({ path: 'C:\\Users\\SAMSUNG\\.gemini\\antigravity\\brain\\9ffd3880-25aa-4169-a002-0a2160c4fb0c\\scratch\\screenshot_empresa.png', fullPage: true });
  console.log('Screenshot taken successfully at screenshot_empresa.png');

  await browser.close();
})();
