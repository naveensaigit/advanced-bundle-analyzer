export function removeComments(data) {
  let regex =/\/\/.*/g;
  data = data.replace(regex, "");
  regex = /\/\*(\s|.|\r\n)*?\*\//gm;
  data = data.replace(regex, "");

  return data;
}

export function getComponents(data) {
  let components = [];
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

      components.push(comp[0]);
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
      components.push(comp[0]);
    } else {
      comp = match.match(/element((\s|.|\r\n)*)/gm);
      if (!comp) continue;
      comp = comp[0].match(/{((\s|.|\r\n)*)/gm);
      if (!comp) continue;
      comp = comp[0].match(/\w(.)*/gm);
      if (!comp) continue;
      comp = comp[0].match(/(.)*\w/gm);
      if (!comp) continue;
      components.push(comp[0].split(" ")[0]);
    }
  }

  return components;
}