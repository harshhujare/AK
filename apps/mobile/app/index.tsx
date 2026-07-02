import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';

/**
 * Phase 0 index screen — renders plain "AjitSir Academy" placeholder text.
 * No auth, no navigation complexity. Just proves the build pipeline works.
 */
export default function HomeScreen() {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '(not set)';

  return (
    <>
      <Stack.Screen options={{ title: 'AjitSir Academy' }} />
      <View style={styles.container}>
        <Text style={styles.title}>AjitSir Academy</Text>
        <Text style={styles.subtitle}>Phase 0 — Foundation ✓</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>App Version</Text>
          <Text style={styles.infoValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          <Text style={styles.infoLabel}>API URL</Text>
          <Text style={styles.infoValue}>{apiUrl}</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#38bdf8',
    marginTop: 8,
    textAlign: 'center',
  },
  infoBox: {
    marginTop: 48,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    gap: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 12,
  },
  infoValue: {
    fontSize: 14,
    color: '#cbd5e1',
    fontFamily: 'monospace',
  },
});
