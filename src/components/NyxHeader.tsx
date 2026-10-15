import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export function NyxHeader() {
  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>N</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Nyx</Text>
        <Text style={styles.subtitle}>
          Companheiro digital • protótipo local
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#bfa3ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9a6cff',
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  },
  avatarText: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  copy: {
    marginLeft: 16,
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 3,
  },
});
