import { Suspense, lazy } from "react";
import { makeStyles } from "@material-ui/core";

import "./App.css";
import { BrowserRouter as Router, Route } from "react-router-dom";

import Header from "./components/Header";

const Homepage = lazy(() => import("./Pages/HomePage"));
const CoinPage = lazy(() => import("./Pages/CoinPage"));

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
      <Router>
        <div className={classes.App}>
          <Header />
          <Route path="/" component={Homepage} exact />
          <Route path="/coins/:id" component={CoinPage} exact />
        </div>
      </Router>
    </Suspense>
  );
}

export default App;
