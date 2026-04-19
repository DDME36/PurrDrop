'use client';

interface LoadingSkeletonProps {
  type?: 'peer' | 'list' | 'card';
  count?: number;
}

export function LoadingSkeleton({ type = 'peer', count = 3 }: LoadingSkeletonProps) {
  if (type === 'peer') {
    return (
      <div className="skeleton-container">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-peer">
            <div className="skeleton-avatar" />
            <div className="skeleton-text-group">
              <div className="skeleton-text skeleton-text-name" />
              <div className="skeleton-text skeleton-text-device" />
            </div>
          </div>
        ))}

        <style jsx>{`
          .skeleton-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 16px;
          }

          .skeleton-peer {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            background: var(--bg-card);
            border-radius: var(--radius-sm);
            animation: skeletonPulse 1.5s ease-in-out infinite;
          }

          .skeleton-avatar {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.06) 0%,
              rgba(0, 0, 0, 0.1) 50%,
              rgba(0, 0, 0, 0.06) 100%
            );
            background-size: 200% 100%;
            animation: skeletonShimmer 1.5s ease-in-out infinite;
          }

          .skeleton-text-group {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .skeleton-text {
            height: 12px;
            border-radius: 6px;
            background: linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.06) 0%,
              rgba(0, 0, 0, 0.1) 50%,
              rgba(0, 0, 0, 0.06) 100%
            );
            background-size: 200% 100%;
            animation: skeletonShimmer 1.5s ease-in-out infinite;
          }

          .skeleton-text-name {
            width: 60%;
            height: 14px;
          }

          .skeleton-text-device {
            width: 40%;
          }

          @keyframes skeletonPulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
          }

          @keyframes skeletonShimmer {
            0% {
              background-position: -200% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }

          [data-theme="dark"] .skeleton-avatar,
          [data-theme="dark"] .skeleton-text {
            background: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.05) 0%,
              rgba(255, 255, 255, 0.1) 50%,
              rgba(255, 255, 255, 0.05) 100%
            );
            background-size: 200% 100%;
          }
        `}</style>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="skeleton-list">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-list-item">
            <div className="skeleton-text skeleton-text-full" />
          </div>
        ))}

        <style jsx>{`
          .skeleton-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .skeleton-list-item {
            padding: 12px;
            background: var(--bg-card);
            border-radius: 12px;
          }

          .skeleton-text-full {
            width: 100%;
            height: 14px;
            border-radius: 6px;
            background: linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.06) 0%,
              rgba(0, 0, 0, 0.1) 50%,
              rgba(0, 0, 0, 0.06) 100%
            );
            background-size: 200% 100%;
            animation: skeletonShimmer 1.5s ease-in-out infinite;
          }

          @keyframes skeletonShimmer {
            0% {
              background-position: -200% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }

          [data-theme="dark"] .skeleton-text-full {
            background: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.05) 0%,
              rgba(255, 255, 255, 0.1) 50%,
              rgba(255, 255, 255, 0.05) 100%
            );
            background-size: 200% 100%;
          }
        `}</style>
      </div>
    );
  }

  return null;
}
