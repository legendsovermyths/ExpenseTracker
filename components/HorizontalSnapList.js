import React, { useEffect, useRef, useState } from "react";
import { View, FlatList, StyleSheet, Dimensions } from "react-native";
import FeaturedCard from "./FeaturedCard";

const HorizontalSnapList = ({ data }) => {
  const flatListRef = useRef(null);
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
    if (flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: currentIndex,
        animated: true,
      });
    }
  }, [currentIndex]);
  if(data.length==0)return null;
  return (
    <FlatList
      ref={flatListRef}
      data={data}
      renderItem={({ item }) => <FeaturedCard item={item} />}
      keyExtractor={(item) => item.key}
      horizontal
      pagingEnabled
      snapToAlignment="center"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
      onScrollToIndexFailed={() => {}}
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
