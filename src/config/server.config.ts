import { registerAs } from '@nestjs/config';
 
export default registerAs('server', () => ({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL,
    backendUrl: process.env.BACKEND_URL,
 
    jwt: {
        secret: process.env.JWT_SECRET_KEY
    },
    mail: {
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        user: process.env.MAIL_USER,
        secure: process.env.MAIL_SECURE,
        password: process.env.MAIL_PASS,
        from: process.env.MAIL_FROM
    },
    oppSecret: {
        oppBaseUrl: process.env.OPP_API_BASE_URL,
        apiKey: process.env.OPP_API_KEY,
        notificationSecret: process.env.NOTIFICATION_SECRET,
        notificationUrl: `${process.env.BACKEND_URL}/creator/onboard/notify`,
        returnUrl: `${process.env.BACKEND_URL}/creator/onboard/return`
    },
    bucket: {
        spacesKey: process.env.DO_SPACES_KEY,
        spacesSecret: process.env.DO_SPACES_SECRET,
        spacesBucket: process.env.DO_SPACES_BUCKET,
        spacesRegion: process.env.DO_SPACES_REGION,
        spacesEndpoint: process.env.DO_SPACES_ENDPOINT
    }
}));