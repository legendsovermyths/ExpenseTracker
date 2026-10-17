import React, { useState, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SPACE } from '../constants';
import { supabase } from '../services/Supabase';
import { BottomBar, Button, Field, Page, RowGroup, Text } from '../components/ui';

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState('');

  const navigation: any = useNavigation();

  useEffect(() => {
    if (email && !EMAIL_REGEX.test(email)) {
      setEmailError('Enter a valid email address');
      setValid(false);
    } else {
      setEmailError('');
      setValid(EMAIL_REGEX.test(email));
    }
  }, [email]);

  const handleSignIn = async () => {
    setLoading(true);
    setSupabaseError('');
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) {
      setSupabaseError(error.message);
      return;
    }
    navigation.navigate('OTPScreen', { email });
  };

  return (
    <Page
      title="Welcome back"
      footer={
        <BottomBar>
          <Button title="Send code" onPress={handleSignIn} disabled={!valid || loading} loading={loading} />
          <Button title="Create an account" variant="secondary" onPress={() => navigation.navigate('Profile')} />
        </BottomBar>
      }
    >
      <Text variant="body" tone="muted" style={styles.lead}>
        We'll email you a 6-digit code to sign in.
      </Text>

      <RowGroup>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="you@example.com"
          returnKeyType="go"
          onSubmitEditing={() => valid && !loading && handleSignIn()}
          error={emailError}
        />
      </RowGroup>
      {supabaseError ? (
        <Text variant="callout" tone="up" style={styles.error}>
          {supabaseError}
        </Text>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  lead: { marginBottom: SPACE.xl },
  error: { marginTop: SPACE.sm, paddingHorizontal: SPACE.lg },
});
