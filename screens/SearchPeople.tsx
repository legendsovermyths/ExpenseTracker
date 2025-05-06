import React, { useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Text } from "react-native";
import { TextInput, List, ActivityIndicator, Button } from "react-native-paper";
import { supabase } from "../services/Supabase";
import DescriptionInput from "../components/DescriptionInput";
import { COLORS, SIZES, FONTS } from "../constants";

export default function UserSearchScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      if (!query.trim()) return setResults([]);
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .or(`email.ilike.%${query}%,phone.ilike.%${query}%`);
      setLoading(false);
      if (error) console.error(error);
      else setResults(data);
    };

    const timeout = setTimeout(fetch, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Search people</Text>
      </View>
      <View style={styles.container}>
        <DescriptionInput
          label="Search by phone or email"
          value={query}
          onChangeValue={setQuery}
        />
        {loading && <ActivityIndicator style={{ marginTop: 20 }} />}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <List.Item
              title={item.full_name || item.email}
              description={item.email}
              onPress={() =>
                navigation.navigate("SplitInputScreen", { userId: item.id, userName: item.full_name })
              }
            />
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  container: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    backgroundColor: COLORS.white,
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingTop: (5 * SIZES.padding) / 2,
    backgroundColor: COLORS.white,
  },
  headerText: {
    marginLeft: SIZES.padding / 6,
    color: COLORS.primary,
    ...FONTS.h1,
  },
  input: { marginBottom: 12 },
});
