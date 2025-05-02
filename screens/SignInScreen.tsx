import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SIZES } from '../constants';
import { supabase } from '../services/Supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState('');

  const navigation: any = useNavigation();
  const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Welcome back!</Text>
        <Text style={styles.subtitle}>Sign in to your account with email</Text>

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          mode="outlined"
          style={styles.input}
          outlineColor={COLORS.lightGray}
          activeOutlineColor={COLORS.primary}
          placeholder="you@example.com"
        />
        {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        {supabaseError ? <Text style={styles.errorText}>{supabaseError}</Text> : null}

        <Button
          mode="contained"
          onPress={handleSignIn}
          disabled={!valid || loading}
          loading={loading}
          contentStyle={styles.buttonContent}
          style={[
            styles.button,
            valid && !loading
              ? { backgroundColor: COLORS.primary }
              : { backgroundColor: COLORS.lightGray },
          ]}
          labelStyle={{ ...FONTS.h3, color: COLORS.white }}
        >
          {loading ? 'Sending...' : 'Send OTP'}
        </Button>

        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Text style={{ ...FONTS.body4, color: COLORS.primary, textAlign: 'center', marginTop: SIZES.padding }}>
            New here? <Text style={{ fontWeight: 'bold' }}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    paddingHorizontal: SIZES.padding,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: SIZES.padding * 2,
    elevation: 3,
  },
  title: {
    ...FONTS.h1,
    color: COLORS.primary,
  },
  subtitle: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginTop: SIZES.base,
  },
  input: {
    backgroundColor: COLORS.white,
    marginTop: SIZES.padding/2,
  },
  errorText: {
    ...FONTS.body4,
    color: COLORS.red2,
    marginTop: SIZES.base / 2,
  },
  buttonContent: {
    height: 50,
  },
  button: {
    marginTop: SIZES.padding,
    borderRadius: 10,
  },
});
