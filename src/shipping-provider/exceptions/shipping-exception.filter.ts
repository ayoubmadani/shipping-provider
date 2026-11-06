import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

export class ShippingException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidProviderException extends ShippingException {
  constructor(providerName: string, available: string[] = []) {
    const list = available.length ? ` Available: ${available.join(', ')}` : '';
    super(`Invalid shipping provider: "${providerName}".${list}`);
  }
}

export class CredentialsException extends ShippingException {
  constructor(providerName: string, required: string[]) {
    super(`${providerName} credentials must include: ${required.join(', ')}.`);
  }
}

export class CreateOrderException extends ShippingException {
  constructor(message: string) {
    super(`Create order failed: ${message}`);
  }
}

export class CreateOrderValidationException extends ShippingException {
  constructor(public readonly errors: Record<string, string[]>) {
    super(`Order validation failed: ${JSON.stringify(errors)}`);
  }
}

export class FunctionNotSupportedException extends ShippingException {
  constructor(fn: string, providerName: string) {
    super(`${fn}() is not supported by ${providerName}.`);
  }
}

export class NotImplementedException extends ShippingException {
  constructor(fn: string) {
    super(`${fn}() is not implemented yet.`);
  }
}

export class HttpShippingException extends ShippingException {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
  }
}

export class TrackingIdNotFoundException extends ShippingException {
  constructor(trackingId: string, providerName?: string) {
    const provider = providerName ? ` (${providerName})` : '';
    super(`Tracking ID not found: "${trackingId}"${provider}.`);
  }
}

// أخطاء الشركات تصل للـ API برسالتها (كانت تصير 500 «Internal server error» بلا سبب)
// لا يُعاد status الشركة نفسه (401 منها كان سيبدو للوحة كخروج من الحساب) ← 502 لأعطال الشركة
@Catch(ShippingException)
export class ShippingExceptionFilter implements ExceptionFilter {
  catch(exception: ShippingException, host: ArgumentsHost) {
    const status = exception instanceof TrackingIdNotFoundException ? 404
      : exception instanceof HttpShippingException ? 502
      : 400;
    host.switchToHttp().getResponse().status(status).json({ statusCode: status, message: exception.message });
  }
}
