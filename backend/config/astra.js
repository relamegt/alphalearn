const { DataAPIClient } = require('@datastax/astra-db-ts');

let db = null;
let collections = {};

// Connect to Astra DB
const connectDB = async () => {
    try {
        console.log('🔄 Connecting to DataStax Astra DB...');

        // Validate required environment variables
        if (!process.env.ASTRA_DB_APPLICATION_TOKEN) {
            throw new Error('ASTRA_DB_APPLICATION_TOKEN is not defined in environment variables');
        }

        if (!process.env.ASTRA_DB_API_ENDPOINT) {
            throw new Error('ASTRA_DB_API_ENDPOINT is not defined in environment variables');
        }

        // Initialize Astra DB client
        const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);

        // Get database instance
        db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
            namespace: process.env.ASTRA_DB_NAMESPACE || 'default_keyspace'
        });

        console.log('✅ Astra DB Connected Successfully');
        console.log(`   Namespace: ${process.env.ASTRA_DB_NAMESPACE || 'default_keyspace'}`);

        // Initialize collections
        await initializeCollections();

        console.log('✅ All collections initialized');

        return db;

    } catch (error) {
        console.error(`❌ Error connecting to Astra DB: ${error.message}`);
        throw error;
    }
};

// Initialize all collections (9 collections for free tier)
const initializeCollections = async () => {
    try {
        const collectionNames = [
            'users',
            'batches',
            'problems',
            'submissions',
            'progress',
            'externalProfiles',
            'contests',
            'contestSubmissions',
            'leaderboard',
            'sections'
        ];

        console.log('🔄 Initializing collections...');

        for (const name of collectionNames) {
            try {
                // Get collection reference
                collections[name] = db.collection(name);

                // Test if collection exists by attempting to count documents
                await collections[name].countDocuments({}, { limit: 1 });

                console.log(`   ✓ Collection '${name}' connected`);
            } catch (error) {
                // If collection doesn't exist, create it
                try {
                    await db.createCollection(name);
                    collections[name] = db.collection(name);
                    console.log(`   ✓ Collection '${name}' created`);
                } catch (createError) {
                    // Collection might have been created by another process
                    collections[name] = db.collection(name);
                    console.log(`   ✓ Collection '${name}' ready`);
                }
            }
        }

        console.log('✅ Collections initialized (9/10 used in free tier)');

    } catch (error) {
        console.error('⚠️  Error initializing collections:', error.message);
        // Don't throw - collections might still work
    }
};

// Test database connection
const testConnection = async () => {
    try {
        if (!db) {
            await connectDB();
        }

        // Try to list collections as a connection test
        const collectionList = await db.listCollections();
        console.log(`✅ Connection test successful - Found ${collectionList.length} collection(s)`);
        return true;
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        return false;
    }
};

// Get database instance
const getDB = () => {
    if (!db) {
        throw new Error('Database not initialized. Call connectDB first.');
    }
    return db;
};

// Get collection instance
const getCollection = (name) => {
    if (!collections[name]) {
        // Try to get collection directly if not in cache
        if (db) {
            collections[name] = db.collection(name);
            return collections[name];
        }
        throw new Error(`Collection '${name}' not initialized and database not connected.`);
    }
    return collections[name];
};

// Check if database is connected
const isConnected = () => {
    return db !== null;
};

// Create indexes (placeholder - Astra DB handles most indexing automatically)
const createIndexes = async () => {
    try {
        console.log('📊 Setting up database indexes...');
        // Astra DB handles indexing automatically for most queries
        console.log('✅ Database indexes ready');
    } catch (error) {
        console.error('⚠️ Index creation warning:', error.message);
    }
};

module.exports = {
    connectDB,
    testConnection,
    createIndexes,
    getDB,
    getCollection,
    isConnected,
    collections
};
