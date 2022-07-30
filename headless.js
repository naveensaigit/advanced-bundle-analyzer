import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const fileCreated = (filename) => {
  const promise = new Promise(resolve => {
    if(fs.existsSync(path.resolve(process.env.RENDER_TREE_PATH || '', filename)))
      resolve("File Created");
    else
      return setTimeout(() => resolve(fileCreated(filename)), Number(process.env.CHECK_FILE || 1000));
  });
  return promise;
}

const waitUntilConnection = (page, url) => {
  const promise = new Promise(async resolve => {
    try {
      await page.goto(url);
      resolve("Connected");
    }
    catch(err) {
      setTimeout(() => resolve(waitUntilConnection(page, url)), Number(process.env.REFRESH_CONN || 50));
    }
  });
  return promise;
}

const openReactApp = async () => {
  console.log("Started Puppeteer!");
  const browser = await puppeteer.launch({headless: process.env.BROWSER_HEADLESS === "true"});
  const page = await browser.newPage();
  await waitUntilConnection(page, 'http://localhost:8097/');
  console.log("Able to connect to DevTools Server!");

  await page.evaluateOnNewDocument(extractKey => {
    enterPressed = false;
    document.addEventListener("keydown", function extractTree(e) {
      if (e.code === extractKey) {
        document.removeEventListener("keydown", extractTree);
        enterPressed = true;
        console.log("[browser] enter pressed!");
      }
    });
  }, process.env.EXTRACT_KEY);

  await waitUntilConnection(page, process.env.ANALYZE_ROUTE || 'http://localhost:3000/');

  try {
    if(process.env.ALLOW_USER_INTERACTION === "true")
      await page.waitForFunction("enterPressed", {timeout: 2147483647});
    fs.writeFileSync(process.env.EXTRACT_SIGNAL_FILE || "0.tmp", '', err => '');
  }
  catch (err) {
    console.error("[node/puppeteer] enter was not pressed within the specified timeout: ", err);
  }

  const filename = process.env.RENDER_TREE_FILE || "renderTree.json";
  await fileCreated(filename);
  await browser.close();
};

openReactApp();