import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/dist/query/react";

import { Cart } from "./types";

export function create() {
  return createApi({
    reducerPath: "api",
    baseQuery: fetchBaseQuery({
      baseUrl: "/wp-admin/admin-ajax.php"
    }),
    endpoints: (builder) => ({
      getCartContents: builder.query<Cart, void>({
        query: () => ({
          url: `?${new URLSearchParams({ action: "get_cart_contents" })}`
        })
      })
    })
  });
}

export let apiSlice = create();
apiSlice = create();

export const { useGetCartContentsQuery } = apiSlice;
