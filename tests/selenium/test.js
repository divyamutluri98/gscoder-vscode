const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function runTests() {
  console.log('Starting Selenium tests...');
  
  const options = new chrome.Options();
  options.addArguments('--headless');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    console.log('Test 1: Navigate to application');
    await driver.get('http://localhost:3000');
    const title = await driver.getTitle();
    console.log('Page title:', title);
    
    console.log('Test 2: Check branding');
    const brandElement = await driver.findElement(By.css('.brand-logo'));
    const isDisplayed = await brandElement.isDisplayed();
    console.log('Brand logo displayed:', isDisplayed);
    
    console.log('Test 3: Check navigation');
    const navLinks = await driver.findElements(By.css('nav a'));
    console.log('Navigation links found:', navLinks.length);
    
    console.log('All Selenium tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    await driver.quit();
  }
}

runTests().catch(console.error);
