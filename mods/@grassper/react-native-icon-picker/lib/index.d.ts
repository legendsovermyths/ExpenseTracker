import React from 'react';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';
interface PropsTypes {
    iconColor: string;
    iconSize: number;
    backgroundColor: string;
    numColumns: number;
    placeholderText: string;
    placeholderTextColor: string;
    searchTitle?: string;
    iconsTitle?: string;
    textInputStyle?: StyleProp<TextStyle>;
    textStyle?: StyleProp<TextStyle>;
    flatListStyle?: StyleProp<ViewStyle>;
    iconContainerStyle?: StyleProp<ViewStyle>;
    onClick: (id: string, searchText: string, iconName: string, iconSet: string, iconColor: string, backgroundColor: string) => void;
}
export declare const IconPicker: React.FC<PropsTypes>;
declare const _default: any;
export default _default;
