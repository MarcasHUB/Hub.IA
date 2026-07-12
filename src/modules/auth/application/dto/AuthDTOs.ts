export interface LoginRequestDTO {
    email: string;
    password: string;
}

export interface AuthResponseDTO {
    user: {
        id: string;
        email: string;
    };
    token?: string;
}