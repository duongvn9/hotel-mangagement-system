import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  AvailabilityQuery,
  AvailabilityRoom,
  StayInterval,
} from './availability.core.js';

export abstract class AvailabilityRoomSource {
  abstract findCandidates(
    query: AvailabilityQuery & StayInterval,
  ): Promise<readonly AvailabilityRoom[]>;
}

@Injectable()
export class UnconfiguredAvailabilityRoomSource extends AvailabilityRoomSource {
  async findCandidates(): Promise<readonly AvailabilityRoom[]> {
    throw new ServiceUnavailableException(
      'H3 Room/RoomType availability adapter is not configured',
    );
  }
}

@Injectable()
export class AvailabilityClock {
  now(): Date {
    return new Date();
  }
}
