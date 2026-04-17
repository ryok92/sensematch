import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CoExperienceScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>共体験機能</Text>
            <Text style={styles.subText}>Coming Soon...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FAFCFF',
    },

    text: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },

    subText: {
        fontSize: 14,
        color: '#888',
    },
});