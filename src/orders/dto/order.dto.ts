import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OrderItemKind } from '../entities/order-item.entity';
import { OrderStatus } from '../entities/order.entity';
import { OrderTabStatus } from '../entities/order-tab.entity';

export class OpenTabDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  customerName: string;

  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,20}$/, {
    message: 'Número do cartão inválido.',
  })
  cardNumber: string;
}

export class OrderItemInputDto {
  @IsEnum(OrderItemKind)
  kind: OrderItemKind;

  @ValidateIf((item: OrderItemInputDto) => item.kind === OrderItemKind.MENU)
  @IsUUID()
  menuItemId?: string;

  @ValidateIf(
    (item: OrderItemInputDto) =>
      item.kind === OrderItemKind.GAME || item.gameId !== undefined,
  )
  @IsUUID()
  gameId?: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class CreateOrderDto {
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  items: OrderItemInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(30)
  tableLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class UpdateOrderStatusDto {
  @IsIn([OrderStatus.PREPARING, OrderStatus.DONE, OrderStatus.CANCELED])
  status: OrderStatus;

  @ValidateIf(
    (dto: UpdateOrderStatusDto) => dto.status === OrderStatus.CANCELED,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason?: string;
}

export class StaffFeedQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class TabsQueryDto {
  @IsOptional()
  @IsEnum(OrderTabStatus)
  status?: OrderTabStatus;
}
