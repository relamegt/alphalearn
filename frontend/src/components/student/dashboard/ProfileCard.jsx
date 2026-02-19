import React from 'react';

const ProfileCard = ({ user }) => {
    // Construct display name and handle
    const displayName = `${user.firstName} ${user.lastName}`;
    const handle = user.education?.rollNumber
        ? `${user.firstName.toLowerCase()}_${user.education.rollNumber}`
        : user.email.split('@')[0];

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
            {/* Handle display removed as requested */}

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
