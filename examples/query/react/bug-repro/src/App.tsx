import { useGetCartContentsQuery } from "./api/apiSlice";
import { getCartQuantity } from "./api/cart";
import "./styles.css";

export default function App() {
  console.log("do first use get app contents");
  const { data } = useGetCartContentsQuery();
  const qty = data === undefined ? 0 : getCartQuantity(data);

  return (
    <div className="App">
      <h1>Hello CodeSandbox {qty}</h1>
      <h2>Start editing to see some magic happen!</h2>
    </div>
  );
}
