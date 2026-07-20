import { JwtPayload } from '../../auth/jwt-auth.guard';

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}