import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { G, Path, Polygon, Rect } from "react-native-svg";
import { COLORS, FONTS, SIZES } from "../constants";
import {
  formatAmountWithCommas,
  getFormattedDateWithYear,
} from "../services/Utils";

const CreditCard = ({ bankName, amount, is_credit, due_date, theme }) => {
  return (
    <View style={styles.container}>
      <Svg
        width="130%"
        height="130%"
        viewBox="235 305 650 650"
        style={styles.svg}
      >
        <G id="Object">
          <G>
            <Path
              style={{ fill: theme.card_color }}
              d="M909.663,382.803c-0.015-17.321-14.055-31.339-31.377-31.324l-634.954,0.603
              c-17.307,0.019-31.354,14.063-31.332,31.381l0.337,355.735c0.015,17.311,14.078,31.336,31.377,31.324l634.962-0.595
              c17.337-0.022,31.347-14.082,31.324-31.388l-0.217-226.903l-697.671,0.663l-0.074-95.998l697.67-0.66L909.663,382.803z
              M553.508,546.878l0.045,41.139l-299.201,0.285l-0.045-41.142L553.508,546.878z"
            />
            <Polygon
              style={{ fill: theme.primary_strip_color }}
              points="909.708,415.64 212.038,416.3 212.112,512.298 909.783,511.635 909.783,511.635 
              909.738,485.339 909.708,415.648"
            />
            <Rect
              x="254.33"
              y="547.018"
              style={{ fill: theme.secondary_strip_color }}
              width="299.201"
              height="41.141"
            />
          </G>
        </G>
      </Svg>
      <View style={{ marginTop: 65, marginLeft: 35 }}>
        <Text style={{ color: COLORS.white, ...FONTS.h2 }}>{bankName}</Text>
        <Text
          style={{
            marginTop: 25,
            marginLeft: 5,
            color: COLORS.white,
            ...FONTS.credBold,
          }}
        >
          {is_credit === true ? "Credit" : "Debit"}
        </Text>
        <Text style={{ marginTop: 30, color: COLORS.white, ...FONTS.cred }}>
          {(is_credit === true ? "Outstanding: ₹" : "Amount: ₹") +
            formatAmountWithCommas(amount)}
        </Text>
        {is_credit === true ? (
          <Text style={{ color: COLORS.white, ...FONTS.cred }}>
            {"Next Invoice: " + getFormattedDateWithYear(due_date)}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
    position: "relative",
    width: "100%",
    height: 250,
  },
  svg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
});

export default CreditCard;
