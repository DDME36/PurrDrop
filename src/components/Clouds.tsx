'use client';

export function Clouds() {
  return (
    <>
      {/* Animated Gradient Background - Clean & Soft */}
      <div className="bg-gradient-animated" />
      
      {/* Floating Blobs - Optimized soft spots */}
      <div className="floating-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>
      
      {/* Clouds - Only soft clouds for a clean look */}
      <div className="clouds-bg">
        <div className="cloud cloud-1" />
        <div className="cloud cloud-2" />
        <div className="cloud cloud-3" />
        <div className="cloud cloud-4" />
      </div>
    </>
  );
}
