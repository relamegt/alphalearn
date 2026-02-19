import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import authService from '../../../services/authService';
import profileService from '../../../services/profileService';
import toast from 'react-hot-toast';

const ProfessionalDetails = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const [professionalData, setProfessionalData] = useState({
        education: {
            institution: '',
            degree: '',
            branch: '',
            rollNumber: '',
            startYear: '',
            endYear: '',
        },
        skills: [],
    });

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const userData = await authService.getCurrentUser();
                setProfessionalData({
                    education: userData.education || {},
                    skills: userData.skills || [],
                });
            } catch (error) {
                toast.error('Failed to load profile');
            }
        };
        fetchUserProfile();
    }, []);

    const handleUpdateProfessional = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await profileService.updateProfile(professionalData);
            toast.success('Professional details updated successfully');
        } catch (error) {
            toast.error(error.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    if (user.role !== 'student') {
        return <div className="p-8 text-center text-gray-500">Only students have professional details.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto card animate-fade-in">
            <h2 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b border-gray-100">Professional Details</h2>
            <form onSubmit={handleUpdateProfessional} className="space-y-6">

                {/* Education Section */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 border-l-4 border-blue-500 pl-3">Education</h3>
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6">
                        <div className="flex items-start mb-4">
                            <svg className="w-5 h-5 text-blue-500 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm text-blue-700">
                                These details are linked to your batch registration. Please contact support if corrections are needed for Institution or Degree.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                                <input
                                    type="text"
                                    value={professionalData.education.institution || ''}
                                    readOnly
                                    disabled
                                    className="input-field bg-gray-100/80 cursor-not-allowed text-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Degree</label>
                                <input
                                    type="text"
                                    value={professionalData.education.degree || ''}
                                    readOnly
                                    disabled
                                    className="input-field bg-gray-100/80 cursor-not-allowed text-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Year</label>
                                <input
                                    type="number"
                                    value={professionalData.education.startYear || ''}
                                    readOnly
                                    disabled
                                    className="input-field bg-gray-100/80 cursor-not-allowed text-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">End Year</label>
                                <input
                                    type="number"
                                    value={professionalData.education.endYear || ''}
                                    readOnly
                                    disabled
                                    className="input-field bg-gray-100/80 cursor-not-allowed text-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                                <input
                                    type="text"
                                    value={professionalData.education.rollNumber || ''}
                                    readOnly
                                    disabled
                                    className="input-field bg-gray-100/80 cursor-not-allowed text-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                                <input
                                    type="text"
                                    value={professionalData.education.branch || ''}
                                    readOnly
                                    disabled
                                    className="input-field bg-gray-100/80 cursor-not-allowed text-gray-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Skills Section */}
                <div className="space-y-4 pt-6 border-t border-gray-100">
                    <h3 className="text-lg font-medium text-gray-900 border-l-4 border-green-500 pl-3">Skills</h3>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Technical Skills (comma separated)</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Java, Python, React, JavaScript, AWS..."
                                value={professionalData.skills.join(', ')}
                                onChange={(e) =>
                                    setProfessionalData({
                                        ...professionalData,
                                        skills: e.target.value.split(',').map((s) => s.trim()),
                                    })
                                }
                                className="input-field py-4 pl-4"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Add skills to showcase on your profile. These help in matching relevant opportunities.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" disabled={loading} className="btn-primary w-full md:w-auto px-8">
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ProfessionalDetails;
