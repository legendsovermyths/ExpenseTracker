import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import BankInputScreen from '../screens/BankInputScreen';
import SubscriptionInputScreen from '../screens/SubscriptionInputScreen';
import TransactionInputScreen from '../screens/TransactionInputScreen';
import { COLORS } from '../constants';
import { View } from 'react-native';
const Tab = createMaterialTopTabNavigator();

function InputScreenNavigator() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.top, { backgroundColor: COLORS.lightGray2 }]} />
      <Tab.Navigator
        swipeEnabled={false}
        tabBarOptions={{
          labelStyle: { fontSize: 14 },
          style: { backgroundColor: COLORS.lightGray2 },
          labelStyle: { textTransform: 'none', color: COLORS.primary },
          indicatorStyle: { backgroundColor: COLORS.primary },
          tabBarGap: 5,
          borderless: true,
          tabBarPressColo: COLORS.primary,
          swipeEnabled: false,
        }}
      >
        <Tab.Screen name="Transaction" component={TransactionInputScreen} />
        <Tab.Screen name="Bank" component={BankInputScreen} />
        <Tab.Screen name="Subscription" component={SubscriptionInputScreen} />
      </Tab.Navigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 0,
    backgroundColor: COLORS.white
  },
  screen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
  },
  top: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '50%',
  },
});
export default InputScreenNavigator
