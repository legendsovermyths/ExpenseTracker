import React, { useRef, useEffect } from "react";
import { View, Text, ScrollView, Dimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { COLORS, FONTS } from "../constants";
import { formatAmountWithCommas } from "../services/_Utils";

const { width: screenWidth } = Dimensions.get('window');

const MonthlyTrendChart = ({ data, height = 240 }) => {
  if (!data || data.length === 0) {
    return (
      <View style={{
        height: height,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{ color: COLORS.darkgray, ...FONTS.body3 }}>
          No data available
        </Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map(item => item.value));
  const scrollViewRef = useRef(null);
  
  // Add buffer space to max value (20% buffer for better visual containment)
  const chartMaxValue = maxValue * 1.2;
  
  // Calculate dynamic width based on data points to make it scrollable
  const chartWidth = screenWidth * 1.25;
  const pointSpacing = 40;
  
  // Scroll to the latest month (rightmost) when component mounts
  useEffect(() => {
    if (scrollViewRef.current && data.length > 0) {
      setTimeout(() => {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [data]);
  
  return (
    <View style={{ marginTop: 10, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row' }}>
        {/* Fixed Y-axis area */}
        <View style={{ width: 25, height: height, justifyContent: 'space-between', paddingVertical: 20 }}>
          {Array.from({ length: 5 }, (_, i) => {
            const value = (chartMaxValue / 4) * (4 - i);
            return (
              <Text key={i} style={{ 
                color: COLORS.primary, 
                ...FONTS.body4,
                fontSize: 12,
                textAlign: 'right',
                paddingRight: 0
              }}>
                {value >= 1000000000 ? (value / 1000000000).toFixed(1) + "b" :
                 value >= 1000000 ? (value / 1000000).toFixed(1) + "m" :
                 value >= 1000 ? (value / 1000).toFixed(0) + "k" :
                 Math.round(value).toString()}
              </Text>
            );
          })}
        </View>
        
        {/* Scrollable chart area */}
        <View style={{ flex: 1 }}>
          <ScrollView 
            ref={scrollViewRef}
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 10 }}
            decelerationRate="fast"
          >
            <LineChart
              pointerStripUptoDataPoint={true}
              data={data}
              height={height}
              width={chartWidth}
              adjustToWidth={false}
              initialSpacing={15}
              spacing={pointSpacing}
              maxValue={chartMaxValue}
              hideYAxisText={true}
              yAxisLabelWidth={0}
              xAxisLabelTextStyle={{ 
                color: COLORS.primary, 
                ...FONTS.body4,
                fontSize: 11,
                textAlign: 'center'
              }}
              color={COLORS.lightBlue}
              thickness={3}
              noOfSections={4}
              yAxisColor="transparent"
              xAxisColor="transparent"
              rulesColor={COLORS.gray}
              rulesType="dashed"
              dataPointsColor={COLORS.lightBlue}
              dataPointsRadius={6}
              disableScroll={true}
        formatYLabel={(amount) => {
          amount = Number(amount);
          if (amount >= 1000000000) {
            return (amount / 1000000000).toFixed(1) + "b";
          } else if (amount >= 1000000) {
            return (amount / 1000000).toFixed(1) + "m";
          } else if (amount >= 1000) {
            return (amount / 1000).toFixed(0) + "k";
          } else {
            return amount.toString();
          }
        }}
        stripColor={COLORS.lightBlue}
        stripOpacity={0.5}
        stripHeight={height}
        stripWidth={2}
        textFontSize={0}
        textColor="transparent"
        isAnimated={false}
        animateOnDataChange={false}
        pressEnabled={true}
        showDataPointsOnPress={true}
        pointerConfig={{
          pointer1Color: COLORS.lightBlue,
          radius: 6,
          pointerStripUptoDataPoint: true,
          pointerStripColor: "lightgray",
          pointerStripWidth: 2,
          strokeDashArray: [2, 5],
          activatePointersOnLongPress: false,
          persistPointer: false,
          hidePointer1: false,
          hidePointer2: true,
          autoAdjustPointerLabelPosition: true,
          pointerLabelWidth: 120,
          pointerLabelHeight: 90,
          activatePointersDelay: 0,
          pointerVanishDelay: 4000,
          resetPointerOnDataChange: true,
          pointerLabelComponent: (items) => {
            return (
              <View
                style={{
                  height: 90,
                  width: 120,
                  backgroundColor: COLORS.darkgray,
                  borderRadius: 8,
                  justifyContent: "center",
                  alignItems: "center",
                  shadowColor: "#000",
                  shadowOffset: {
                    width: 0,
                    height: 2,
                  },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                  elevation: 5,
                }}
              >
                <Text style={{ 
                  color: COLORS.white, 
                  ...FONTS.body4,
                  textAlign: 'center',
                  marginBottom: 4,
                }}>
                  {items[0].label} {items[0].year}
                </Text>
                <Text style={{ 
                  color: COLORS.white, 
                  ...FONTS.h4,
                  textAlign: 'center',
                  marginBottom: 4,
                }}>
                  ₹{formatAmountWithCommas(items[0].value, false)}
                </Text>
                <Text style={{ 
                  color: COLORS.lightGray2, 
                  ...FONTS.body5,
                  textAlign: 'center',
                }}>
                  {items[0].transactionCount} transactions
                </Text>
              </View>
            );
          },
                 }}
       />
          </ScrollView>
        </View>
      </View>
     </View>
   );
 };
 
 export default MonthlyTrendChart; 