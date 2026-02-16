const { collections } = require('../config/astra');

// Helper to count documents without upperBound requirement
const countDocuments = async (collectionName, filter = {}) => {
    try {
        const collection = collections[collectionName];
        const documents = await collection.find(filter).toArray();
        return documents.length;
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
        const documents = await collection.find(filter).toArray();
        const values = new Set();

        documents.forEach(doc => {
            const value = field.split('.').reduce((obj, key) => obj?.[key], doc);
            if (value !== undefined && value !== null) {
                values.add(value);
            }
        });

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
        const documents = await collection.find(filter).toArray();
        const counts = {};

        documents.forEach(doc => {
            const value = field.split('.').reduce((obj, key) => obj?.[key], doc);
            if (value !== undefined && value !== null) {
                counts[value] = (counts[value] || 0) + 1;
            }
        });

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
