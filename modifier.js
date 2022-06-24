// write to js file
// Requiring fs module in which readFile function is defined.
import { getComponents } from "./parser.js";
import { getImports } from './parseImports.js';
import fs from "fs";

let filePath = process.argv[2];
let writePath = process.argv[3];
let imports = [],
  components = [];

function addSyntax(data, router) {
  let start = `<${router}>`;
  let end = `</${router}>`;

  let startIndex = data.indexOf(start);

  if (startIndex != -1) {
    data =
      data.slice(0, startIndex) +
      "\r\n<Suspense fallback={<div>Loading...</div>}>\r\n" +
      data.slice(startIndex);
    let endIndex = data.lastIndexOf(end) + end.length;
    data = data.slice(0, endIndex) + "\r\n</Suspense>" + data.slice(endIndex);
  }

  return data;
}

function modify(data) {
  let x = "";
  let y = "";

  let lazyLoadSyntax = `const ${x} = React.lazy(() => import(${y}));`;
  let isSuspense = 0;
  let isLazy = 0;
  let index = 0;
  let isReact = 0;

  let add = [];

  for (let component of components) {
    for (let importLine of imports) {
      if (component == importLine.defaultExp) {
        x = component;
        y = importLine.module;
        lazyLoadSyntax = `const ${x} = React.lazy(() => import(${y}));`;
        add.push(lazyLoadSyntax);
        data = data.replace(importLine.import, "");
      }
    }
  }

  let br = "BrowserRouter";
  let mr = "MemoryRouter";
  let hr = "HashRouter";

  for (let importLine of imports) {
    if (importLine.defaultExp == "React") isReact = 1;

    let str = importLine.namedExps;

    if (str != "null"  &&  str.length) {
      let arr = JSON.parse(str);

      if (arr[0].alias == "BrowserRouter") br = arr[0].namedExp;
      if (arr[0].alias == "MemoryRouter") mr = arr[0].namedExp;
      if (arr[0].alias == "HashRouter") hr = arr[0].namedExp;

      for (let nameExport of arr) {
        if (nameExport.namedExp == "Suspense" || nameExport.alias == "Suspense")
          isSuspense = 1;
        if (nameExport.namedExp == "lazy" || nameExport.alias == "lazy")
          isLazy = 1;

        for (let component of components) {
          if (nameExport.namedExp == component) {
            x = component;
            y = importLine.module;
            lazyLoadSyntax = `const ${x} = React.lazy(async () => {
              const resolved = await import(${y});
              return {default: resolved['${x}']}
            })`;
            add.push(lazyLoadSyntax);
            data = data.replace(importLine.import, "");
          }
        }
      }
    }
    if (data.search(importLine.import) == -1) continue;

    if (index < data.search(importLine.import) + importLine.import.length + 1)
      index = data.search(importLine.import) + importLine.import.length + 1;
  }

  let result = add.join("\r\n");
  data = data.slice(0, index) + "\r\n" + result + "\r\n" + data.slice(index);

  if (!isSuspense && !isLazy)
    data = "import { Suspense , lazy } from 'react';\r\n" + data;
  else if (!isSuspense) data = "import { Suspense } from 'react';\r\n" + data;
  else if (!isLazy) data = "import { lazy } from 'react';\r\n" + data;

  if (!isReact) data = "import React from 'react';\r\n" + data;

  data = addSyntax(data, br);
  data = addSyntax(data, mr);
  data = addSyntax(data, hr);

  fs.writeFile(writePath, data, (err) => {
    if (err) {
      console.error(err);
      return;
    }
  });
}

fs.readFile(filePath, (err, e) => {
  if (err) throw err;

  let code = e.toString();
  components = getComponents(code);
  imports = getImports(code);
  modify(code);
});
