export function removeComments(data) {
  let dataWithoutComments = "";
  let commented = 0;
  let prevCharacter = "";

  for (let character of data) {
    if (!commented) {
      if (prevCharacter === "/" && character === "/") commented = 1; //Beginning of single line comments.
      if (prevCharacter === "/" && character === "*") commented = 2; //Beginning of multi line comments.
    } else {
      if (prevCharacter === "\r" && character === "\n" && commented === 1)
        commented = 0; //Ending of single line comments.
      if (prevCharacter === "*" && character === "/" && commented === 2)
        commented = 0; //Ending of single line comments.
    }

    if (!commented) dataWithoutComments += character;

    prevCharacter = character;
  }

  return dataWithoutComments;
}

export function getComponents(data) {
  const components = [];

  data = removeComments(data);

  let possibleRoutes = data.match(/<Route\s((\s|.|\r\n)*?)?(<\/|\/>)/gm);
  //possibleRoutes holds all the statements that start with a Route tag.

  if (!possibleRoutes) return [];

  for (let currentRoute of possibleRoutes) {
    if (!/component/.test(currentRoute) && !/element/.test(currentRoute)) {
      //If the currentRoute does not contain any component/element keyword.

      let possibleComponent = currentRoute.match(/>((\s|.|\r\n)*?)?\/>/gm); //Refine route statement to get possible component name by removing the route tag.
      if (!possibleComponent) continue; //If no component is present in current route statement, continue to next route statement.

      possibleComponent = possibleComponent[0].match(/<((\s|.|\r\n)*?)?\/>/gm); //Remove any component path details, if present.
      if (!possibleComponent) continue;

      possibleComponent = possibleComponent[0].match(/\w(.)*/gm); //Remove extra characters that are present at the start of component name.
      if (!possibleComponent) continue;

      possibleComponent = possibleComponent[0].match(/(.)*\w/gm); //Remove extra characters that are present at the end of component name.
      if (!possibleComponent) continue;

      components.push(possibleComponent[0].toString());
      continue;
    }

    let possibleComponent = currentRoute.match(/component((\s|.|\r\n)*?)?}/gm); //Remove Route tag & any component path details, if present.

    if (possibleComponent) {
      //If the currentRoute contains component keyword.

      possibleComponent = possibleComponent[0].match(/{((\s|.|\r\n)*)/gm); //Remove component word that is present before component name.
      if (!possibleComponent) continue;

      possibleComponent = possibleComponent[0].match(/\w(.)*/gm);
      if (!possibleComponent) continue;

      possibleComponent = possibleComponent[0].match(/(.)*\w/gm);
      if (!possibleComponent) continue;

      components.push(possibleComponent[0].toString());
    } else {
      //If the currentRoute contains element keyword.

      possibleComponent = currentRoute.match(/element((\s|.|\r\n)*)/gm); //Remove Route tag & any component path details, if present.
      if (!possibleComponent) continue;

      possibleComponent = possibleComponent[0].match(/{((\s|.|\r\n)*)/gm); //Remove element word that is present before component name.
      if (!possibleComponent) continue;

      possibleComponent = possibleComponent[0].match(/\w(.)*/gm);
      if (!possibleComponent) continue;

      possibleComponent = possibleComponent[0].match(/(.)*\w/gm);
      if (!possibleComponent) continue;

      components.push(possibleComponent[0].toString());
    }
  }

  return components;
}
