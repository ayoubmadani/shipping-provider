import { webcrypto } from 'crypto';
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}

import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ShippingExceptionFilter } from './shipping-provider/exceptions/shipping-exception.filter';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new ShippingExceptionFilter());

  const port = process.env.PORT || 7001;
  await app.listen(port);
  console.log(`🚚 shipping-provider running on http://localhost:${port}`);
}

bootstrap();
