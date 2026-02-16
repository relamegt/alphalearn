const Batch = require('../models/Batch');
const { ObjectId } = require('bson');

// Get batch by ID
const getBatchById = async (req, res) => {
    try {
        const { batchId } = req.params;

        if (!ObjectId.isValid(batchId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid batch ID'
            });
        }

        const batch = await Batch.findById(batchId);

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        // Return only necessary fields for students/public
        res.json({
            _id: batch._id,
            name: batch.name,
            education: batch.education,
            streams: batch.streams || [],
            startDate: batch.startDate,
            endDate: batch.endDate,
            description: batch.description
        });
    } catch (error) {
        console.error('Get batch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch batch details',
            error: error.message
        });
    }
};

module.exports = {
    getBatchById
};
