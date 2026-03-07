import React from 'react';

const EducationCard = ({ education }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mt-4 transition-all">
            <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-wider">
                Recent Education
            </h3>

            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/40 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-100 dark:border-indigo-900/50">
                    🎓
                </div>
                <div>
                    <h4 className="text-gray-900 dark:text-gray-100 font-bold text-base">
                        {education?.degree || 'Degree'} ({education?.branch || 'Branch'})
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                        {education?.institution || 'Institution Name'}
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase mt-1">
                        {education?.startYear && education?.endYear
                            ? `${education.startYear} - ${education.endYear} `
                            : 'Present'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EducationCard;
