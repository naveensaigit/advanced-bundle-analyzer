import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();

function fileCreated(filename = "renderTree.json") {
  const promise = new Promise((resolve, _) => {
    if(fs.existsSync(path.resolve((process.env.TREEPATH || '').trim(), filename)))
      resolve("File Created");
    else
      return setTimeout(() => resolve(fileCreated(filename)), 1000);
  });
  return promise;
}

const openReactApp = async () => {
  console.log("Started Puppeteer!");
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  await page.goto('http://localhost:8097/');
  console.log("Able to connect to DevTools Server!");
  await page.goto('http://localhost:3000/');
  await fileCreated();
  await browser.close();
};

setTimeout(openReactApp, 2000);