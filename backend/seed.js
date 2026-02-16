const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('bson');
const { connectDB, testConnection, getCollection } = require('./config/astra');

// Load environment variables
dotenv.config();

// Seed data
const seedData = {
    admin: {
        _id: new ObjectId(),
        email: 'alpha@gmail.com',
        password: '', // Will be hashed
        firstName: 'Alpha',
        lastName: 'Admin',
        role: 'admin',
        batchId: null,
        isActive: true,
        activeSessionToken: null,
        deviceFingerprint: null,
        profile: {
            phone: null,
            whatsapp: null,
            dob: null,
            gender: null,
            tshirtSize: null,
            aboutMe: null,
            address: {
                building: null,
                street: null,
                city: null,
                state: null,
                postalCode: null
            },
            socialLinks: {
                facebook: null,
                twitter: null,
                quora: null
            },
            professionalLinks: {
                website: null,
                linkedin: null
            }
        },
        education: null,
        skills: [],
        createdAt: new Date(),
        lastLogin: null
    }
};

// Clear all collections
const clearCollections = async () => {
    try {
        console.log('🗑️  Clearing existing data...');

        const collectionNames = [
            'users',
            'batches',
            'problems',
            'submissions',
            'progress',
            'externalProfiles',
            'contests',
            'contestSubmissions',
            'leaderboard'
        ];

        for (const collectionName of collectionNames) {
            try {
                const collection = getCollection(collectionName);
                await collection.deleteMany({});
                console.log(`   ✅ Cleared ${collectionName} collection`);
            } catch (error) {
                console.log(`   ⚠️  Warning: Could not clear ${collectionName}:`, error.message);
            }
        }

        console.log('✅ All collections cleared\n');
    } catch (error) {
        console.error('❌ Error clearing collections:', error);
        throw error;
    }
};

// Seed admin user
const seedAdmin = async () => {
    try {
        console.log('👤 Seeding admin user...');

        // Hash password
        const hashedPassword = await bcrypt.hash('Alpha@2026', 10);
        seedData.admin.password = hashedPassword;

        // Insert admin
        const usersCollection = getCollection('users');
        await usersCollection.insertOne(seedData.admin);

        console.log('✅ Admin user created successfully');
        console.log('   📧 Email: alpha@gmail.com');
        console.log('   🔑 Password: Alpha@2026');
        console.log('   👤 Role: admin\n');
    } catch (error) {
        console.error('❌ Error seeding admin:', error);
        throw error;
    }
};

// Seed sample batch
const seedSampleBatch = async () => {
    try {
        console.log('📚 Seeding sample batch...');

        const batch = {
            _id: new ObjectId(),
            name: '2022-2026 Batch',
            startDate: new Date('2022-08-01'),
            endDate: new Date('2026-05-31'),
            deleteOn: new Date('2027-01-01'),
            status: 'active',
            description: 'Computer Science Engineering Batch 2022-2026',
            studentCount: 0,
            createdBy: seedData.admin._id,
            createdAt: new Date()
        };

        const batchesCollection = getCollection('batches');
        await batchesCollection.insertOne(batch);
        seedData.sampleBatch = batch;

        console.log('✅ Sample batch created successfully');
        console.log(`   📋 Batch: ${batch.name}`);
        console.log(`   📅 Duration: ${batch.startDate.toLocaleDateString()} - ${batch.endDate.toLocaleDateString()}`);
        console.log(`   🗑️  Auto-delete on: ${batch.deleteOn.toLocaleDateString()}\n`);
    } catch (error) {
        console.error('❌ Error seeding batch:', error);
        throw error;
    }
};

// Seed sample problems
const seedSampleProblems = async () => {
    try {
        console.log('💻 Seeding sample problems...');

        const problems = [
            {
                _id: new ObjectId(),
                title: 'Two Sum',
                section: 'Arrays',
                difficulty: 'Easy',
                points: 20,
                description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
                constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9'],
                examples: [
                    { input: '[2,7,11,15], 9', output: '[0,1]', explanation: 'nums[0] + nums[1] = 9' }
                ],
                testCases: [
                    { input: '2 7 11 15\n9', output: '0 1', isHidden: false },
                    { input: '3 2 4\n6', output: '1 2', isHidden: false },
                    { input: '3 3\n6', output: '0 1', isHidden: true }
                ],
                timeLimit: 2000,
                editorial: {
                    approach: 'Use hash map to store complement',
                    solution: 'def twoSum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i',
                    complexity: 'Time: O(n), Space: O(n)'
                },
                isContestProblem: false,
                contestId: null,
                createdBy: seedData.admin._id,
                createdAt: new Date()
            }
        ];

        const problemsCollection = getCollection('problems');
        await problemsCollection.insertMany(problems);

        console.log(`✅ ${problems.length} sample problem(s) created successfully\n`);
    } catch (error) {
        console.error('❌ Error seeding problems:', error);
        throw error;
    }
};

// Main seed function
const seed = async () => {
    console.log('🌱 Starting database seeding...\n');
    console.log('═══════════════════════════════════════════════════\n');

    try {
        // Connect to database
        await connectDB();

        // Test connection
        console.log('🔌 Testing database connection...');
        const connected = await testConnection();

        if (!connected) {
            throw new Error('Failed to connect to database');
        }
        console.log('');

        // Clear existing data
        await clearCollections();

        // Seed data
        await seedAdmin();
        await seedSampleBatch();
        await seedSampleProblems();

        console.log('═══════════════════════════════════════════════════');
        console.log('✅ Database seeding completed successfully!\n');
        console.log('🎉 You can now login with:');
        console.log('   📧 Email: alpha@gmail.com');
        console.log('   🔑 Password: Alpha@2026');
        console.log('   👤 Role: Admin\n');
        console.log('📝 Next steps:');
        console.log('   1. Start the backend server: npm run dev');
        console.log('   2. Create batches and users from admin dashboard');
        console.log('   3. Assign students to batches');
        console.log('   4. Students can start solving problems\n');
        console.log('═══════════════════════════════════════════════════\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

// Run seed
seed();
