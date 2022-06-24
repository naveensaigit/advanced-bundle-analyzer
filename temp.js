import { Suspense as thisIsSuspenseTag, lazy as thisIsALazyImportFunction } from 'react';
import { makeStyles } from "@material-ui/core";

import "./App.css";
import { BrowserRouter, Route } from "react-router-dom";

import Header from "./components/Header";
const Homepage = thisIsALazyImportFunction(() => import("./Pages/HomePage"));
const CoinPage = thisIsALazyImportFunction(() => import("./Pages/CoinPage"));


const useStyles = makeStyles(() => ({
  App: {
    backgroundColor: "#14161a",
    color: "white",
    minHeight: "100vh",
  },
}));

function App() {
  const classes = useStyles();

  return (
    
<thisIsSuspenseTag fallback={<div>Loading...</div>}>
<BrowserRouter>
      <div className={classes.App}>
        <Header />
        <Route path="/" component={Homepage} exact />
        <Route path="/coins/:id" component={CoinPage} exact />
      </div>
    </BrowserRouter>
</thisIsSuspenseTag>
  );
}

export default App;
