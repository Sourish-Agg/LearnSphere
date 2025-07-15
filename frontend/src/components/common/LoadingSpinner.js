import React from 'react';

const LoadingSpinner = ({ message = 'Loading...', className = '' }) => {
  return (
    <div className={`min-h-screen flex items-center justify-center ${className}`}>
      <div className="text-xl">{message}</div>
    </div>
  );
};

export default LoadingSpinner;