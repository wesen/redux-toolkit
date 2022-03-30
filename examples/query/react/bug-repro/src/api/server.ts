/* eslint-disable no-bitwise */
import { rest, setupWorker } from "msw";

const fakeCart = {
  "7242": {
    quantity: 1,
    subtotal: 99.5,
    total: 99.5,
    key: "cce5b9b382bf79ef123b83c0ed21e2e3",
    id: 7242,
    name: "Little Gem Southern Magnolia - #3 Container",
    price: 99.5
  },
  "7251": {
    quantity: 3,
    subtotal: 118.5,
    total: 118.5,
    key: "85c8532875070992708e8e24614c2f97",
    id: 7251,
    name: "Austrian Black Pine - #1 Container",
    price: 39.5
  },
  "553404": {
    quantity: 2,
    subtotal: 29.9,
    total: 29.9,
    key: "4fd85c32f846c70fefb8c9e8ffaf53f5",
    id: 553404,
    name: "Neem Oil",
    price: 14.95
  },
  "453873": {
    quantity: 2,
    subtotal: 15,
    total: 15,
    key: "05063f018a8c6395200df305c1626e25",
    id: 453873,
    name: "All-Organic Complete Fertilizer",
    price: 7.5
  },
  "453841": {
    quantity: 1,
    subtotal: 5.5,
    total: 5.5,
    key: "162f38427cdda35c2e4b1a6f6e507164",
    id: 453841,
    name: "Probiotic Root Stimulant",
    price: 5.5
  }
};

export const worker = setupWorker(
  rest.get("/wp-admin/admin-ajax.php", (req, res, ctx) => {
    const params: { [key: string]: string } = {};
    req.url.searchParams.forEach((v, k, _) => {
      params[k] = v;
    });
    const { action } = params;

    switch (action) {
      case "get_cart_contents":
        return res(ctx.delay(1000), ctx.json(fakeCart));

      default:
        return res(ctx.status(404));
    }
  })
);
