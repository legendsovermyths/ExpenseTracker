import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SIZES } from '../constants';
import { supabase } from '../services/Supabase';

export default function ProfileDetailScreen() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const navigation = useNavigation();

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (data.user) setUser(data.user);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={FONTS.body4}>No user info available.</Text>
        <Button onPress={() => navigation.goBack()}>Go Back</Button>
      </View>
    );
  }

  const { id, email, user_metadata } = user;
  const { full_name, phone } = user_metadata || {};

  return (
    <View style={styles.container}>
      <Text style={[FONTS.h1, { color: COLORS.primary }]}>
        Your Profile
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>User ID</Text>
        <Text style={styles.value}>{id}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{full_name || '—'}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{email}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Phone</Text>
        <Text style={styles.value}>{phone || '—'}</Text>
      </View>

      <Button
        mode="contained"
        onPress={() => navigation.goBack()}
        style={styles.button}
        labelStyle={{ color: COLORS.white }}
      >
        Close
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SIZES.padding * 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  field: {
    marginTop: SIZES.padding,
  },
  label: {
    ...FONTS.body4,
    color: COLORS.darkgray,
  },
  value: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
  button: {
    marginTop: SIZES.padding * 2,
    backgroundColor: COLORS.primary,
  },
});
