import { AntDesign, Entypo, EvilIcons, Feather, FontAwesome,  Fontisto, Foundation, MaterialCommunityIcons, MaterialIcons, Octicons, SimpleLineIcons, Zocial, } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, NativeModules, Pressable, StyleSheet, Text, TextInput, } from 'react-native';
import { IconCollection } from './Icons';
const IconObj = {
    AntDesign,
    Entypo,
    EvilIcons,
    Feather,
    FontAwesome,
    Fontisto,
    Foundation,
    MaterialCommunityIcons,
    MaterialIcons,
    Octicons,
    SimpleLineIcons,
    Zocial,
};
export const IconPicker = ({ iconColor, backgroundColor, numColumns, placeholderText, placeholderTextColor, searchTitle, iconsTitle, onClick, textInputStyle, textStyle, iconSize, flatListStyle, iconContainerStyle, }) => {
    const [search, setSearch] = useState('');
    const filteredIcons = IconCollection.filter((icon) => icon.iconName.toLowerCase().includes(search.toLowerCase()));
    const IconRenderer = ({ item }) => {
        const IconBoxComponent = IconObj[item.iconSet];
        return (React.createElement(Pressable, { style: { ...styles.iconContainer, ...iconContainerStyle }, onPress: () => onClick(item.uuid, search, item.iconName, item.iconSet, iconColor, backgroundColor) },
            React.createElement(IconBoxComponent, { name: item.iconName, size: iconSize, color: iconColor || '#fff' })));
    };
    return (React.createElement(React.Fragment, null,
        searchTitle && (React.createElement(Text, { style: { ...styles.text, ...textStyle } }, searchTitle)),
        React.createElement(TextInput, { style: { ...styles.input, ...textInputStyle }, onChangeText: setSearch, placeholder: placeholderText, placeholderTextColor: placeholderTextColor, value: search }),
        iconsTitle && (React.createElement(Text, { style: { ...styles.text, ...textStyle } }, iconsTitle)),
        React.createElement(FlatList, { style: { ...flatListStyle }, numColumns: numColumns, data: filteredIcons, renderItem: IconRenderer, keyExtractor: (item) => item.uuid })));
};
const styles = StyleSheet.create({
    input: {
        fontSize: 20,
        color: '#194868',
        backgroundColor: '#000',
        borderRadius: 7,
        paddingHorizontal: 15,
        paddingVertical: 17,
        fontWeight:"bold"
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 50,
        margin: 5,
        justifyContent: 'center',
        marginTop: 20,
        alignItems: 'center',
        backgroundColor: '#000',
    },
    text: {
        fontSize: 18,
        color: '#194868',
        marginVertical: 15,
    },
});
export default NativeModules.IconPickerModule;
//# sourceMappingURL=index.js.map