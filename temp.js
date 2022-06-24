import React from 'react';
import { Suspense , lazy } from 'react';
import { makeStyles } from "@material-ui/core";

import "./App.css";
import { BrowserRouter, Route } from "react-router-dom";

import Header from "./components/Header";
const Homepage = React.lazy(() => import("./Pages/HomePage"));
const CoinPage = React.lazy(() => import("./Pages/CoinPage"));


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
    
<Suspense fallback={<div>Loading...</div>}>
<BrowserRouter>
      <div className={classes.App}>
        <Header />
        <Route path="/" component={Homepage} exact />
        <Route path="/coins/:id" component={CoinPage} exact />
      </div>
    </BrowserRouter>
</Suspense>
  );
}

export default App;
