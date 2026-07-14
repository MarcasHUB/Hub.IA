import { Segment } from '../entities/Segment';

export interface ISegmentRepository {
  listSegments(organizationId: string): Promise<Segment[]>;
  createSegment(segment: Omit<Segment, 'id' | 'created_at' | 'updated_at'>): Promise<Segment>;
  updateSegment(id: string, segment: Partial<Segment>): Promise<Segment>;
  deleteSegment(id: string): Promise<void>;
}
