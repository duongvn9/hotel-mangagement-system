import { Injectable } from '@nestjs/common';

@Injectable()
export class TaskSupervisionClock {
  now(): Date {
    return new Date();
  }
}
