const express = require('express');
const router = express.Router();
const { upload, deleteImage } = require('../config/cloudinary');

// Simple authenticate middleware for now
const authenticate = (req, res, next) => {
    // TODO: Replace with your real JWT middleware
    req.user = { userId: 'temp-user-id' };
    next();
};

// Upload profile picture
router.post('/profile-picture', authenticate, upload.single('profilePicture'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        res.json({
            success: true,
            message: 'Profile picture uploaded successfully',
            data: {
                url: req.file.path,
                publicId: req.file.filename
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Upload failed',
            error: error.message
        });
    }
});

// Delete profile picture
router.delete('/profile-picture', authenticate, async (req, res) => {
    try {
        const { publicId } = req.body;

        if (!publicId) {
            return res.status(400).json({
                success: false,
                message: 'Public ID required'
            });
        }

        const result = await deleteImage(publicId);

        res.json({
            success: true,
            message: 'Profile picture deleted',
            result
        });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            success: false,
            message: 'Delete failed',
            error: error.message
        });
    }
});

module.exports = router;
