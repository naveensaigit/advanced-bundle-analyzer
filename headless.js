import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Function that returns a promise
// which resolves when a file is created
const fileCreated = (filename) => {
  const promise = new Promise(resolve => {
    // If file exists
    if(fs.existsSync(path.resolve(process.env.RENDER_TREE_PATH || '', filename)))
      // Resolve the promise
      resolve("File Created");
    else
      // Wait and check after desired time interval
      return setTimeout(() => resolve(fileCreated(filename)), Number(process.env.CHECK_FILE || 1000));
  });
  return promise;
}

// Function that returns a promise which resolves
// when connection to URL is established.
const waitUntilConnection = (page, url) => {
  const promise = new Promise(async resolve => {
    try {
      // Try visiting the URL
      await page.goto(url);
      // Resolve if connection is established
      resolve("Connected");
    }
    catch(err) {
      // Connection failed. Try again after desired time interval
      setTimeout(() => resolve(waitUntilConnection(page, url)), Number(process.env.REFRESH_CONN || 50));
    }
  });
  return promise;
}

// Function that opens the React app
const openReactApp = async () => {
  console.log("Started Puppeteer!");
  // Launch Puppeteer browser
  const browser = await puppeteer.launch({headless: process.env.BROWSER_HEADLESS === "true"});
  // Open a new page
  const page = await browser.newPage();
  // Wait until DevTools server starts
  await waitUntilConnection(page, 'http://localhost:8097/');
  console.log("Able to connect to DevTools Server!");

  // Add a keystroke listener for user interaction
  await page.evaluateOnNewDocument(extractKey => {
    enterPressed = false;
    document.addEventListener("keydown", function extractTree(e) {
      // If key pressed matches extract key
      if (e.code === extractKey) {
        // Remove the listener
        document.removeEventListener("keydown", extractTree);
        // Set value as true
        enterPressed = true;
        console.log("[browser] enter pressed!");
      }
    });
  }, process.env.EXTRACT_KEY);

  // Wait until React app starts
  await waitUntilConnection(page, process.env.ANALYZE_ROUTE || 'http://localhost:3000/');

  try {
    // If user interaction is set to true, wait until extract key is pressed
    if(process.env.ALLOW_USER_INTERACTION === "true")
      await page.waitForFunction("enterPressed", {timeout: 2147483647});
    // Create the signal file to signal DevTools to start extracting the render tree
    fs.writeFileSync(process.env.EXTRACT_SIGNAL_FILE || "0.tmp", '', err => '');
  }
  catch (err) {
    console.error("[node/puppeteer] enter was not pressed within the specified timeout: ", err);
  }

  // Wait until render tree file is created before closing the browser
  const filename = process.env.RENDER_TREE_FILE || "renderTree.json";
  await fileCreated(filename);
  await browser.close();
};

openReactApp();