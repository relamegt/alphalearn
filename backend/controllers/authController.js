const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const crypto = require('crypto');

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map();

// Generate device fingerprint
const generateFingerprint = (req) => {
    try {
        const userAgent = req.headers['user-agent'] || '';
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        return crypto.createHash('sha256').update(`${userAgent}${ip}`).digest('hex');
    } catch (error) {
        console.error('Generate fingerprint error:', error);
        return crypto.randomBytes(32).toString('hex');
    }
};

// Mock email service (replace with actual service later)
const sendOTP = async (email, otp) => {
    console.log(`📧 OTP for ${email}: ${otp}`);
    // TODO: Implement actual email service
    return true;
};

const sendPasswordChangeConfirmation = async (email, name) => {
    console.log(`📧 Password change confirmation sent to ${email}`);
    // TODO: Implement actual email service
    return true;
};

const sendSessionLogoutNotification = async (email, name, deviceInfo) => {
    console.log(`📧 Session logout notification sent to ${email}: Your previous session on ${deviceInfo} was logged out automatically.`);
    // TODO: Implement actual email service
    return true;
};

// Login with automatic session replacement
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact admin.'
            });
        }

        // Generate device fingerprint
        const deviceFingerprint = generateFingerprint(req);

        // Check for existing session (single login enforcement)
        let sessionReplaced = false;
        let previousDevice = null;

        if (user.activeSessionToken && user.deviceFingerprint) {
            if (user.deviceFingerprint !== deviceFingerprint) {
                // Different device detected - automatically logout previous session
                sessionReplaced = true;
                previousDevice = user.deviceFingerprint.substring(0, 8); // Short identifier

                // Clear previous session
                await User.clearSession(user._id.toString());

                // Send notification email about session replacement
                await sendSessionLogoutNotification(
                    user.email,
                    `${user.firstName} ${user.lastName}`,
                    `device ${previousDevice}`
                );

                console.log(`⚠️ Session replaced for user ${user.email}. Previous device: ${previousDevice}`);
            }
        }

        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user._id.toString(), email: user.email, role: user.role },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id.toString() },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        // Update user session
        await User.updateSession(user._id.toString(), refreshToken, deviceFingerprint);
        await User.updateLastLogin(user._id.toString());

        // Check if first login
        const isFirstLogin = user.isFirstLogin === true;

        res.json({
            success: true,
            message: sessionReplaced
                ? 'Login successful. Your previous session has been automatically logged out.'
                : 'Login successful',
            isFirstLogin,
            requiresProfileCompletion: isFirstLogin,
            sessionReplaced, // Flag to show notification in frontend
            tokens: {
                accessToken,
                refreshToken
            },
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                batchId: user.batchId,
                assignedBatches: user.assignedBatches || [],
                profileCompleted: user.profileCompleted || false
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

// Complete first login profile
const completeFirstLoginProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const {
            firstName,
            lastName,
            newPassword,
            profilePicture,
            phone,
            whatsapp,
            dob,
            gender,
            tshirtSize,
            address,
            rollNumber,
            institution,
            degree,
            branch,
            startYear,
            endYear
        } = req.body;


        // Validate required fields
        if (!firstName || !lastName || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'First name, last name, and new password are required'
            });
        }

        // Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Get current user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prepare update data
        const updateData = {
            firstName,
            lastName,
            password: hashedPassword,
            isFirstLogin: false,
            profileCompleted: true,
            profile: {
                ...user.profile,
                profilePicture: profilePicture || user.profile?.profilePicture,
                phone: phone || user.profile?.phone,
                whatsapp: whatsapp || user.profile?.whatsapp,
                dob: dob || user.profile?.dob,
                gender: gender || user.profile?.gender,
                tshirtSize: tshirtSize || user.profile?.tshirtSize,
                address: {
                    ...user.profile?.address,
                    ...address
                }
            },
            updatedAt: new Date()
        };

        // Add education for students
        if (user.role === 'student') {
            updateData.education = {
                rollNumber: rollNumber || user.education?.rollNumber,
                institution: institution || user.education?.institution,
                degree: degree || user.education?.degree,
                branch: branch || user.education?.branch,
                startYear: startYear ? parseInt(startYear) : user.education?.startYear,
                endYear: endYear ? parseInt(endYear) : user.education?.endYear
            };
        }

        // Update user
        await User.update(userId, updateData);

        res.json({
            success: true,
            message: 'Profile completed successfully. Please login again with your new password.'
        });
    } catch (error) {
        console.error('Complete first login profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete profile',
            error: error.message
        });
    }
};

// Refresh access token
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        // Find user
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        // Check if refresh token matches
        if (user.activeSessionToken !== refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please login again.',
                code: 'SESSION_REPLACED'
            });
        }

        // Generate new tokens
        const newAccessToken = jwt.sign(
            { userId: user._id.toString(), email: user.email, role: user.role },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '15m' }
        );

        const newRefreshToken = jwt.sign(
            { userId: user._id.toString() },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        // Update session
        const deviceFingerprint = generateFingerprint(req);
        await User.updateSession(user._id.toString(), newRefreshToken, deviceFingerprint);

        res.json({
            success: true,
            tokens: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            }
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token',
            code: 'SESSION_EXPIRED',
            error: error.message
        });
    }
};

// Logout
const logout = async (req, res) => {
    try {
        const userId = req.user.userId;
        await User.clearSession(userId);

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed',
            error: error.message
        });
    }
};

// Get current user
const getCurrentUser = async (req, res) => {
    try {
        const userId = req.user.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                batchId: user.batchId,
                assignedBatches: user.assignedBatches || [],
                profile: user.profile,
                education: user.education,
                skills: user.skills,
                isActive: user.isActive,
                profileCompleted: user.profileCompleted || false,
                isFirstLogin: user.isFirstLogin || false,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            }
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user data',
            error: error.message
        });
    }
};

// Change password
const changePassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await User.updatePassword(userId, hashedPassword);

        // Clear all sessions (force re-login)
        await User.clearSession(userId);

        // Send confirmation email
        await sendPasswordChangeConfirmation(user.email, `${user.firstName} ${user.lastName}`);

        res.json({
            success: true,
            message: 'Password changed successfully. Please login again with your new password.'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password',
            error: error.message
        });
    }
};

// Forgot password - Send OTP
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findByEmail(email);
        if (!user) {
            // Don't reveal if user exists
            return res.json({
                success: true,
                message: 'If the email exists, an OTP has been sent'
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store OTP with timestamp
        otpStore.set(email, {
            otp,
            timestamp: Date.now()
        });

        // Send OTP via email
        await sendOTP(email, otp);

        // Auto-delete OTP after 10 minutes
        setTimeout(() => {
            otpStore.delete(email);
        }, 10 * 60 * 1000);

        res.json({
            success: true,
            message: 'OTP sent to your email address. Valid for 10 minutes.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: error.message
        });
    }
};

// Reset password with OTP
const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        // Verify OTP
        const storedOTP = otpStore.get(email);
        if (!storedOTP || storedOTP.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        // Check OTP expiry (10 minutes)
        if (Date.now() - storedOTP.timestamp > 10 * 60 * 1000) {
            otpStore.delete(email);
            return res.status(400).json({
                success: false,
                message: 'OTP has expired'
            });
        }

        // Find user
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await User.updatePassword(user._id.toString(), hashedPassword);

        // Clear OTP
        otpStore.delete(email);

        // Clear all sessions
        await User.clearSession(user._id.toString());

        res.json({
            success: true,
            message: 'Password reset successfully. Please login with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password',
            error: error.message
        });
    }
};

// Verify session
const verifySession = async (req, res) => {
    try {
        const userId = req.user.userId;

        const user = await User.findById(userId);
        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Invalid session'
            });
        }

        res.json({
            success: true,
            message: 'Session is valid',
            user: {
                id: user._id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Verify session error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid session',
            error: error.message
        });
    }
};

module.exports = {
    login,
    refreshToken,
    logout,
    getCurrentUser,
    changePassword,
    forgotPassword,
    resetPassword,
    verifySession,
    completeFirstLoginProfile
};
