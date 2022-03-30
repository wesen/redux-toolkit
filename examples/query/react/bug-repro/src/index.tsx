import { render } from "react-dom";
import { Provider } from "react-redux";

import App from "./App";

import "./styles.css";

import { worker } from "./api/server";
import { getStoreInstance } from "./store";
import { apiSlice } from "./api/apiSlice";
import { calculateProvidedBy } from "@reduxjs/toolkit/dist/query/endpointDefinitions";

const appReady = worker.start({
  onUnhandledRequest: ({ method, url }) => {
    if (url.pathname.startsWith("/api")) {
      throw new Error(`Unhandled ${method} request to ${url}`);
    }
  }
});

const fetchCart = async () => {
  const store = getStoreInstance();
  const res = store.dispatch(
    apiSlice.endpoints.getCartContents.initiate(undefined, {})
  );
  res.refetch();
  const res2 = store.dispatch(apiSlice.endpoints.getCartContents.initiate());
  console.log("res", res);
  console.log("res2", res2);
  const result2 = await res2;

  console.log("result await", result2);
  const result = await res;
  console.log("result await", result);
};

appReady.then(async () => {
  console.log("foobar");

  const rootElement = document.getElementById("root");
  render(
    <button
      onClick={() => {
        fetchCart();
      }}
    >
      Foobar
    </button>,
    rootElement
  );

  fetchCart();
});
