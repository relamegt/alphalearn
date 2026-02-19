import React from 'react';

const EducationCard = ({ education }) => {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mt-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                Recent Education
            </h3>

            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                    🎓
                </div>
                <div>
                    <h4 className="text-gray-900 font-medium">
                        {education?.degree || 'Degree'} ({education?.branch || 'Branch'})
                    </h4>
                    <p className="text-gray-500 text-sm">
                        {education?.institution || 'Institution Name'}
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                        {education?.startYear && education?.endYear
                            ? `${education.startYear} - ${education.endYear}`
                            : 'Present'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EducationCard;
