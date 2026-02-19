const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

class Section {
    // Create new section
    static async create(sectionData) {
        const section = {
            _id: new ObjectId(),
            title: sectionData.title,
            subsections: [], // Array of objects { _id: ObjectId, title: String, problemIds: [ObjectId] }
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await collections.sections.insertOne(section);
        return { ...section, _id: result.insertedId };
    }

    // Find all sections
    static async findAll() {
        return await collections.sections.find({}).sort({ createdAt: 1 }).toArray();
    }

    // Find section by ID
    static async findById(sectionId) {
        return await collections.sections.findOne({ _id: new ObjectId(sectionId) });
    }

    // Update section (title)
    static async update(sectionId, updateData) {
        return await collections.sections.updateOne(
            { _id: new ObjectId(sectionId) },
            {
                $set: {
                    ...updateData,
                    updatedAt: new Date()
                }
            }
        );
    }

    // Delete section
    static async delete(sectionId) {
        return await collections.sections.deleteOne({ _id: new ObjectId(sectionId) });
    }

    // Add subsection
    static async addSubsection(sectionId, title) {
        const subsection = {
            _id: new ObjectId(),
            title: title,
            problemIds: []
        };

        const result = await collections.sections.updateOne(
            { _id: new ObjectId(sectionId) },
            {
                $push: { subsections: subsection },
                $set: { updatedAt: new Date() }
            }
        );
        return { result, subsection };
    }

    // Update subsection title
    static async updateSubsection(sectionId, subsectionId, title) {
        return await collections.sections.updateOne(
            { _id: new ObjectId(sectionId), "subsections._id": new ObjectId(subsectionId) },
            {
                $set: {
                    "subsections.$.title": title,
                    updatedAt: new Date()
                }
            }
        );
    }

    // Delete subsection
    static async deleteSubsection(sectionId, subsectionId) {
        return await collections.sections.updateOne(
            { _id: new ObjectId(sectionId) },
            {
                $pull: { subsections: { _id: new ObjectId(subsectionId) } },
                $set: { updatedAt: new Date() }
            }
        );
    }

    // Add problem(s) to subsection
    static async addProblemToSubsection(sectionId, subsectionId, problemIds) {
        // Ensure problemIds is an array of strings for comparison
        const ids = Array.isArray(problemIds) ? problemIds : [problemIds];
        const stringIds = ids.map(id => id.toString());

        const section = await this.findById(sectionId);
        if (!section) return { matchedCount: 0 };

        const subsectionIndex = section.subsections.findIndex(sub => sub._id.toString() === subsectionId.toString());
        if (subsectionIndex === -1) return { matchedCount: 0 };

        const subsection = section.subsections[subsectionIndex];

        // Use Set to ensure uniqueness
        const existingIds = (subsection.problemIds || []).map(id => id.toString());
        const newIds = new Set(existingIds);

        stringIds.forEach(id => newIds.add(id));

        // Convert back to ObjectIds
        subsection.problemIds = Array.from(newIds).map(id => new ObjectId(id));

        // Update the specific subsection in the array (or the whole array if needed capabilities are limited)
        // Here we can just update the specific index using $set if we know the index, but typically safer to just fetch-update-save in this pattern 
        // OR construct the $set query with the index we just found: "subsections.N.problemIds"

        const updateQuery = {};
        updateQuery[`subsections.${subsectionIndex}.problemIds`] = subsection.problemIds;
        updateQuery['updatedAt'] = new Date();

        return await collections.sections.updateOne(
            { _id: new ObjectId(sectionId) },
            { $set: updateQuery }
        );
    }

    // Remove problem(s) from subsection
    static async removeProblemFromSubsection(sectionId, subsectionId, problemIds) {
        // Ensure problemIds is an array
        const ids = Array.isArray(problemIds) ? problemIds : [problemIds];
        const stringIds = ids.map(id => id.toString());

        const section = await this.findById(sectionId);
        if (!section) return { matchedCount: 0 };

        const subsectionIndex = section.subsections.findIndex(sub => sub._id.toString() === subsectionId.toString());
        if (subsectionIndex === -1) return { matchedCount: 0 };

        const subsection = section.subsections[subsectionIndex];

        if (!subsection.problemIds) return { matchedCount: 1, modifiedCount: 0 };

        // Filter out removed IDs
        const originalLength = subsection.problemIds.length;
        subsection.problemIds = subsection.problemIds.filter(id => !stringIds.includes(id.toString()));

        if (subsection.problemIds.length === originalLength) {
            return { matchedCount: 1, modifiedCount: 0 };
        }

        const updateQuery = {};
        updateQuery[`subsections.${subsectionIndex}.problemIds`] = subsection.problemIds;
        updateQuery['updatedAt'] = new Date();

        return await collections.sections.updateOne(
            { _id: new ObjectId(sectionId) },
            { $set: updateQuery }
        );
    }
}

module.exports = Section;
