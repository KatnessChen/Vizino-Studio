import React from 'react';

interface GallerySkeletonProps {
  layoutMode: 'Kanban' | 'List';
}

const GallerySkeleton: React.FC<GallerySkeletonProps> = ({ layoutMode }) => {
  return (
    <div
      className={
        layoutMode === 'Kanban'
          ? 'grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 p-6'
          : 'flex flex-col gap-4 p-6'
      }
    >
      {/* Display 8 full-card color placeholders */}
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={`skeleton-${index}`} className={layoutMode === 'List' ? 'w-full' : ''}>
          <div
            className={`w-full ${layoutMode === 'List' ? 'min-h-[120px]' : 'min-h-[200px]'} rounded-md border-2 border-[#e5e7eb] bg-[#e5e7eb] overflow-hidden animate-pulse flex items-center justify-center`}
          >
            <div className="text-sm text-[#9ca3af]">Loading...</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default React.memo(GallerySkeleton);
