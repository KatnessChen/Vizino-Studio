import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AssetCard from './AssetCard';
import { ImageData } from '@/types';

interface SortableAssetCardProps {
  asset: ImageData;
  isSelected: boolean;
  layout?: 'grid' | 'list';
  onSelect: (event?: React.MouseEvent) => void;
  onViewExpand: () => void;
  onViewDetails: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onUpscale?: () => void;
  renderPreview?: () => React.ReactNode;
  showViewButton?: boolean;
  editLabel?: string;
}

const SortableAssetCard: React.FC<SortableAssetCardProps> = ({
  asset,
  isSelected,
  layout = 'grid',
  onSelect,
  onViewExpand,
  onViewDetails,
  onRename,
  onDelete,
  onCopy,
  onUpscale,
  renderPreview,
  showViewButton,
  editLabel,
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
        layout={layout}
        onSelect={onSelect}
        onViewExpand={onViewExpand}
        onViewDetails={onViewDetails}
        onRename={onRename}
        onDelete={onDelete}
        onCopy={onCopy}
        onUpscale={onUpscale}
        renderPreview={renderPreview}
        showViewButton={showViewButton}
        editLabel={editLabel}
      />
    </div>
  );
};

export default SortableAssetCard;
