import { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import { LoginRequestDTO, AuthResponseDTO } from '../dto/AuthDTOs';

export class LoginUseCase {
    constructor(private readonly authRepository: IAuthRepository) {}

    async execute(request: LoginRequestDTO): Promise<AuthResponseDTO> {
        const user = await this.authRepository.loginWithEmail(request.email, request.password);
        
        return {
            user: {
                id: user.id,
                email: user.email,
            }
        };
    }
}