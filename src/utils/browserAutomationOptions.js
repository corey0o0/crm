/**
 * 브라우저 자동화 도구 옵션
 * Playwright 외에 사용할 수 있는 다른 브라우저 자동화 도구들을 정리합니다.
 */

/**
 * 사용 가능한 브라우저 자동화 도구
 */
export const BROWSER_AUTOMATION_TOOLS = {
  PLAYWRIGHT: 'playwright',
  PUPPETEER: 'puppeteer',
  SELENIUM: 'selenium',
  CYPRESS: 'cypress'
};

/**
 * 브라우저 자동화 도구별 특징
 */
export const TOOL_FEATURES = {
  [BROWSER_AUTOMATION_TOOLS.PLAYWRIGHT]: {
    name: 'Playwright',
    browsers: ['Chrome', 'Firefox', 'Safari'],
    speed: 'fast',
    api: 'modern',
    mcpSupport: true,
    recommended: true
  },
  [BROWSER_AUTOMATION_TOOLS.PUPPETEER]: {
    name: 'Puppeteer',
    browsers: ['Chrome', 'Chromium'],
    speed: 'very-fast',
    api: 'simple',
    mcpSupport: false,
    recommended: false
  },
  [BROWSER_AUTOMATION_TOOLS.SELENIUM]: {
    name: 'Selenium',
    browsers: ['Chrome', 'Firefox', 'Safari', 'Edge'],
    speed: 'medium',
    api: 'complex',
    mcpSupport: false,
    recommended: false
  },
  [BROWSER_AUTOMATION_TOOLS.CYPRESS]: {
    name: 'Cypress',
    browsers: ['Chrome', 'Firefox', 'Edge'],
    speed: 'medium',
    api: 'test-focused',
    mcpSupport: false,
    recommended: false
  }
};

/**
 * 브라우저 자동화 도구 선택 가이드
 */
export const getRecommendedTool = (requirements) => {
  const {
    needMultipleBrowsers = false,
    needMCP = true,
    needSpeed = true,
    needStability = false
  } = requirements;

  if (needMCP) {
    return BROWSER_AUTOMATION_TOOLS.PLAYWRIGHT;
  }

  if (needMultipleBrowsers && needStability) {
    return BROWSER_AUTOMATION_TOOLS.SELENIUM;
  }

  if (needSpeed && !needMultipleBrowsers) {
    return BROWSER_AUTOMATION_TOOLS.PUPPETEER;
  }

  return BROWSER_AUTOMATION_TOOLS.PLAYWRIGHT;
};

/**
 * 도구별 사용 예시
 */
export const TOOL_EXAMPLES = {
  [BROWSER_AUTOMATION_TOOLS.PLAYWRIGHT]: `
// Playwright 사용 예시
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('https://www.xrider.co.kr');
await page.fill('input[name="search"]', '부품명');
await page.click('button.search');
await browser.close();
  `,
  [BROWSER_AUTOMATION_TOOLS.PUPPETEER]: `
// Puppeteer 사용 예시
const puppeteer = require('puppeteer');

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();
await page.goto('https://www.xrider.co.kr');
await page.type('input[name="search"]', '부품명');
await page.click('button.search');
await browser.close();
  `,
  [BROWSER_AUTOMATION_TOOLS.SELENIUM]: `
// Selenium 사용 예시
const { Builder, By } = require('selenium-webdriver');

const driver = await new Builder().forBrowser('chrome').build();
await driver.get('https://www.xrider.co.kr');
await driver.findElement(By.name('search')).sendKeys('부품명');
await driver.findElement(By.css('button.search')).click();
await driver.quit();
  `
};

