import { NetworkRequest } from '../entities/NetworkRequest';

export interface INetworkRequestRepository {
    save(request: NetworkRequest): Promise<void>;
    findByTarget(orgId: string): Promise<NetworkRequest[]>;
}