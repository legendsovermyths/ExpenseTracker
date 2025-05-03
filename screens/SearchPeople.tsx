import React, { useState } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Text,
  TouchableOpacity,
} from "react-native";
import { TextInput, Button, ActivityIndicator } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { COLORS, FONTS, SIZES } from "../constants";
import { supabase } from "../services/Supabase";

interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string;
}

const SearchPeopleScreen: React.FC = () => {
  const navigation = useNavigation();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);

    const { data, error } = await supabase
      .from<any, any>("users")
      .select("id, full_name, email, phone")
      .or(
        `full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`
      );

    setLoading(false);
    if (error) {
      alert("Error searching users: " + error.message);
    } else {
      setResults(data ?? []);
    }
  };

  const renderItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() =>console.log("pressed")
      }
    >
      <View>
        <Text style={{ ...FONTS.body3, color: COLORS.darkgray }}>
          {item.full_name}
        </Text>
        <Text style={{ ...FONTS.body4, color: COLORS.gray }}>
          {item.email || item.phone}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchSection}>
        <TextInput
          mode="outlined"
          placeholder="Search by name, email or phone"
          value={searchTerm}
          onChangeText={setSearchTerm}
          style={styles.input}
        />
        <Button
          mode="contained"
          onPress={handleSearch}
          loading={loading}
          disabled={loading}
        >
          Search
        </Button>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: SIZES.padding }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ ...FONTS.body4, color: COLORS.darkgray }}>
                No users found
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray2,
  },
  searchSection: {
    padding: SIZES.padding,
    backgroundColor: COLORS.white,
    elevation: 2,
  },
  input: {
    marginBottom: SIZES.base,
  },
  list: {
    padding: SIZES.padding,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    marginBottom: SIZES.base,
    borderRadius: 10,
    elevation: 1,
  },
  empty: {
    marginTop: 50,
    alignItems: "center",
  },
});

export default SearchPeopleScreen;
