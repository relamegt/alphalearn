import React, { useState } from 'react';

const ProfileCard = ({ user, updateUser }) => {
    const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

    const displayName = `${user.firstName} ${user.lastName}`;
    const handle = user.username ? `@${user.username}` : `@${user.email.split('@')[0]}`;

    const profilePic = user.profile?.profilePicture || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=random`;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center">
            <div className="relative mb-4">
                <img
                    src={profilePic}
                    alt={displayName}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
                <div className="absolute bottom-0 right-0 bg-green-500 w-4 h-4 rounded-full border-2 border-white"></div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-1">{displayName}</h2>
            <p className="text-sm font-medium text-gray-500 mb-3">{handle}</p>

            {/* Visibility Toggle */}
            <div className="flex items-center justify-center gap-2 mt-2 mb-2">
                <span className={`text-xs font-semibold ${user.isPublicProfile === false ? 'text-gray-900' : 'text-gray-400'}`}>Private</span>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={user.isPublicProfile !== false} // Default to true if undefined
                        disabled={isUpdatingVisibility}
                        onChange={async (e) => {
                            const newValue = e.target.checked;
                            setIsUpdatingVisibility(true);
                            try {
                                const { default: profileService } = await import('../../../services/profileService');
                                await profileService.updateProfile({ isPublicProfile: newValue });
                                if (updateUser) {
                                    updateUser({ isPublicProfile: newValue });
                                }
                                const { default: toast } = await import('react-hot-toast');
                                toast.success(newValue ? 'Profile is now public' : 'Profile is now private');
                            } catch (error) {
                                const { default: toast } = await import('react-hot-toast');
                                toast.error('Failed to update visibility');
                            } finally {
                                setIsUpdatingVisibility(false);
                            }
                        }}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed flex items-center justify-center">
                        {isUpdatingVisibility && (
                            <svg className="w-4 h-4 text-white animate-spin z-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                    </div>
                </label>
                <span className={`text-xs font-semibold ${user.isPublicProfile !== false ? 'text-green-500' : 'text-gray-400'}`}>Public</span>
            </div>

            <div className="w-full border-t border-gray-100 pt-4 mt-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-left">
                        <span className="text-gray-400 block text-xs uppercase tracking-wider">Roll Number</span>
                        <span className="font-semibold text-gray-700">{user.education?.rollNumber || 'N/A'}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-gray-400 block text-xs uppercase tracking-wider">Email</span>
                        <span className="font-semibold text-gray-700 truncate block max-w-[150px] ml-auto" title={user.email}>{user.email}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileCard;
