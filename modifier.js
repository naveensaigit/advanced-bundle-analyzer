// write to js file
const fs = require("fs");

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
  //console.log(components);
  //console.log(imports);
  //console.log(data);

  let x = "";
  let y = "";

  let lazyLoadSyntax = `const ${x} = lazy(() => import(${y}));`;
  let isSuspense = 0;
  let isLazy = 0;
  let index = 0;

  let add = [];

  for (let component of components) {
    for (let importLine of imports) {
      if (component == importLine.defaultExp) {
        x = component;
        y = importLine.module;
        lazyLoadSyntax = `const ${x} = lazy(() => import(${y}));`;
        add.push(lazyLoadSyntax);
        data = data.replace(importLine.import, "");
      }
    }
  }

  let br = "BrowserRouter";
  let mr = "MemoryRouter";
  let hr = "HashRouter";

  for (let importLine of imports) {
    let str = importLine.namedExps;

    if (str != "null") {
      let arr = JSON.parse(str);

      if (arr[0].alias == "BrowserRouter") br = arr[0].namedExp;
      if (arr[0].alias == "MemoryRouter") mr = arr[0].namedExp;
      if (arr[0].alias == "HashRouter") hr = arr[0].namedExp;

      for (let nameExport of arr) {
        if (nameExport.namedExp == "Suspense") isSuspense = 1;
        if (nameExport.namedExp == "lazy") isLazy = 1;

        for (let component of components) {
          if (nameExport.namedExp == component) {
            x = component;
            y = importLine.module;
            lazyLoadSyntax = `const ${x} = lazy(async () => {
              const resolved = await import(${y});
              return {default: resolved['${x}']}
            })`;
            add.push(lazyLoadSyntax);
            data = data.replace(importLine.import, "");
          }
        }
      }

      //console.log();
    }
    if (data.search(importLine.import) == -1) continue;

    if (index < data.search(importLine.import) + importLine.import.length + 1)
      index = data.search(importLine.import) + importLine.import.length + 1;
  }

  let result = add.join("\r\n");
  data = data.slice(0, index) + "\r\n" + result + "\r\n" + data.slice(index);

  if (!isSuspense && !isLazy)
    data = "import { Suspense, lazy } from 'react';\r\n" + data;
  else if (!isSuspense) data = "import { Suspense } from 'react';\r\n" + data;
  else if (!isLazy) data = "import { lazy } from 'react';\r\n" + data;

  data = addSyntax(data, br);
  data = addSyntax(data, mr);
  data = addSyntax(data, hr);

  fs.writeFile("./scripts/temp.js", data, (err) => {
    if (err) {
      console.error(err);
      return;
    }
  });
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// CODE FROM COMPONENT PARSER
let filePath = "";

process.argv.forEach(function (val, index, array) {
  if (index === 2) filePath = val;
});

function removeComments(data) {
  let regex = /\/\/.*/g;
  data = data.replace(regex, "");
  regex = /\/\*(\s|.|\r\n)*?\*\//gm;
  data = data.replace(regex, "");

  return data;
}

var components = [];

function getComponents(data) {
  data = removeComments(data);

  let matches = data.match(/<Route\s((\s|.|\r\n)*?)?(<\/|\/>)/gm);

  for (let match of matches) {
    if (!/component/.test(match) && !/element/.test(match)) {
      let comp = match.match(/>((\s|.|\r\n)*?)?\/>/gm);
      if (!comp) continue;
      comp = comp[0].match(/<((\s|.|\r\n)*?)?\/>/gm);
      if (!comp) continue;
      comp = comp[0].match(/\w(.)*/gm);
      if (!comp) continue;
      comp = comp[0].match(/(.)*\w/gm);
      if (!comp) continue;

      components.push(comp[0].toString());
      continue;
    }

    let comp = match.match(/component((\s|.|\r\n)*?)?}/gm);

    if (comp) {
      comp = comp[0].match(/{((\s|.|\r\n)*)/gm);
      if (!comp) continue;
      comp = comp[0].match(/\w(.)*/gm);
      if (!comp) continue;
      comp = comp[0].match(/(.)*\w/gm);
      if (!comp) continue;
      components.push(comp[0].toString());
    } else {
      comp = match.match(/element((\s|.|\r\n)*)/gm);
      if (!comp) continue;
      comp = comp[0].match(/{((\s|.|\r\n)*)/gm);
      if (!comp) continue;
      comp = comp[0].match(/\w(.)*/gm);
      if (!comp) continue;
      comp = comp[0].match(/(.)*\w/gm);
      if (!comp) continue;
      components.push(comp[0].toString());
    }
  }
}

function removeFileImports(text) {
  let reg = /import((\r\n|\s)*?)?('|")(.*)('|");/gm;
  return text.replace(reg, "");
}

let imports = [];

function getImports(text) {
  text = removeComments(text);
  text = removeFileImports(text);

  let reg = new RegExp("import((.|\r\n|\\s)*?)?from((.|\r\n|\\s)*?)?;", "gm"),
    match;
  do {
    match = reg.exec(text);
    if (match) {
      let module = match[3].match(/('|")(.*)('|")/gm)[0];
      let stmt = match[0];

      let namedExps = new RegExp("{((.|\r\n|\\s)*?)}", "gm");
      namedExps = namedExps.exec(stmt);
      if (namedExps) {
        namedExps = namedExps[1].split(",");
        namedExps = namedExps.map((e) => {
          e = e.replaceAll("\n", "").split(" ");
          let alias = "",
            namedExp = "";
          for (let i of e) {
            if (i != "" && i != "as") {
              if (alias == "") alias = i;
              else namedExp = i;
            }
          }
          if (namedExp == "") return { namedExp: alias };
          return { alias, namedExp };
        });
      }

      let defaultExp = new RegExp(
        "(import|,)((\r\n|\\s)*?)?(\\w*)((\r\n|\\s)*?)?(,|from)",
        "gm"
      );
      defaultExp = defaultExp.exec(stmt);
      if (defaultExp) defaultExp = defaultExp[4].trim().replaceAll("\n", "");

      let namespaceExp = new RegExp(
        "\\*((.|\r\n|\\s)*?)?as((.|\r\n|\\s)*?)?((.|\r\n|\\s)*?)(,|from)",
        "gm"
      );
      namespaceExp = namespaceExp.exec(stmt);
      if (namespaceExp)
        namespaceExp = namespaceExp[5].trim().replaceAll("\n", "");

      imports.push({
        import: stmt,
        defaultExp,
        namedExps: JSON.stringify(namedExps),
        namespaceExp,
        module,
      });
    }
  } while (match);
}

fs.readFile(filePath, (err, e) => {
  if (err) throw err;

  let data = e.toString();
  getComponents(data);
  getImports(data);
  modify(data);
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////
