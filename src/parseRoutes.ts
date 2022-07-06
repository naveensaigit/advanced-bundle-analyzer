import fs from "fs";
import { removeComments } from "./utils.js";

export function getComponents(filePath: string): string[] {
  const code: string = fs.readFileSync(filePath, "utf8");
  const data = removeComments(code);

  let components: string[] = [];

  type RegEx = RegExpMatchArray | null;

  // Holds all the statements that start with a Route tag.
  const possibleRoutes: RegEx = data.match(/<Route\s((\s|.|\r\n)*?)?(<\/|\/>)/gm);

  if (!possibleRoutes) return [];

  let possibleComponent: RegEx;

  for (const currentRoute of possibleRoutes) {

    //If the currentRoute does not contain any component/element keyword.
    if (!/component/.test(currentRoute) && !/element/.test(currentRoute)) {

      //Refine route statement to get possible component name by removing the route tag.
      possibleComponent = currentRoute.match(/>((\s|.|\r\n)*?)?\/>/gm);
      //If no component is present in current route statement, continue to next route statement.
      if (!possibleComponent) continue;

      //Remove any component path details, if present.
      possibleComponent = possibleComponent[0].match(/<((\s|.|\r\n)*?)?\/>/gm);
      if (!possibleComponent) continue;

      //Remove extra characters that are present at the start of component name.
      possibleComponent = possibleComponent[0].match(/\w(.)*/gm);
      if (!possibleComponent) continue;

      //Remove extra characters that are present at the end of component name.
      possibleComponent = possibleComponent[0].match(/(.)*\w/gm);
      if (!possibleComponent) continue;

      components.push(possibleComponent[0].toString());
      continue;
    }

    //Remove '<Route' tag & any component path details, if present.
    possibleComponent = currentRoute.match(/component((\s|.|\r\n)*?)?}/gm);

    //If the currentRoute contains component keyword.
    if (possibleComponent) {

      //Remove 'component' word that is present before component name.
      possibleComponent = possibleComponent[0].match(/{((\s|.|\r\n)*)/gm);
      if (!possibleComponent) continue;

      possibleComponent = possibleComponent[0].match(/\w(.)*/gm);
      if (!possibleComponent) continue;

      possibleComponent = possibleComponent[0].match(/(.)*\w/gm);
      if (!possibleComponent) continue;

      components.push(possibleComponent[0].toString());
    }

    //If the currentRoute contains element keyword.
    else {

      //Remove '<Route' tag & any component path details, if present.
      possibleComponent = currentRoute.match(/element((\s|.|\r\n)*)/gm);
      if (!possibleComponent) continue;

      //Remove 'element' word that is present before component name.
      possibleComponent = possibleComponent[0].match(/{((\s|.|\r\n)*)/gm);
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
