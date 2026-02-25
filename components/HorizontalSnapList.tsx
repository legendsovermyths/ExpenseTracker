import React, { useEffect, useRef, useState } from "react";
import { View, FlatList, StyleSheet, Dimensions } from "react-native";
import FeaturedCard from "./FeaturedCard";
import { SIZES } from "../constants";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
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
    <FlatList
      ref={flatListRef}
      data={data}
      renderItem={({ item }) => <FeaturedCard item={item} />}
      keyExtractor={(item) => item.key.toString()}
      horizontal
      pagingEnabled
      snapToAlignment="start"
      decelerationRate="fast"
      snapToInterval={SCREEN_WIDTH}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
      onScrollToIndexFailed={() => {}}
      getItemLayout={(data, index) => ({
        length: SCREEN_WIDTH,
        offset: SCREEN_WIDTH * index,
        index,
      })}
    />
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default HorizontalSnapList;
