import { ImageSourcePropType } from 'react-native';

export const baby_car: ImageSourcePropType = require("../assets/icons/baby_car_icon.png");
export const back_arrow: ImageSourcePropType = require("../assets/icons/back_arrow_icon.png");
export const calendar: ImageSourcePropType = require("../assets/icons/calendar_icon.png");
export const chart: ImageSourcePropType = require("../assets/icons/chart_icon.png");
export const cloth_icon: ImageSourcePropType = require("../assets/icons/cloth_icon.png");
export const down_arrow: ImageSourcePropType = require("../assets/icons/down_arrow.png");
export const education: ImageSourcePropType = require("../assets/icons/education_icon.png");
export const food: ImageSourcePropType = require("../assets/icons/food_icon.png");
export const healthcare: ImageSourcePropType = require("../assets/icons/healthcare_icon.png");
export const menu: ImageSourcePropType = require("../assets/icons/menu_icon.png");
export const more: ImageSourcePropType = require("../assets/icons/more_icon.png");
export const pin: ImageSourcePropType = require("../assets/icons/pin.png");
export const sports_icon: ImageSourcePropType = require("../assets/icons/sports_icon.png");
export const up_arrow: ImageSourcePropType = require("../assets/icons/up_arrow.png");
export const plus: ImageSourcePropType = require("../assets/icons/plus.png");
export const transactions: ImageSourcePropType = require("../assets/icons/transaction.png");
export const bank: ImageSourcePropType = require("../assets/icons/bank.png");
export const bar_chart: ImageSourcePropType = require("../assets/icons/bar-chart.png");
export const cash: ImageSourcePropType = require("../assets/icons/cash.png");
export const subscription_model: ImageSourcePropType = require("../assets/icons/subscription-model.png");
export const bank2: ImageSourcePropType = require("../assets/icons/bank2.png");
export const subscription: ImageSourcePropType = require("../assets/icons/subscription.png");
export const transfer_money: ImageSourcePropType = require("../assets/icons/transfer-money.png");
export const shopping_cart: ImageSourcePropType = require("../assets/icons/shopping-cart.png");
export const personal_care: ImageSourcePropType = require("../assets/icons/self-confident.png");
export const video: ImageSourcePropType = require("../assets/icons/video.png");
export const application: ImageSourcePropType = require("../assets/icons/application.png");
export const transport: ImageSourcePropType = require("../assets/icons/transport.png");
export const home: ImageSourcePropType = require("../assets/icons/home.png");
export const bill: ImageSourcePropType = require("../assets/icons/bill.png");
export const check: ImageSourcePropType = require("../assets/icons/check.png");
export const tick: ImageSourcePropType = require("../assets/icons/tick.png");
export const setting: ImageSourcePropType = require("../assets/icons/settings.png");
export const baricon: ImageSourcePropType = require("../assets/icons/barIcon.png");
export const appicon: ImageSourcePropType = require("../assets/icon.png");
// Logo with transparent background — use inside the app UI so it sits on any
// theme color (appicon has a baked-in white bg and is only for the app icon).
export const applogo: ImageSourcePropType = require("../assets/logo-transparent.png");

interface Icons {
  [key: string]: ImageSourcePropType;
}

const icons: Icons = {
  appicon,
  applogo,
  baricon,
  setting,
  tick,
  check,
  personal_care,
  video,
  shopping_cart,
  transport,
  application,
  home,
  bill,
  subscription,
  bank2,
  transfer_money,
  subscription_model,
  transactions,
  bank,
  bar_chart,
  cash,
  plus,
  baby_car,
  back_arrow,
  calendar,
  chart,
  cloth_icon,
  down_arrow,
  education,
  food,
  healthcare,
  menu,
  more,
  pin,
  sports_icon,
  up_arrow,
};

export default icons;
