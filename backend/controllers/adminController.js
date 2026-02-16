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
        const { name, startDate, endDate, description } = req.body;
        const adminId = req.user.userId;

        const batch = await Batch.create({
            name,
            startDate,
            endDate,
            description,
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
        const batches = await Batch.findAll();

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
        const userData = {
            email,
            password: tempPassword,
            firstName: null,
            lastName: null,
            role,
            batchId,
            profile: {},
            education: null
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

        // Process each line
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(v => v.trim());
            const email = values[emailIndex];

            if (!email) continue;

            try {
                // Check if user exists
                const existingUser = await User.findByEmail(email);
                if (existingUser) {
                    errors.push({
                        row: i + 1,
                        email: email,
                        error: 'User already exists'
                    });
                    continue;
                }

                // Generate temporary password
                const tempPassword = email.split('@')[0];

                // Create user
                const userData = {
                    email,
                    password: tempPassword,
                    firstName: null,
                    lastName: null,
                    role,
                    batchId,
                    profile: {},
                    education: null
                };

                const user = await User.create(userData);

                // Update batch student count
                if (role === 'student') {
                    await Batch.incrementStudentCount(batchId);
                }

                createdUsers.push({
                    email: user.email,
                    role: user.role,
                    tempPassword: tempPassword
                });

            } catch (error) {
                errors.push({
                    row: i + 1,
                    email: email,
                    error: error.message
                });
            }
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
        const { role } = req.query; // Optional filter by role

        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        let users;
        if (role === 'student') {
            users = await User.getStudentsByBatch(batchId);
        } else if (role === 'instructor') {
            users = await User.getInstructorsByBatch(batchId);
        } else {
            users = await User.getUsersByBatch(batchId);
        }

        res.json({
            success: true,
            batch: {
                id: batch._id,
                name: batch.name
            },
            count: users.length,
            users: users.map(u => ({
                id: u._id,
                email: u.email,
                firstName: u.firstName,
                lastName: u.lastName,
                role: u.role,
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
        const { role, batchId } = req.query;

        let users;
        if (role) {
            users = await User.findByRole(role);
        } else if (batchId) {
            users = await User.getUsersByBatch(batchId);
        } else {
            users = await User.findAll();
        }

        res.json({
            success: true,
            count: users.length,
            users: users.map(u => ({
                id: u._id,
                email: u.email,
                firstName: u.firstName,
                lastName: u.lastName,
                role: u.role,
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

        if (user.batchId?.toString() !== batchId) {
            return res.status(400).json({
                success: false,
                message: 'User does not belong to this batch'
            });
        }

        // Delete user and ALL their data
        await User.delete(userId);

        // Update batch count
        if (user.role === 'student') {
            await Batch.decrementStudentCount(batchId);
        }

        res.json({
            success: true,
            message: 'User and all associated data deleted successfully'
        });
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
        const UserStats = require('../models/UserStats');

        // Current active users
        const allUsers = await require('../config/astra').collections.users.find({}).toArray();
        const activeUsers = allUsers.length;
        const totalStudents = allUsers.filter(u => u.role === 'student').length;
        const totalInstructors = allUsers.filter(u => u.role === 'instructor').length;
        const totalAdmins = allUsers.filter(u => u.role === 'admin').length;

        const allBatches = await require('../config/astra').collections.batches.find({}).toArray();
        const totalBatches = allBatches.length;
        const activeBatches = allBatches.filter(b => b.status === 'active').length;

        const totalProblems = await Problem.count();

        const allContests = await require('../config/astra').collections.contests.find({}).toArray();
        const totalContests = allContests.length;

        // Get permanent total users count (for homepage popularity)
        const totalUsersEverCreated = await UserStats.getTotalUsersCount();

        res.json({
            success: true,
            analytics: {
                users: {
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
                problems: totalProblems,
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

