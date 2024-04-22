import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaView} from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import BankInputScreen from '../screens/BankInputScreen';
import SubscriptionInputScreen from '../screens/SubscriptionInputScreen';
import TransactionInputScreen from '../screens/TransactionInputScreen';
import { COLORS } from '../constants';

const Tab = createMaterialTopTabNavigator();

function InputScreenNavigator() {
  return (
    <SafeAreaView style={styles.container}>
      <Tab.Navigator
        swipeEnabled={false}
        tabBarOptions={{
          labelStyle: { fontSize: 14 },
          style: { backgroundColor: COLORS.lightGray },
          labelStyle: { textTransform: 'none', color: COLORS.primary },
          indicatorStyle: { backgroundColor: COLORS.primary },
          tabBarGap: 5,
          borderless: true,
          tabBarPressColo:COLORS.primary,
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
      paddingTop:  0,
      backgroundColor:COLORS.lightGray
    },
    screen: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
export default InputScreenNavigator