import puppeteer from 'puppeteer';
import fs from 'fs';

async function run() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  await page.goto('http://localhost:3000');
  
  console.log('Waiting for library button...');
  // Find library button (it has Library text)
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button, div'));
    return buttons.some(b => b.textContent?.includes('Library'));
  }, { timeout: 10000 });
  
  // Click Library button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, div'));
    const btn = buttons.find(b => b.textContent?.includes('Library') && (b.tagName === 'BUTTON' || b.getAttribute('role') === 'button' || b.className.includes('nav')));
    if (btn) btn.click();
  });
  
  console.log('Waiting for file input to exist...');
  await new Promise(r => setTimeout(r, 2000));
  
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    console.log('Found file input, uploading file...');
    fs.writeFileSync('test.pdf', 'dummy content');
    await fileInput.uploadFile('test.pdf');
    console.log('File uploaded. Waiting...');
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('Clicking summarize...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const summarizeBtn = buttons.find(b => b.textContent?.includes('Summarize'));
      if (summarizeBtn) summarizeBtn.click();
      else console.log('Summarize button not found');
    });
    
    await new Promise(r => setTimeout(r, 3000));
    console.log('Done.');
  } else {
    console.log('File input not found.');
  }
  
  await browser.close();
}

run().catch(console.error);
