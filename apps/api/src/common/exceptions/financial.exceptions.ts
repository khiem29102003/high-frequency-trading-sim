import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

export class InsufficientFundsException extends ForbiddenException {
  constructor(message = 'Insufficient funds') {
    super({ code: 'INSUFFICIENT_FUNDS', message });
  }
}

export class RiskRejectedException extends ForbiddenException {
  constructor(message = 'Risk check rejected order') {
    super({ code: 'RISK_REJECTED', message });
  }
}

export class DuplicateOrderException extends ConflictException {
  constructor(message = 'Duplicate order request') {
    super({ code: 'DUPLICATE_ORDER', message });
  }
}

export class InvalidOrderStateException extends BadRequestException {
  constructor(message = 'Invalid order state transition') {
    super({ code: 'INVALID_ORDER_STATE', message });
  }
}
