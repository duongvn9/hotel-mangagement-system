export enum ServiceOrderReviewStatus {
  PendingReview = 'PENDING_REVIEW',
  Accepting = 'ACCEPTING',
  Accepted = 'ACCEPTED',
  Rejected = 'REJECTED',
}

export enum ServiceOrderExecutionStatus {
  NotStarted = 'NOT_STARTED',
  Assigning = 'ASSIGNING',
  Assigned = 'ASSIGNED',
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED',
}
