import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger Document Builder
  const config = new DocumentBuilder()
  .setTitle('Creator Platform')
  .setDescription('The Creator Platform API description')
  .setVersion('1.0')
  .addTag('creator-platform')
  .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  app.use(cookieParser());
  // Enable CORS
  app.enableCors({
    credentials: true,
    origin: [process.env.FRONTEND_URL, 'http://localhost:5173']
  });

  // Listen on port
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
