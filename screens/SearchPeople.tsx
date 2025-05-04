import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { TextInput, List, ActivityIndicator } from 'react-native-paper';
import { supabase } from '../services/Supabase';

export default function UserSearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      if (!query.trim()) return setResults([]);
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .or(`email.ilike.%${query}%,phone.ilike.%${query}%`);
      setLoading(false);
      if (error) console.error(error);
      else setResults(data);
    };

    // simple debounce
    const timeout = setTimeout(fetch, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <View style={styles.container}>
      <TextInput
        label="Search by phone or email"
        value={query}
        onChangeText={setQuery}
        style={styles.input}
      />
      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}
      <FlatList
        data={results}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.full_name || item.email}
            description={item.phone || item.email}
            onPress={() =>
              navigation.navigate('ProfileDetail', { userId: item.id })
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { marginBottom: 12 },
});
