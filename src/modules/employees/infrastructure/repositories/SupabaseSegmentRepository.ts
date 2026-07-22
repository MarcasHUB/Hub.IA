import { supabase } from '@/infrastructure/supabase/client';
import { Segment } from '../../domain/entities/Segment';
import { ISegmentRepository } from '../../domain/repositories/ISegmentRepository';

export class SupabaseSegmentRepository implements ISegmentRepository {
  async listSegments(organizationId: string): Promise<Segment[]> {
    const { data, error } = await supabase
      .from('segments')
      .select('*')
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data as Segment[];
  }

  async createSegment(segment: Omit<Segment, 'id' | 'created_at' | 'updated_at'>): Promise<Segment> {
    const { data, error } = await supabase
      .from('segments')
      .insert({
        organization_id: segment.organization_id,
        nome: segment.nome,
        descricao: segment.descricao || null,
        status: segment.status,
        responsavel_id: segment.responsavel_id || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Segment;
  }

  async updateSegment(id: string, segment: Partial<Segment>): Promise<Segment> {
    const { data, error } = await supabase
      .from('segments')
      .update(segment)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Segment;
  }

  async deleteSegment(id: string): Promise<void> {
    const { error } = await supabase
      .from('segments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
