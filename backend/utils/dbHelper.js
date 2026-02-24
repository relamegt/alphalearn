const { collections } = require('../config/astra');

// Helper to count documents with native efficiency
const countDocuments = async (collectionName, filter = {}, limit = 100000) => {
    try {
        const collection = collections[collectionName];
        if (typeof collection.countDocuments === 'function') {
            return await collection.countDocuments(filter, { upperBound: limit });
        }
        // BUG #13 FIX: The previous fallback silently loaded the ENTIRE collection into RAM
        // via .find(filter).toArray() just to call .length on it. This is a silent OOM bomb
        // in production if countDocuments is unavailable or throws. Now we throw explicitly
        // so the caller can handle gracefully — never load full collections to count.
        throw new Error(
            `[dbHelper] countDocuments not available on collection '${collectionName}'. ` +
            'Refusing to fall back to full collection load (OOM risk). ' +
            'Ensure the Astra DB driver supports countDocuments.'
        );
    } catch (error) {
        console.error(`Count documents error in ${collectionName}:`, error);
        throw error;
    }
};

// Helper to check if document exists
const documentExists = async (collectionName, filter) => {
    try {
        const collection = collections[collectionName];
        const doc = await collection.findOne(filter);
        return doc !== null;
    } catch (error) {
        console.error(`Document exists check error in ${collectionName}:`, error);
        throw error;
    }
};

// Helper to get distinct values
const getDistinctValues = async (collectionName, field, filter = {}) => {
    try {
        const collection = collections[collectionName];
        // Stream docs via cursor (only the needed field) to avoid loading full collection into RAM
        const fieldParts = field.split('.');
        const projection = {};
        fieldParts.reduce((obj, key, i) => {
            if (i === fieldParts.length - 1) obj[field] = 1;
            return obj;
        }, projection);

        const cursor = collection.find(filter, { projection });
        const values = new Set();

        for await (const doc of cursor) {
            const value = fieldParts.reduce((obj, key) => obj?.[key], doc);
            if (value !== undefined && value !== null) {
                values.add(value);
            }
        }

        return Array.from(values);
    } catch (error) {
        console.error(`Get distinct values error in ${collectionName}:`, error);
        throw error;
    }
};

// Helper to aggregate count by field
const countByField = async (collectionName, field, filter = {}) => {
    try {
        const collection = collections[collectionName];
        // Stream docs via cursor to avoid loading full collection into RAM
        const fieldParts = field.split('.');
        const projection = {};
        projection[field] = 1;

        const cursor = collection.find(filter, { projection });
        const counts = {};

        for await (const doc of cursor) {
            const value = fieldParts.reduce((obj, key) => obj?.[key], doc);
            if (value !== undefined && value !== null) {
                counts[value] = (counts[value] || 0) + 1;
            }
        }

        return counts;
    } catch (error) {
        console.error(`Count by field error in ${collectionName}:`, error);
        throw error;
    }
};

module.exports = {
    countDocuments,
    documentExists,
    getDistinctValues,
    countByField
};
