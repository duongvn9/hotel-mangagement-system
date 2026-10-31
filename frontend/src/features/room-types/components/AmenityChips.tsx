import { AssetImage } from '@/components/AssetImage'
import { Badge } from '@/components/Badge'
import type { RoomType } from '../api'

export function AmenityChips({ amenities }: Pick<RoomType, 'amenities'>) {
  if (!amenities.length) return <span className="text-stone-700">Chưa có tiện nghi</span>
  return (
    <div className="flex flex-wrap gap-2">
      {amenities.slice(0, 3).map((amenity) => (
        <Badge key={amenity.id} tone="neutral">
          <AssetImage
            decorative
            path={amenity.iconUrl}
            name={amenity.name}
            className="inline-block size-4 object-contain"
          />
          {amenity.name}
        </Badge>
      ))}
      {amenities.length > 3 && (
        <details className="text-stone-700">
          <summary className="flex min-h-11 cursor-pointer items-center text-primary hover:underline">
            +{amenities.length - 3} tiện nghi
          </summary>
          <div className="flex flex-wrap gap-2">
            {amenities.slice(3).map((amenity) => (
              <Badge key={amenity.id} tone="neutral">
                <AssetImage
                  decorative
                  path={amenity.iconUrl}
                  name={amenity.name}
                  className="inline-block size-4 object-contain"
                />
                {amenity.name}
              </Badge>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
