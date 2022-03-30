import { Cart } from "./types";

export const getCartQuantity = (cart: Cart): number =>
  Object.values(cart).reduce((price, entry) => price + entry.quantity, 0);
