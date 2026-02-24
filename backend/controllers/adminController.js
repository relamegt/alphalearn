const User = require('../models/User');
const Batch = require('../models/Batch');
const Problem = require('../models/Problem');
const bcrypt = require('bcryptjs');

// ============================================
// BATCH MANAGEMENT
// ============================================

// Create batch
const createBatch = async (req, res) => {
    try {
        const { name, startDate, endDate, description, education, branches } = req.body;
        const adminId = req.user.userId;

        const batch = await Batch.create({
            name,
            startDate,
            endDate,
            description,
            education,
            branches,
            createdBy: adminId
        });

        res.status(201).json({
            success: true,
            message: 'Batch created successfully',
            batch
        });
    } catch (error) {
        console.error('Create batch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create batch',
            error: error.message
        });
    }
};

// Get all batches
const getAllBatches = async (req, res) => {
    try {
        let batches;

        if (req.user.role === 'instructor') {
            const user = await User.findById(req.user.userId);
            const batchIds = [user.batchId, ...(user.assignedBatches || [])]
                .filter(id => id); // Filter nulls

            // Remove duplicates
            const uniqueBatchIds = [...new Set(batchIds.map(id => id.toString()))];

            if (uniqueBatchIds.length > 0) {
                batches = await Batch.findByIds(uniqueBatchIds);
            } else {
                batches = [];
            }
        } else {
            batches = await Batch.findAll();
        }

        res.json({
            success: true,
            count: batches.length,
            batches
        });
    } catch (error) {
        console.error('Get batches error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch batches',
            error: error.message
        });
    }
};

// Update batch
const updateBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const updateData = req.body;

        const batch = await Batch.update(batchId, updateData);

        res.json({
            success: true,
            message: 'Batch updated successfully',
            batch
        });
    } catch (error) {
        console.error('Update batch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update batch',
            error: error.message
        });
    }
};

// Extend batch expiry
const extendBatchExpiry = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { newEndDate } = req.body;

        await Batch.extendExpiry(batchId, new Date(newEndDate));

        res.json({
            success: true,
            message: 'Batch expiry extended successfully'
        });
    } catch (error) {
        console.error('Extend batch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to extend batch',
            error: error.message
        });
    }
};

// Get batch statistics
const getBatchStatistics = async (req, res) => {
    try {
        const { batchId } = req.params;

        const statistics = await Batch.getStatistics(batchId);

        res.json({
            success: true,
            statistics
        });
    } catch (error) {
        console.error('Get batch statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch batch statistics',
            error: error.message
        });
    }
};

// Get batch by ID (for students to access batch data like branches)
const getBatchById = async (req, res) => {
    try {
        const { batchId } = req.params;

        const batch = await Batch.getById(batchId);

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        res.json(batch);
    } catch (error) {
        console.error('Get batch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch batch',
            error: error.message
        });
    }
};

// ============================================
// USER MANAGEMENT (WITHIN BATCH)
// ============================================

// Add single user to batch (email only)
const addUserToBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { email, role } = req.body;

        // Validate batch exists
        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            if (role === 'instructor' && existingUser.role === 'instructor') {
                await User.addBatchToInstructor(existingUser._id, batchId);
                return res.status(200).json({
                    success: true,
                    message: 'Instructor successfully assigned to this batch',
                    user: {
                        id: existingUser._id,
                        email: existingUser.email,
                        role: existingUser.role,
                        batchId: batchId
                    }
                });
            }

            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Validate role
        const validRoles = ['student', 'instructor'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Role must be either student or instructor'
            });
        }

        // Generate temporary password from email
        const tempPassword = email.split('@')[0];

        // Create user with minimal data
        // For students, populate education from batch
        let educationData = null;
        if (role === 'student' && batch.education) {
            educationData = {
                institution: batch.education.institution,
                degree: batch.education.degree,
                branch: null, // Student will fill this during profile completion
                rollNumber: null,
                startYear: batch.education?.startYear || new Date(batch.startDate).getFullYear(),
                endYear: batch.education?.endYear || new Date(batch.endDate).getFullYear()
            };
        }

        const userData = {
            email,
            password: tempPassword,
            firstName: null,
            lastName: null,
            role,
            batchId,
            profile: {},
            education: educationData
        };

        const user = await User.create(userData);

        // Update batch student count
        if (role === 'student') {
            await Batch.incrementStudentCount(batchId);
        }

        res.status(201).json({
            success: true,
            message: `${role.charAt(0).toUpperCase() + role.slice(1)} added to batch successfully`,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                batchId: user.batchId,
                tempPassword: tempPassword
            },
            note: 'User must complete profile on first login'
        });
    } catch (error) {
        console.error('Add user to batch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add user to batch',
            error: error.message
        });
    }
};

// Bulk add users to batch (CSV with just emails)
const bulkAddUsersToBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { role } = req.body; // role sent as form-data field

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'CSV file is required'
            });
        }

        // Validate batch exists
        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        // Validate role
        const validRoles = ['student', 'instructor'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Role must be either student or instructor'
            });
        }

        const csvData = req.file.buffer.toString('utf8');
        const errors = [];
        const createdUsers = [];

        // Parse CSV
        const lines = csvData.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Validate header
        if (!headers.includes('email')) {
            return res.status(400).json({
                success: false,
                message: 'CSV must contain "email" column'
            });
        }

        const emailIndex = headers.indexOf('email');
        const emailsToCreate = [];
        const rowsToProcess = [];

        // 1. Collect all emails and validate basic format
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = line.split(',').map(v => v.trim());
            const email = values[emailIndex]?.toLowerCase();
            if (email) rowsToProcess.push({ email, row: i + 1 });
        }

        // 2. Bulk check for existing users in chunks
        const allEmails = rowsToProcess.map(r => r.email);
        const CHUNK_SIZE = 100;
        const existingUsers = [];
        for (let i = 0; i < allEmails.length; i += CHUNK_SIZE) {
            const emailChunk = allEmails.slice(i, i + CHUNK_SIZE);
            const chunkUsers = await collections.users.find({ email: { $in: emailChunk } }).toArray();
            existingUsers.push(...chunkUsers);
        }
        const existingEmailSet = new Set(existingUsers.map(u => u.email));

        const newUsersData = [];
        for (const row of rowsToProcess) {
            if (existingEmailSet.has(row.email)) {
                errors.push({ row: row.row, email: row.email, error: 'User already exists' });
                continue;
            }

            const tempPassword = row.email.split('@')[0];

            let educationData = null;
            if (role === 'student' && batch.education) {
                educationData = {
                    institution: batch.education.institution,
                    degree: batch.education.degree,
                    branch: null,
                    rollNumber: null,
                    startYear: batch.education?.startYear || new Date(batch.startDate).getFullYear(),
                    endYear: batch.education?.endYear || new Date(batch.endDate).getFullYear()
                };
            }

            newUsersData.push({
                email: row.email,
                password: tempPassword,
                _rawPassword: tempPassword, // Preserved before bulkCreate hashes it
                role,
                batchId,
                education: educationData
            });
        }

        // 3. Bulk create new users
        if (newUsersData.length > 0) {
            const result = await User.bulkCreate(newUsersData);

            // Determine accurate insert count based on DB response or fallback
            let numInserted = newUsersData.length;
            if (result && result.insertedCount !== undefined) {
                numInserted = result.insertedCount;
            } else if (result && result.insertedIds) {
                numInserted = Object.keys(result.insertedIds).length;
            }

            // Update batch student count with actual inserted count
            if (role === 'student' && numInserted > 0) {
                const Batch = require('../models/Batch');
                await collections.batches.updateOne(
                    { _id: new ObjectId(batchId) },
                    { $inc: { studentCount: numInserted } }
                );
            }

            // Fix #19: Use _rawPassword (saved before bulkCreate hashes it) for the admin response.
            // bulkCreate runs bcrypt.hash internally and does NOT mutate the input objects,
            // so u.password here is still the raw value. We use _rawPassword explicitly for clarity.
            newUsersData.slice(0, numInserted).forEach(u => createdUsers.push({
                email: u.email,
                role: u.role,
                tempPassword: u._rawPassword
            }));
        }

        res.status(201).json({
            success: true,
            message: `Bulk user creation completed. Created: ${createdUsers.length}, Errors: ${errors.length}`,
            batchName: batch.name,
            role: role,
            created: createdUsers,
            errors: errors.length > 0 ? errors : undefined,
            note: 'Users must complete their profile on first login'
        });

    } catch (error) {
        console.error('Bulk add users to batch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to bulk add users',
            error: error.message
        });
    }
};

// Get all users in a batch
const getBatchUsers = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { role, page: _page, limit: _limit } = req.query; // Optional filter by role
        const page = parseInt(_page) || 1;
        const limit = parseInt(_limit) || 50;

        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        const { collections } = require('../config/astra');
        const { ObjectId } = require('bson');

        const query = {};
        if (role === 'student' || role === 'instructor') {
            query.role = role;
        }

        // Apply batch logic
        const batchObjId = new ObjectId(batchId);
        if (role === 'instructor') {
            query.$or = [{ batchId: batchObjId }, { assignedBatches: batchObjId }];
        } else {
            query.batchId = batchObjId;
        }

        const startIndex = (page - 1) * limit;

        const [users, total] = await Promise.all([
            collections.users
                .find(query)
                .sort({ createdAt: -1 })
                .skip(startIndex)
                .limit(limit)
                .toArray(),
            collections.users.countDocuments(query, { upperBound: 100000 })
        ]);

        res.json({
            success: true,
            batch: {
                id: batch._id,
                name: batch.name
            },
            count: users.length,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            users: users.map(u => ({
                id: u._id,
                email: u.email,
                firstName: u.firstName,
                lastName: u.lastName,
                role: u.role,
                rollNumber: u.education?.rollNumber || 'N/A',
                branch: u.education?.branch || 'N/A',
                isActive: u.isActive,
                profileCompleted: u.profileCompleted || false,
                isFirstLogin: u.isFirstLogin || false
            }))
        });
    } catch (error) {
        console.error('Get batch users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch batch users',
            error: error.message
        });
    }
};

// ============================================
// ADMIN USER MANAGEMENT (NON-BATCH)
// ============================================

// Create admin user (not tied to any batch)
const createAdminUser = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if user exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Generate temporary password
        const tempPassword = email.split('@')[0];

        // Create admin user
        const userData = {
            email,
            password: tempPassword,
            firstName: null,
            lastName: null,
            role: 'admin',
            batchId: null,
            profile: {},
            education: null
        };

        const user = await User.create(userData);

        res.status(201).json({
            success: true,
            message: 'Admin user created successfully',
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                tempPassword: tempPassword
            },
            note: 'User must complete profile on first login'
        });
    } catch (error) {
        console.error('Create admin user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create admin user',
            error: error.message
        });
    }
};

// Get all users (with filters)
const getAllUsers = async (req, res) => {
    try {
        const { role, batchId, page: _page, limit: _limit } = req.query;
        const page = parseInt(_page) || 1;
        const limit = parseInt(_limit) || 50;

        const { collections } = require('../config/astra');
        const { ObjectId } = require('bson');

        const query = {};
        if (role) {
            query.role = role;
        }
        if (batchId) {
            query.batchId = new ObjectId(batchId);
        }

        const startIndex = (page - 1) * limit;

        const [users, total] = await Promise.all([
            collections.users
                .find(query)
                .sort({ createdAt: -1 })
                .skip(startIndex)
                .limit(limit)
                .toArray(),
            collections.users.countDocuments(query, { upperBound: 100000 })
        ]);

        res.json({
            success: true,
            count: users.length,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            users: users.map(u => ({
                id: u._id,
                email: u.email,
                firstName: u.firstName,
                lastName: u.lastName,
                role: u.role,
                rollNumber: u.education?.rollNumber || 'N/A',
                branch: u.education?.branch || 'N/A',
                batchId: u.batchId,
                isActive: u.isActive,
                profileCompleted: u.profileCompleted || false,
                createdAt: u.createdAt
            }))
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message
        });
    }
};

// Remove user from batch (complete deletion with all data)
const removeUserFromBatch = async (req, res) => {
    try {
        const { batchId, userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check role and act accordingly
        if (user.role === 'instructor') {
            // Instructors: Remove from batch (unassign)
            await User.removeBatchFromInstructor(userId, batchId);

            res.json({
                success: true,
                message: 'Instructor successfully removed from batch (account preserved)'
            });
        } else {
            // Students: Delete user and ALL their data
            await User.delete(userId);

            // Update batch count
            if (user.role === 'student') {
                await Batch.decrementStudentCount(batchId);
            }

            res.json({
                success: true,
                message: 'Student and all associated data deleted successfully'
            });
        }
    } catch (error) {
        console.error('Remove user from batch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove user',
            error: error.message
        });
    }
};

// Delete batch (deletes batch and ALL users with ALL their data)
const deleteBatch = async (req, res) => {
    try {
        const { batchId } = req.params;

        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        // Delete batch and all users (cascades to all data)
        const result = await Batch.delete(batchId);

        res.json({
            success: true,
            message: result.message,
            usersDeleted: result.usersDeleted
        });
    } catch (error) {
        console.error('Delete batch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete batch',
            error: error.message
        });
    }
};

// Get system analytics (includes permanent user count)
const getSystemAnalytics = async (req, res) => {
    try {
        const collections = require('../config/astra').collections;

        // Optimized counts using native countDocuments
        const [
            activeUsers,
            totalStudents,
            totalInstructors,
            totalAdmins,
            totalBatches,
            activeBatches,
            totalContests,
            totalUsersEverCreated
        ] = await Promise.all([
            collections.users.countDocuments({}, { upperBound: 100000 }),
            collections.users.countDocuments({ role: 'student' }, { upperBound: 100000 }),
            collections.users.countDocuments({ role: 'instructor' }, { upperBound: 100000 }),
            collections.users.countDocuments({ role: 'admin' }, { upperBound: 100000 }),
            collections.batches.countDocuments({}, { upperBound: 1000 }),
            collections.batches.countDocuments({ status: 'active' }, { upperBound: 1000 }),
            collections.contests.countDocuments({}, { upperBound: 1000 }),
            User.getTotalUsersCount()
        ]);

        const totalProblems = await Problem.count();

        res.json({
            success: true,
            analytics: {
                users: {
                    total: activeUsers,                      // Added for dashboard compatibility
                    totalEverCreated: totalUsersEverCreated, // For homepage
                    currentActive: activeUsers,              // Current active users
                    students: totalStudents,
                    instructors: totalInstructors,
                    admins: totalAdmins
                },
                batches: {
                    total: totalBatches,
                    active: activeBatches
                },
                problems: {
                    total: totalProblems,
                    byDifficulty: await Problem.getDifficultyWiseCount().then(counts => ({
                        Easy: counts.easy,
                        Medium: counts.medium,
                        Hard: counts.hard
                    }))
                },
                contests: totalContests
            }
        });
    } catch (error) {
        console.error('Get system analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics',
            error: error.message
        });
    }
};

// Fix the function name from 'toasttch' to 'deleteBatch'
module.exports = {
    // Batch Management
    createBatch,
    getAllBatches,
    updateBatch,
    extendBatchExpiry,
    getBatchStatistics,
    deleteBatch, // Fixed name

    // User Management (within batch)
    addUserToBatch,
    bulkAddUsersToBatch,
    getBatchUsers,
    removeUserFromBatch,

    // Admin User Management
    createAdminUser,
    getAllUsers,
    getSystemAnalytics
};

