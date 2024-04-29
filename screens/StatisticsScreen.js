import React, { useState } from 'react';
import { View, Text, Button,Image } from 'react-native';


import { COLORS, FONTS, SIZES, icons } from "../constants";
import { PieChart } from "react-native-gifted-charts";
import { color } from 'react-native-elements/dist/helpers';
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
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', width: 120, marginRight: index === 0 ? 20 : 0 }}>
              {renderDot(category.color)}
              <Text style={{ color: COLORS.primary, ...FONTS.body4 }}>{category.label}: {category.percentage}%</Text>
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
  
  // Example category data
  const categories = [
    { label: 'Food', percentage: 47, color: '#006DFF' },
    { label: 'Transport', percentage: 16, color: '#8F80F3' },
    { label: 'Personal', percentage: 40, color: '#3BE9DE' },
    { label: 'Medical', percentage: 2, color: '#FF7F97' },
    // Add more categories as needed
  ];

const StatsScreen = () => {
    const pieData = [{value: 15, color:"#94FFD8"}, {value: 30, color:"#FFBB70"}, {value: 26,color:"#E178C5"}, {value: 40, color:"#FEFDED"}];
    return <View style={{ flex: 1, backgroundColor: COLORS.white }}>
    {/* Header section */}
    <View
      style={{
        paddingHorizontal: SIZES.padding,
        paddingVertical: (5 * SIZES.padding) / 2,
        backgroundColor: COLORS.white,
      }}
    >
      <Text
        style={{
          marginLeft: SIZES.padding / 6,
          color: COLORS.primary,
          ...FONTS.h1,
        }}
      >
        Analysis
      </Text>
      <Text style={{marginLeft: SIZES.padding / 6,marginBottom:10,color:COLORS.darkgray,...FONTS.h3}}>
        Summary
      </Text>
      <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: SIZES.padding / 2,
                marginBottom:10
              }}
            >
              <View
                style={{
                  backgroundColor: COLORS.lightGray,
                  height: 50,
                  width: 50,
                  borderRadius: 25,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Image
                  source={icons.calendar}
                  style={{ width: 20, height: 20, tintColor: COLORS.lightBlue }}
                />
              </View>
              <View style={{ flex: 1, marginLeft: SIZES.padding / 3 }}>
                <Text style={{ color: COLORS.primary, ...FONTS.h3 }}>
                  {"19 April, 2024 - 28 April, 2024"}
                </Text>
                <Text style={{ ...FONTS.body3, color: COLORS.darkgreen}}>
                  {"+2.5% average transactions"}
                </Text>
              </View>
              <View style={{ marginLeft: SIZES.padding }}>
              </View>
            </View>
      <View style={{backgroundColor:COLORS.lightGray,padding:5,borderRadius:20}}>
      <Text style={{marginTop:10,marginLeft:10,color:COLORS.primary,...FONTS.h3}}>CATEGORIES</Text>
      <Text style={{marginBottom:5,marginLeft:10,color:COLORS.darkgray,...FONTS.body4}}>5 total</Text>
      <PieChart
            textColor="black"
            radius={150}
            textSize={20}
            showTextBackground
            data={pieData}
            donut
            focusOnPress
            onPress={(slice) => { console.log('Pressed:', slice); }}
            centerLabelComponent={() => {
                return (
                  <View style={{justifyContent: 'center', alignItems: 'center'}}>
                    <Text
                      style={{fontSize: 22, color: COLORS.primary, fontWeight: 'bold'}}>
                      47
                    </Text>
                    <Text style={{fontSize: 14, color: COLORS.primary}}>Transactions</Text>
                  </View>
                );
              }}
    
            />
            {renderLegendComponent(categories)}
            </View>
            
      </View>
     </View>
};

export default StatsScreen;
