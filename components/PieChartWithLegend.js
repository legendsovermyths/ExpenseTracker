import React from 'react';
import { View, Text } from 'react-native';
import { PieChart } from "react-native-gifted-charts";
import { COLORS, FONTS } from "../constants";

const renderDot = color => {
  return (
    <View
      style={{
        height: 10,
        width: 10,
        borderRadius: 5,
        backgroundColor: color,
        marginRight: 10,
      }}
    />
  );
};

const renderLegendComponent = (categories) => {
  const rows = [];
  const columns = 2;
  const categoryRows = Math.ceil(categories.length / columns);

  for (let i = 0; i < categoryRows; i++) {
    const row = categories.slice(i * columns, (i + 1) * columns);
    rows.push(
      <View key={i} style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 10 }}>
        {row.map((category, index) => (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'center', width: 128, marginRight: index === 0 ? 20 : 0 }}>
            {renderDot(category.color)}
            <Text style={{ color: COLORS.primary, ...FONTS.body4 }}>{category.label}: {category.value}%</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View>
      {rows}
    </View>
  );
};

const PieChartWithLegend = ({ data, transactionLength }) => {
  return (
    <>
      <PieChart
        textColor="black"
        radius={150}
        textSize={20}
        showTextBackground
        data={data}
        donut
        focusOnPress
        onPress={(slice) => { console.log('Pressed:', slice); }}
        centerLabelComponent={() => {
          return (
            <View style={{justifyContent: 'center', alignItems: 'center'}}>
              <Text
                style={{fontSize: 22, color: COLORS.primary, ...FONTS.body1}}>
                {transactionLength}
              </Text>
              <Text style={{fontSize: 14, color: COLORS.primary, ...FONTS.body4}}>Transactions</Text>
            </View>
          );
        }}
      />
      {renderLegendComponent(data)}
      </>
  );
};

export default PieChartWithLegend;
