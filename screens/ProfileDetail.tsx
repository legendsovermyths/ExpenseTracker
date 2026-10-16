import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SPACE } from '../constants';
import { supabase } from '../services/Supabase';
import { useTheme } from '../contexts/ThemeContext';
import { Avatar, DetailHero, EmptyState, ListRow, Page, SkeletonList } from '../components/ui';

export default function ProfileDetailScreen() {
  const { COLORS } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const navigation = useNavigation();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Page title="Profile">
        <SkeletonList rows={4} />
      </Page>
    );
  }

  if (!user) {
    return (
      <Page title="Profile">
        <EmptyState
          icon="account-off-outline"
          title="No profile"
          message="We couldn't load your account details."
          actionLabel="Go back"
          onAction={() => navigation.goBack()}
        />
      </Page>
    );
  }

  const { id, email, user_metadata } = user;
  const { full_name, phone } = user_metadata || {};
  const displayName = full_name || email || 'You';

  const rows: { label: string; value: string }[] = [
    { label: 'Name', value: full_name || '—' },
    { label: 'Email', value: email || '—' },
    { label: 'Phone', value: phone || '—' },
  ];

  return (
    <Page
      title="Profile"
      hero={<DetailHero leading={<Avatar name={displayName} size={72} />} title={displayName} meta={email} />}
    >
      {rows.map((r) => (
        <View key={r.label} style={[styles.row, { borderBottomColor: COLORS.hairline }]}>
          <ListRow padded={false} title={r.label} value={r.value} />
        </View>
      ))}
      <ListRow padded={false} title="User ID" subtitle={id} style={styles.idRow} />
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: StyleSheet.hairlineWidth },
  idRow: { marginTop: SPACE.xs },
});
