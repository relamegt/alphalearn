const csv = require('csv-parser');
const { Readable } = require('stream');
const crypto = require('crypto');

// Generate random password
const generatePassword = (length = 12) => {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
};

// Parse CSV buffer to JSON
const parseCSV = (buffer) => {
    return new Promise((resolve, reject) => {
        const results = [];
        const stream = Readable.from(buffer.toString());

        stream
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
};

// Validate user CSV format
const validateUserCSV = (data) => {
    const errors = [];
    const validRoles = ['admin', 'instructor', 'student'];

    data.forEach((row, index) => {
        const rowNum = index + 2; // +2 because row 1 is header, index starts at 0

        // Required fields
        if (!row.email) {
            errors.push(`Row ${rowNum}: Email is required`);
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
            errors.push(`Row ${rowNum}: Invalid email format`);
        }

        if (!row.firstName) {
            errors.push(`Row ${rowNum}: First name is required`);
        }

        if (!row.lastName) {
            errors.push(`Row ${rowNum}: Last name is required`);
        }

        if (!row.role) {
            errors.push(`Row ${rowNum}: Role is required`);
        } else if (!validRoles.includes(row.role.toLowerCase())) {
            errors.push(`Row ${rowNum}: Invalid role. Must be admin, instructor, or student`);
        }

        // Student-specific validations
        if (row.role && row.role.toLowerCase() === 'student') {
            if (!row.batchId) {
                errors.push(`Row ${rowNum}: Batch ID is required for students`);
            }

            if (!row.rollNumber) {
                errors.push(`Row ${rowNum}: Roll number is required for students`);
            }
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
};

// Parse and validate user CSV
const parseUserCSV = async (buffer) => {
    try {
        const data = await parseCSV(buffer);

        if (data.length === 0) {
            return {
                success: false,
                message: 'CSV file is empty'
            };
        }

        const validation = validateUserCSV(data);

        if (!validation.valid) {
            return {
                success: false,
                message: 'CSV validation failed',
                errors: validation.errors
            };
        }

        // Transform data and generate passwords
        const users = data.map(row => ({
            email: row.email.toLowerCase().trim(),
            password: row.password || generatePassword(),
            tempPassword: row.password || generatePassword(),
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            role: row.role.toLowerCase().trim(),
            phone: row.phone || null,
            whatsapp: row.whatsapp || null,
            batchId: row.batchId || null,
            rollNumber: row.rollNumber || null,
            institution: row.institution || null,
            degree: row.degree || null,
            stream: row.stream || null,
            startYear: row.startYear ? parseInt(row.startYear) : null,
            endYear: row.endYear ? parseInt(row.endYear) : null
        }));

        return {
            success: true,
            users
        };
    } catch (error) {
        console.error('Error parsing user CSV:', error);
        return {
            success: false,
            message: 'Failed to parse CSV file',
            error: error.message
        };
    }
};

// Validate problem CSV/JSON format
const validateProblemData = (data) => {
    const errors = [];
    const validSections = [
        'Introduction', 'Arrays', 'Strings', 'Math', 'Sorting', 'Searching',
        'Recursion', 'Backtracking', 'Dynamic Programming', 'Graphs', 'Trees',
        'Heaps', 'Advanced Topics'
    ];
    const validDifficulties = ['Easy', 'Medium', 'Hard'];

    data.forEach((row, index) => {
        const rowNum = index + 1;

        if (!row.title) {
            errors.push(`Row ${rowNum}: Title is required`);
        }

        if (!row.section) {
            errors.push(`Row ${rowNum}: Section is required`);
        } else if (!validSections.includes(row.section)) {
            errors.push(`Row ${rowNum}: Invalid section. Must be one of: ${validSections.join(', ')}`);
        }

        if (!row.difficulty) {
            errors.push(`Row ${rowNum}: Difficulty is required`);
        } else if (!validDifficulties.includes(row.difficulty)) {
            errors.push(`Row ${rowNum}: Invalid difficulty. Must be Easy, Medium, or Hard`);
        }

        if (!row.description) {
            errors.push(`Row ${rowNum}: Description is required`);
        }

        if (!row.testCases || !Array.isArray(row.testCases) || row.testCases.length === 0) {
            errors.push(`Row ${rowNum}: At least one test case is required`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
};

// Parse problem JSON file
const parseProblemJSON = (buffer) => {
    try {
        const data = JSON.parse(buffer.toString());

        if (!Array.isArray(data)) {
            return {
                success: false,
                message: 'JSON must be an array of problems'
            };
        }

        const validation = validateProblemData(data);

        if (!validation.valid) {
            return {
                success: false,
                message: 'Problem data validation failed',
                errors: validation.errors
            };
        }

        return {
            success: true,
            problems: data
        };
    } catch (error) {
        console.error('Error parsing problem JSON:', error);
        return {
            success: false,
            message: 'Failed to parse JSON file',
            error: error.message
        };
    }
};

// Generate CSV from data (for exports)
const generateCSV = (data, headers) => {
    if (data.length === 0) {
        return '';
    }

    // Generate header row
    const headerRow = headers.join(',');

    // Generate data rows
    const dataRows = data.map(row => {
        return headers.map(header => {
            const value = row[header];

            // Handle nested objects
            if (typeof value === 'object' && value !== null) {
                return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }

            // Handle strings with commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }

            return value || '';
        }).join(',');
    });

    return [headerRow, ...dataRows].join('\n');
};

module.exports = {
    generatePassword,
    parseCSV,
    validateUserCSV,
    parseUserCSV,
    validateProblemData,
    parseProblemJSON,
    generateCSV
};
