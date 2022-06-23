// write to js file
const fs = require("fs");

function modify(data) {
  //console.log(components);
  console.log(imports);
  // console.log(data);

  let x = "", y = "";

  let lazyLoadSyntax = `const ${x} = lazy(() => import(${y}));`;
  let ok = 0;
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
        //console.log(data);
      }
    }
  }

  for (let importLine of imports) {
      if(data.search(importLine.import) == -1)    continue;

      if(index < data.search(importLine.import)+importLine.import.length+1)
      index = data.search(importLine.import)+importLine.import.length+1;
      //console.log(data);
  }

  let result = add.join('\r\n');
  data = data.slice(0, index) + '\r\n' + result + '\r\n' + data.slice(index);

  if (!ok) data = "import { Suspense, lazy } from 'react';\r\n" + data;

  fs.writeFile("./scripts/temp.js", data, (err) => {
    if (err) {
      console.error(err);
      return;
    }
    //console.log("file written successfully");
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
