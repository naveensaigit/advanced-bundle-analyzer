export function removeComments(data) {
  let regex = /\/\/.*/g;
  data = data.replace(regex, "");
  regex = /\/\*(\s|.|\r\n)*?\*\//gm;
  data = data.replace(regex, "");

  return data;
}

export function removeFileImports(text) {
  let reg = /import((\r\n|\s)*?)?('|")(.*)('|");/gm;
  return text.replace(reg, "");
}

export function stringToNamedExps(str) {
  str = str.replaceAll("\n", "").split(" ");
  let alias, namedExp;

  for (let i of str) {
    if (i != '' && i != 'as') {
      if (!namedExp)
        namedExp = i;
      else {
        alias = i;
        break;
      }
    }
  }

  return { alias, namedExp };
}

export function namedExpsToString(namedExps) {
  let str = "{";

  for(let named of namedExps) {
    if(named.alias != undefined)
      str += `${named.namedExp} as ${named.alias}, `;
    else
      str += `${named.namedExp}, `;
  }

  return str.slice(0, -2) + "}";
}

export function getNamedExps(stmt) {
  let namedExps = new RegExp("{((.|\r\n|\\s)*?)}", "gm");
  namedExps = namedExps.exec(stmt);

  if (namedExps) {
    namedExps = namedExps[1].split(",");
    namedExps = namedExps.map(stringToNamedExps);
  }

  return namedExps;
}

export function getDefaultExp(stmt) {
  let defaultExp = new RegExp("(import|,)((\r\n|\\s)*?)?(\\w*)((\r\n|\\s)*?)?(,|from)", "gm");
  defaultExp = defaultExp.exec(stmt);

  if (defaultExp)
    defaultExp = defaultExp[4].trim().replaceAll("\n", "");

  return defaultExp;
}

export function getNamespaceExp(stmt) {
  let namespaceExp = new RegExp("\\*((.|\r\n|\\s)*?)?as((.|\r\n|\\s)*?)?((.|\r\n|\\s)*?)(,|from)", "gm");
  namespaceExp = namespaceExp.exec(stmt);

  if (namespaceExp)
    namespaceExp = namespaceExp[5].trim().replaceAll("\n", "");

  return namespaceExp;
}

export function importToObj(imp) {
  let module = imp[3].match(/('|")(.*)('|")/gm)[0];
  let stmt = imp[0];

  let namedExps = getNamedExps(stmt);

  let defaultExp = getDefaultExp(stmt);

  let namespaceExp = getNamespaceExp(stmt);

  return {
    import: stmt,
    defaultExp,
    namedExps: namedExps,
    namespaceExp,
    module
  };
}

export function objToImport(obj) {
  let isDef = (obj.defaultExp != null);
  let isNamespace = (obj.namespaceExp != null);
  let isNamed = (obj.namedExps != null);

  if(!(isDef || isNamespace || isNamed))
    return "";

  let namedStr = isNamed ? namedExpsToString(obj.namedExps) : "";
  let stmt = "import ";

  if(isDef)
    stmt += obj.defaultExp;

  if(isNamespace)
    stmt += (isDef ? ", " : "") + "* as " + obj.namespaceExp;

  if(isNamed)
    stmt += ((isDef || isNamespace) ? ", " : "") + namedStr;

  stmt += ` from ${obj.module};`;

  return stmt;
}

export function isPresent(comp, imp) {
  if(comp == imp.defaultExp)
    return ['default'];
  else if(imp.namedExps != null)
    for(let named of imp.namedExps) {
      if(named.alias != null) {
        if(comp == named.alias)
          return ['alias', named];
      }
      else if(comp == named.namedExp)
        return ['namedExp', named];
    }
  return false;
}

export function removeComp(comp, impType, imp) {
  if(impType[0] == 'default')
    imp.defaultExp = null;
  else {
    imp.namedExps = imp.namedExps.filter(e => e[impType[0]] != comp);
    if(imp.namedExps.length == 0)
      imp.namedExps = null;
  }
  return imp;
}

export function getLazyCode(comp, impType, path) {
  switch(impType[0]) {
    case 'default':
      return `const ${comp} = ReactLazyAliased(() => import(${path}));\n`;

    case 'namedExp':
      return `const ${comp} = ReactLazyAliased(async () => {
        const resolved = await import(${path});
        return {default: resolved["${comp}"]};
      });\n`;

    case 'alias':
      return `const ${comp} = ReactLazyAliased(async () => {
        const resolved = await import(${path});
        return {default: resolved["${impType[1].namedExp}"]};
      });\n`;
    
    default: "";
  }
}

export function getImports(text) {
  let imports = [], match;
  text = removeComments(text);
  text = removeFileImports(text);

  let reg = new RegExp("import((.|\r\n|\\s)*?)?from((.|\r\n|\\s)*?)?;", "gm");
  do {
    match = reg.exec(text);
    if (match) {
      let importObj = importToObj(match);
      // importObj.import1 = objToImport(importObj);
      imports.push(importObj);
    }
  } while (match);

  return imports;
}
