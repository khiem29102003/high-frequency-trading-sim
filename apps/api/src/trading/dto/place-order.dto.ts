import { IsEnum, IsNumberString, IsString } from 'class-validator';
import { OrderSide } from '@prisma/client';

export class PlaceOrderDto {
  @IsString()
  symbol!: string;

  @IsEnum(OrderSide)
  side!: OrderSide;

  @IsNumberString()
  limitPrice!: string;

  @IsNumberString()
  qty!: string;
}
