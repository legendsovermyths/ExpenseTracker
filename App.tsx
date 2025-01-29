import React, { useEffect, useState } from "react";
import { AppNavigator } from "./screens/";
import { useFonts } from "expo-font";
import { invokeBackend } from "./services/api";
import { Action } from "./types/actions/actions";
import { useExpensifyStore } from "./store/store";

function App() {
  const [loading, setLoading] = useState(true);
  const [loaded] = useFonts({
    "Roboto-Black": require("./assets/fonts/Roboto-Black.ttf"),
    "Roboto-Bold": require("./assets/fonts/Roboto-Bold.ttf"),
    "Roboto-Regular": require("./assets/fonts/Roboto-Regular.ttf"),
    CredFont: require("./assets/fonts/CredFont.ttf"),
    "CredFont-Bold": require("./assets/fonts/CredFont-Bold.ttf"),
  });
  const setAccounts = useExpensifyStore((state) => state.setAccounts);
  const setCategories = useExpensifyStore((state) => state.setCategories);
  const setTransactions = useExpensifyStore((state) => state.setTransactions);

  useEffect(() => {
    const fetchData = async () => {
      const response = await invokeBackend(Action.GetData, {});
      const accounts = response.additions.accounts;
      const categories = response.additions.categories;
      const transactions = response.additions.transactions;

      setAccounts(accounts);
      setCategories(categories);
      setTransactions(transactions);
      setLoading(false);
    };

    fetchData();
  }, [setTransactions, setCategories, setAccounts]);

  return <>{(!loading && loaded)? <AppNavigator /> : null}</>;
}

export default App;
