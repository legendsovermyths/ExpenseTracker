import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, FlatList, StyleSheet, Dimensions } from "react-native";
import FeaturedCard from "./FeaturedCard";
import { SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - SIZES.padding * 2;

interface FeaturedCardData {
  key: number;
  spent: number;
  change: string;
  lastMonth: number;
  description: string;
  transactions: number;
  month: number;
  year: number;
}

interface HorizontalSnapListProps {
  data: FeaturedCardData[];
}

const HorizontalSnapList: React.FC<HorizontalSnapListProps> = ({ data }) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (data.length <= 1) return;

    const interval = setInterval(() => {
      let nextIndex = currentIndex + 1;
      if (nextIndex >= data.length) {
        nextIndex = 0;
      }
      setCurrentIndex(nextIndex);
    }, 10000);

    return () => clearInterval(interval);
  }, [currentIndex, data.length]);

  useEffect(() => {
    if (flatListRef.current && data.length > 0) {
      flatListRef.current.scrollToIndex({
        index: currentIndex,
        animated: true,
      });
    }
  }, [currentIndex, data.length]);

  if (data.length === 0) return null;

  return (
    <View>
      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <FeaturedCard item={item} />
          </View>
        )}
        keyExtractor={(item) => item.key.toString()}
        horizontal
        pagingEnabled
        snapToAlignment="center"
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        showsHorizontalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(newIndex);
        }}
      />
      {/* Page Indicators */}
      {data.length > 1 && (
        <View style={styles.indicatorContainer}>
          {data.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentIndex && styles.activeIndicator,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (COLORS: any) => StyleSheet.create({
  cardWrapper: {
    width: SCREEN_WIDTH,
    paddingHorizontal: SIZES.padding,
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: SIZES.base,
    gap: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.gray,
  },
  activeIndicator: {
    width: 20,
    backgroundColor: COLORS.primary,
  },
});

export default HorizontalSnapList;
