import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AssetCard from './AssetCard';
import { ImageData } from '@/types';

interface SortableAssetCardProps {
  asset: ImageData;
  isSelected: boolean;
  onSelect: (event?: React.MouseEvent) => void;
  onViewExpand: () => void;
  onViewDetails: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onCopy?: () => void;
}

const SortableAssetCard: React.FC<SortableAssetCardProps> = ({
  asset,
  isSelected,
  onSelect,
  onViewExpand,
  onViewDetails,
  onRename,
  onDuplicate,
  onCopy,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: asset.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <AssetCard
        asset={asset}
        isSelected={isSelected}
        onSelect={onSelect}
        onViewExpand={onViewExpand}
        onViewDetails={onViewDetails}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onCopy={onCopy}
      />
    </div>
  );
};

export default SortableAssetCard;
