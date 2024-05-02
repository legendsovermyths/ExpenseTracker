import React from 'react';
import { View, Text } from 'react-native';
import { LineChart, PieChart } from "react-native-gifted-charts";
import { COLORS, FONTS, PRETTYCOLORS } from "../constants";

const CustomLineChart= () =>{
    const lineData = [{value: 5},{value: 10},{value:15},{value: 20},{value: 25},{value:30},{value: 35},{value: 40}];
    const lineData2 = [{value: 6},{value: 15},{value:32},{value: 34},{value: 35},{value: 36},{value: 39},{value: 41}];
    return (
        <View style={{marginTop:20,marginBottom:20}}>
            <LineChart
            yAxisTextStyle={{color:COLORS.primary,...FONTS.body4}}
            noOfSections={3}
            hide={true}
            isAnimated={true}
            pointerConfig={{
                pointerStripUptoDataPoint: true,
                pointerStripColor: 'lightgray',
                pointerStripWidth: 2,
                strokeDashArray: [2, 5],
                pointerColor: 'lightgray',
                radius: 4,
                pointerLabelWidth: 100,
                pointerLabelHeight: 120,
                pointerLabelComponent: items => {
                  return (
                    <View
                      style={{
                        height: 120,
                        width: 100,
                        backgroundColor: '#282C3E',
                        borderRadius: 4,
                        justifyContent:'center',
                        paddingLeft:16,
                      }}>
                      <Text style={{color: 'lightgray',fontSize:12}}>{2018}</Text>
                      <Text style={{color: 'white', fontWeight:'bold'}}>{items[0].value}</Text>
                      <Text style={{color: 'lightgray',fontSize:12,marginTop:12}}>{2019}</Text>
                      <Text style={{color: 'white', fontWeight:'bold'}}>{items[1].value}</Text>
                    </View>
                  );
                },
              }}
            rulesColor={COLORS.darkgray}
            areaChart
            curved
            data={lineData}
            data2={lineData2}
            height={350}
            initialSpacing={0}
            color1="orange"
            color2="green"
            hideDataPoints
            yAxisColor="transparent"
            xAxisColor="transparent"
            dataPointsColor1="orange"
            dataPointsColor2="red"
            startFillColor1="orange"
            startFillColor2="green"
            animateOnDataChange={true}
            startOpacity={0.8}
            endOpacity={0.3}
            width={300}
            adjustToWidth={true}
            />
        </View>
    );
}
export default CustomLineChart