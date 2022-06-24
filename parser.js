
export function removeComments(data) {
  let regex = /\/\/.*/g; //RegEx for removing single line comments
  data = data.replace(regex, "");

  regex = /\/\*(\s|.|\r\n)*?\*\//gm; //RegEx for removing multi line comments.
  data = data.replace(regex, "");

  return data;
}

export function getComponents(data) {
  var components = [];

    data = removeComments(data);

    let possibleRoutes = data.match(/<Route\s((\s|.|\r\n)*?)?(<\/|\/>)/gm);
    //possibleRoutes holds all the statements that start with a Route tag.

    for (let currentRoute of possibleRoutes) {
      if (!/component/.test(currentRoute) && !/element/.test(currentRoute)) {
        //If the currentRoute does not contain any component or element keyword, it is of the following type:
        //    <Route path={`${match.path}/:topicId`}>
        //        <Topic />
        //    </Route>

        let possibleComponent = currentRoute.match(/>((\s|.|\r\n)*?)?\/>/gm); //Refining our component to get its name by removing the route tag
        if (!possibleComponent) continue; //Checking if the component is still possible in current route

        possibleComponent =
          possibleComponent[0].match(/<((\s|.|\r\n)*?)?\/>/gm); //Refining our component to get its name by removing the route tag
        if (!possibleComponent) continue;

        possibleComponent = possibleComponent[0].match(/\w(.)*/gm); //Refining our component to get its name by removing the route tag
        if (!possibleComponent) continue;

        possibleComponent = possibleComponent[0].match(/(.)*\w/gm); //Refining our component to get its name by removing the route tag
        if (!possibleComponent) continue;

        components.push(possibleComponent[0].toString()); //Finally pushing component in components array
        continue;
      }

      let possibleComponent = currentRoute.match(/component((\s|.|\r\n)*?)?}/gm);

      if (possibleComponent) {
        //If the currentRoute contains component keyword, it is of the following type:
        //    <Route path="/" component={Homepage} exact />

        possibleComponent = possibleComponent[0].match(/{((\s|.|\r\n)*)/gm);
        if (!possibleComponent) continue;

        possibleComponent = possibleComponent[0].match(/\w(.)*/gm);
        if (!possibleComponent) continue;

        possibleComponent = possibleComponent[0].match(/(.)*\w/gm);
        if (!possibleComponent) continue;

        components.push(possibleComponent[0].toString());
      } else {
        //If the currentRoute contains element keyword, it is of the following type:
        //    <Route path="/" element = {<Homepage />} exact />

        possibleComponent = currentRoute.match(/element((\s|.|\r\n)*)/gm);
        if (!possibleComponent) continue;

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
